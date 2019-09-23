#!/usr/bin/env nodejs

verto = require('./verto')

var uuid = require('uuid');
var http = require('http');

var fsV = new verto(verto);

//var debug = false;
var debug = true;


var esl = require('modesl');

console.log("START===============>");

var esl_conn = new esl.Connection('127.0.0.1', 8021, 'ClueCon', callback_esl_conn)
.on("esl::ready", function () {
  esl_conn.events('json' , 'ALL', function() {
    console.log('ESL ready - subscribed to receive ALL events.');
  });
})
.on("esl::event::**", function(event, headers, body) {
  if (debug) {
    if (event.getHeader('Event-Name') != "RECV_RTCP_MESSAGE") {
      console.log('Event: ' + event.getHeader('Event-Name') + " - UUID:" + event.getHeader('Unique-ID'));
    }
  }

  if (event.getHeader('Event-Name') == 'CHANNEL_DESTROY') {
    console.log('==================> CHANNEL_DESTROY! - UUID: ' + event.getHeader('Unique-ID'));
    //I need to retrieve the publisher's handle ID here...
    sendUnpublish(publisher.handle_id);
  }
});


function callback_esl_conn() {
  esl_conn.api('status', function(res) {
        console.log('callback_esl_conn.........');
        //res is an esl.Event instance
        console.log(res.getBody());
  });
}



console.log("AFTER CONNECTION TO FS ESL ===============>");


//------------------------------------
// TODO: Global vars that need review

// Let's consider one single publisher for now
var publisher = {};

// The feeds list
var feeds = {};

// There is one single session ID, the session between this app and Janus
var session_id = null;

//var janus_hostname = '138.68.188.230';
//var janus_hostname = '178.62.27.39';
var janus_hostname = '178.128.45.241';
var janus_port = 8088;
//------------------------------------




fsV.on('open', function () {
    fsV.login(function() {
        console.log('info',"Connected to Verto.");
        connectEvent();
    }, function() {});
});

function connectEvent() {
  console.log("control::connectEvent");
}

fsV.on('message', function(message) {
  console.log("-----------> Received verto message: ");
  console.log(message);
  console.log("<----------- verto message");
});

fsV.on('verto.invite', function(message) {
  publisher.sdp = message.params['sdp'];
  publisher.verto_call_id = message.params['callID'];

  console.log("This is the incoming SDP: " + message.params['sdp']);

  var result = {
    "message": "CALL CREATED",
    "callID": publisher.verto_call_id,
    "sessid": message.params['sessid']
  };

  fsV.sendReply(message, result, function() {
    console.log("control - sendReply success cb");
  }, function() {
    console.log("control - sendReply error cb");
  });

  var uuid = require("uuid");

  sendCreate();
});


// TODO: Move this to a "janus.js" module
function sendCreate() {
  console.log("control::sendCreate ------------");
  var transaction = uuid.v4();
  var request = { "janus": "create", "transaction": transaction };
  var path = '/janus';
  var options = {
    hostname: janus_hostname,
    port: janus_port,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(JSON.stringify(request))
    }
  };

  var req = http.request(options, function(res) {
    console.log("-------------------------------------");
    console.log("RESPONSE STATUS: " + res.statusCode);
    console.log("RESPONSE HEADERS: " + JSON.stringify(res.headers));
    res.setEncoding('utf8');

    res.on('data', function(chunk) {
      console.log("RESPONSE BODY: " + chunk);
      chunk = JSON.parse(chunk);

      // This is the session ID result of the 'create' request
      session_id = chunk.data['id'];
      console.log("session ID for this run: " + session_id);

      // Start gatehering events for this session
      getEvent();

      var janus_result = chunk.janus;
      if (janus_result === "success") {
        console.log("Create successful... now attach to plugin...");
        var transaction = uuid.v4();

        // This is the publisher
        sendAttach(false);
      }
    });

    res.on('end', function() {
      //console.log('No more data in response.');
    });
  });
  console.log("Sending request to path: " + path);
  console.log(request);
  req.write(JSON.stringify(request),encoding='utf8');
  req.end();
}

function sendAttach(is_subscriber, feed) {
  console.log("control::sendAttach -----");
  var transaction = uuid.v4();
  var request = { "janus": "attach", "plugin": "janus.plugin.videoroom", "opaque_id": transaction + "1", "transaction": transaction };
  var path = '/janus/' + session_id;
  var options = {
    hostname: janus_hostname,
    port: janus_port,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(JSON.stringify(request))
    }
  };

  var req = http.request(options, function(res) {
    console.log("-------------------------------------");
    console.log("ATTACH RESPONSE STATUS: " + res.statusCode);
    console.log("ATTACH RESPONSE HEADERS: " + JSON.stringify(res.headers));
    res.setEncoding('utf8');

    res.on('data', function(chunk) {
      console.log("ATTACH RESPONSE BODY: " + chunk);
      chunk = JSON.parse(chunk);

      if (is_subscriber) {
        var subscriber_handle_id = chunk.data['id'];
        feeds[feed].subscriber_handle_id = subscriber_handle_id;
        console.log("Handle ID (Subscriber): " + subscriber_handle_id + " feed: " + feed);
      }
      else {
        publisher.handle_id = chunk.data['id'];
        console.log("Handle ID (Publisher): " + publisher.handle_id);
      }

      var janus_result = chunk.janus;
      if (janus_result === "success") {
        console.log("Attach Success... now join...");
        if (is_subscriber) {
          sendJoin(true, subscriber_handle_id, feed);
        }
        else {
          sendJoin(false);
        }
      }
    });

    res.on('end', function() {
      //console.log('No more data in response.');
    });
  });
  console.log("Sending request to: " + path);
  console.log(request);
  req.write(JSON.stringify(request),encoding='utf8');
  req.end();
}

function sendJoin(is_subscriber, subscriber_handle_id, feed) {
  console.log("contro::sendJoin");
  var transaction = uuid.v4();
  var request = {"janus":"message","transaction": transaction, "plugin":"", "opaque_id": "1" + transaction, "body": {"request":"join", "room": 1234, "ptype": "publisher", "display": "gv"}}
  if (is_subscriber) {
    console.log("control::sendJoin - subscriber handle ID: " + subscriber_handle_id + " - feed: " + feed);
    //GV 20190621 request = {"janus": "message", "transaction": transaction, "opaque_id": "1" + transaction, "body": {"request": "join", "room": 1234, "ptype": "subscriber", "feed": feed, "display": "gv"}}
    request = {"janus": "message", "transaction": transaction, "opaque_id": "1" + transaction, "body": {"request": "join", "room": 1234, "ptype": "subscriber", "offer_video": false, "feed": feed, "display": "gv"}}
  }
  var local_handleId = publisher.handle_id;
  if (is_subscriber) {
    local_handleId = subscriber_handle_id;
  }
  var path = '/janus/' + session_id + '/' + local_handleId;
  var options = {
    hostname: janus_hostname,
    port: janus_port,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(JSON.stringify(request))
    }
  };
  var req = http.request(options, function(res) {
    console.log("-------------------------------------");
    console.log("JOIN RESPONSE STATUS: " + res.statusCode);
    console.log("JOIN RESPONSE HEADERS: " + JSON.stringify(res.headers));
    res.setEncoding('utf8');

    res.on('data', function(chunk) {
      console.log("JOIN RESPONSE BODY: " + chunk);
      chunk = JSON.parse(chunk);

      var janus_result = chunk.janus;
      if (janus_result === "ack" && !is_subscriber) {
        console.log("JOIN for subscriber acked... now send offer...");
        sendOffer(local_handleId);
      }
    });

    res.on('end', function() {
      //console.log('No more data in response.');
    });
  });

  console.log("Sending request to: " + path);
  console.log(request);
  req.write(JSON.stringify(request),encoding='utf8');
  req.end();
}

function sendOffer(handle_id) {
  console.log("control::sendOffer ------ ");
  var transaction = uuid.v4();
  var request = {"janus": "message", "body": {"request": "configure", "audio": true, "video": false}, "transaction": transaction, "jsep": {"type": "offer", "sdp": publisher.sdp, "trickle": false}};

  var path = '/janus/' + session_id + '/' + handle_id;
  var options = {
    hostname: janus_hostname,
    port: janus_port,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(JSON.stringify(request))
    }
  };

  var req = http.request(options, function(res) {
    console.log("-------------------------------------");
    console.log("OFFER RESPONSE STATUS: " + res.statusCode);
    console.log("OFFER RESPONSE HEADERS: " + JSON.stringify(res.headers));
    res.setEncoding('utf8');

    res.on('data', function(chunk) {
      console.log("OFFER RESPONSE BODY: " + chunk);
      chunk = JSON.parse(chunk);

      var janus_result = chunk.janus;
      if (janus_result === "ack") {
        console.log("offer acked... now wait for answer from events...");
      }
    });

    res.on('end', function() {
      //console.log('No more data in response.');
    });
  });

  console.log("Sending request to: " + path);
  console.log(request);
  req.write(JSON.stringify(request),encoding='utf8');
  req.end();
}

function getEvent() {
//  console.log("controll::getEvent ------ ");
  var path = '/janus/' + session_id + '?maxev=1';
  var options = {
    hostname: janus_hostname,
    port: janus_port,
    path: path,
    method: 'GET'
  };

  // Keep polling for events from Janus
  setTimeout(getEvent, 2000);

  var req = http.request(options, function(res) {
    console.log("-------------------------------------");
    //console.log("GET EVENT STATUS: " + res.statusCode);
    //console.log("GET EVENT HEADERS: " + JSON.stringify(res.headers));
    res.setEncoding('utf8');

    var event_body = "";

    res.on('data', function(chunk) {
      //console.log("EVENT BODY (chunk): " + chunk);

      event_body += chunk;
    });

    res.on('end', function() {
      console.log("EVENT BODY: " + event_body);

      try {
        event_body = JSON.parse(event_body);
      } catch(e) {
        console.log("Malformed request: ", event_body);
      }

      if (event_body.janus == "webrtcup") {
        var feed = event_body.sender;
        console.log("control::getEvent - received webrtcup for feed " + feed);
        esl_get_conference_list();
        return;
      }

      if ("plugindata" in event_body) {
        if (event_body.plugindata['plugin'] != "janus.plugin.videoroom") {
          return;
        }

        if ("data" in event_body.plugindata) {
          if ((event_body.plugindata.data['videoroom'] == "event") || (event_body.plugindata.data['videoroom'] == "attached")) {
            if ("unpublished" in event_body.plugindata.data) {
              var leaving_feed = event_body.plugindata.data['unpublished'];
              if (leaving_feed in feeds) {
                var callID = feeds[leaving_feed].callID;
                if (!callID) {
                  console.log("ERROR - call ID for this feed not found!");
                  return;
                }
                console.log("Feed to unsubscribe from: " +  leaving_feed + " - Call ID: " + callID);
                //{"jsonrpc":"2.0","id":23,"method":"verto.bye","params":{"callID":"d5d2714c-2031-11e7-8d62-8f85c9050b53","causeCode":16,"cause":"NORMAL_CLEARING"}}

                var bye_params = {
                  "dialogParams": {
                    "callID": callID
                  },
                  "causeCode": 16,
                  "cause": "NORMAL_CLEARING"
                };

                fsV.sendRequest('verto.bye', bye_params, function(result){
                  console.log("control - verto.bye result:");
                  console.log(result);
                });
                return;
              }
              else {
                console.log("ERROR - Received un unplished event for a feed we don't have");
              }
            }
            else if ("jsep" in event_body) {
              var janus_sdp = event_body.jsep['sdp'];

              var jsep_type = event_body.jsep['type'];
              if (jsep_type == "answer") {
                var room_id = event_body.plugindata.data.room;
                console.log("SDP (answer) from Janus: " + janus_sdp + " (room: " + room_id + ")");

                var answer_params = {
                  "dialogParams": {
                    "callID": publisher.verto_call_id,
                    "callee_id_name": "Janus",
                    "callee_id_number": room_id
                  },
                  "sdp": janus_sdp,
                };
                fsV.sendRequest('verto.answer', answer_params, function(result) {
                  console.log("control - verto.answer success callback - result: ");
                  console.log(result);
                }, function(result) {
                  console.log("control - ERROR ========================> verto.answer error: ")
                  console.log(result);
                });
              }
              else { // this is a JSEP offer
                // This is the subscriber ID
                var sender = event_body.sender;

                console.log("Received offer from Janus - sender: " + sender);
                console.log("Current feeds:");
                console.log(feeds);
                var callID = uuid.v4();

                //{ 'feed1': { subscriber_handle_id: 1838820316019069 } }
                var this_feed = null;
                for (var feed in feeds) {
                  if (feeds[feed].subscriber_handle_id == sender) {
                    this_feed = feed;
                    feeds[feed].callID = callID;
                    feeds[feed].sdp = janus_sdp;
                    break; // Exit from for loop
                  }
                }

                //TODO: Make all those values dynamic
                var invite_params = {
                  "dialogParams": {
                    "callID": callID,
                    "caller_id_name": feeds[this_feed].display,
                    "caller_id_number": feeds[this_feed].display,
                    "callee_id_name": "test",
                    "callee_id_number": "test",
                    "display_direction": "inbound"
                  },
                  "sdp": janus_sdp,
                };
                fsV.sendRequest('verto.invite', invite_params, function(result) {
                  console.log("control ------------------------------> verto.invite success callback - result: ");
                  console.log(result);
//{ message: 'CALL CREATED',
//  callID: '742078e6-c127-448a-9d59-2f54213a6628',
//  sessid: 'a70641ce-a092-424c-b04d-456cc61b6fb0' }

                  if (result.message == "CALL CREATED") {
                    var callID = result.callID;
                    console.log("The call ID for this verto invite is: " + callID + " and the feed is: " + feed);
                    feeds[feed].verto_call_id = callID;
                  }
                  else {
                    console.log("ERROR - Unsupported result message: " + result.message);
                  }
                });
              }
            return;
            }
          }

          if ((event_body.plugindata.data['videoroom'] == "joined") || (event_body.plugindata.data['videoroom'] == "event")) {
            var id = event_body.plugindata.data['id'];
            var publishers = event_body.plugindata.data['publishers'];

            if (publishers) {
              for (var i=0; i < publishers.length; i++) {
                console.log("Publisher:");
                console.log(publishers[i]);
                var feed = publishers[i].id;
                console.log("Videoroom joined event------------------> feed: " + feed + " - data ID: " + id + " - Publisher: " + publisher.handle_id);
                // Add new publishers
                if (feeds[feed] == undefined) {
                  feeds[feed] = {};
                  feeds[feed].display = publishers[i].display;

                  // This is a subscriber
                  sendAttach(true, feed);
                }
                else {
                  console.log("Already managing this feed (" + feed + ")");
                  return;
                }
              }
              return;
            }
          }
        }
      }
    });
  });

//GV 20190710  console.log("Sending GET to:" + path);
  req.end();
}

fsV.on('verto.media', function(message) {

  var subscriber_sdp = message.params['sdp'];
  var callID = message.params['callID'];
  console.log("verto.media (answer) from verto - callID: " + callID);
  console.log("feeds:");
  console.log(feeds);
  for (var feed in feeds) {
    if (feeds[feed].callID == callID) {
      sendAnswer(subscriber_sdp, feeds[feed].subscriber_handle_id);
    }
  }
});

function sendAnswer(subscriber_sdp, subscriber_handle_id) {
  console.log("control::sendAnswer -----------");
  var transaction = uuid.v4();
  var request = {"janus": "message", "body": {"request": "start", "room": 1234},"transaction": transaction, "jsep": {"type": "answer","sdp": subscriber_sdp, "trickle": false}};

  var path = '/janus/' + session_id + '/' + subscriber_handle_id;
  var options = {
    hostname: janus_hostname,
    port: janus_port,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(JSON.stringify(request))
    }
  };

  var req = http.request(options, function(res) {
    console.log("-------------------------------------");
    console.log("ANSWER RESPONSE STATUS: " + res.statusCode);
    console.log("ANSWER RESPONSE HEADERS: " + JSON.stringify(res.headers));
    res.setEncoding('utf8');

    res.on('data', function(chunk) {
      console.log("ANSWER RESPONSE BODY: " + chunk);
      chunk = JSON.parse(chunk);

      var janus_result = chunk.janus;
      if (janus_result === "ack") {
        console.log("answer acked...");
      }
    });

    res.on('end', function() {
      //console.log('No more data in response.');
    });
  });

  console.log("Sending request to: " + path);
  console.log(request);
  req.write(JSON.stringify(request),encoding='utf8');
  req.end();
}

fsV.on('verto.bye', function(message) {
  // For now we just have one publisher, smile
  if (message.params['callID'] == publisher.verto_call_id) {
    sendLeave(publisher.handle_id);
  }
});

function sendUnpublish(publisher_handle_id) {
  var transaction = uuid.v4();
  var request = {"janus": "unpublish", "transaction": transaction};

  var path = '/janus/' + session_id + '/' + publisher_handle_id;
  var options = {
    hostname: janus_hostname,
    port: janus_port,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(JSON.stringify(request))
    }
  };

  var req = http.request(options, function(res) {
    console.log("-------------------------------------");
    console.log("UNPUBLISH RESPONSE STATUS: " + res.statusCode);
    console.log("UNPUBLISH RESPONSE HEADERS: " + JSON.stringify(res.headers));
    res.setEncoding('utf8');

    res.on('data', function(chunk) {
      console.log("UNPUBLISH RESPONSE BODY: " + chunk);
      chunk = JSON.parse(chunk);

      var janus_result = chunk.janus;
      if (janus_result === "success") {
        console.log("unpublish successful...");
      }
    });

    res.on('end', function() {
      //console.log('No more data in response.');
    });
  });

  console.log("Sending request to: " + path);
  console.log(request);
  req.write(JSON.stringify(request),encoding='utf8');
  req.end();
}

function sendLeave(publisher_handle_id) {
  var transaction = uuid.v4();
  var request = {"janus": "leave", "transaction": transaction};

  var path = '/janus/' + session_id + '/' + publisher_handle_id;
  var options = {
    hostname: janus_hostname,
    port: janus_port,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(JSON.stringify(request))
    }
  };

  var req = http.request(options, function(res) {
    console.log("-------------------------------------");
    console.log("LEAVE RESPONSE STATUS: " + res.statusCode);
    console.log("LEAVE RESPONSE HEADERS: " + JSON.stringify(res.headers));
    res.setEncoding('utf8');

    res.on('data', function(chunk) {
      console.log("LEAVE RESPONSE BODY: " + chunk);
      chunk = JSON.parse(chunk);

      var janus_result = chunk.janus;
      if (janus_result === "success") {
        console.log("leave successful...");
      }
    });

    res.on('end', function() {
      //console.log('No more data in response.');
    });
  });

  console.log("Sending request to: " + path);
  console.log(request);
  req.write(JSON.stringify(request),encoding='utf8');
  req.end();
}

fsV.on('verto.answer', function(message) {
  // We need to send this answer to janus
});

function esl_get_conference_list() {

//TODO: Mute streams that come from broswers from the streams that go from FS to Janus
//e.g.: the publisher stream should have 'nospeak' for the stream from the browser that has just joined
// send 'conference test list'... This needs an ESL connection...
// This is too early!

  esl_conn.api('conference list', function(res) {
    console.log(res.getBody());

    // TODO: something more sophisticated than this
    var ob_stream = null;

    var ib_streams = [];

    var lines = res.getBody().split('\n');
    //console.log("Lines:");
    //console.log(lines);
    lines.forEach(function(line) {
      if (line.length <= 0 || (line[0] == 'C')) {
        return;
      }
      console.log(line);

// 9;verto.rtc/service;4da4a19e-3c86-4bf4-b9bb-24be4cee210b;gv1;gv1;hear|speak|video;0;0;0;100
// id in conference: 9
// Callee: Component: verto.rtc/service
// uuid: Component: 4da4a19e-3c86-4bf4-b9bb-24be4cee210b
// caller name: gv1
// caller number: gv1
// options: hear|speak|video
// Component: 0
// Component: 0
// Component: 0
// Component: 100

      var line_components = line.split(';');
      var id = line_components[0];
      var callee = line_components[1];
      var call_id = line_components[2];
      var caller_name = line_components[3];
      console.log("id: " + id + " - callee: " + callee + " - caller: " + caller_name);
      for (var feed in feeds) {
        if (feeds[feed].verto_call_id == call_id) {
          console.log("This is an incoming stream from Janus (feed: " + feed + " - call ID: " + call_id + " - verto ID: " + id + ") <----------------------------");
          var n_streams = ib_streams.push(id);
          console.log("There are " + n_streams + " streams from Janus to FS");
        }
        else if (publisher.verto_call_id == call_id) {
          console.log("This is the outgoing stream (FS -> Janus, call ID: " + call_id + " - verto ID: " + id + ")");
          ob_stream = id;
        }
      }
    });

    for (i in ib_streams) {
      esl_conn.api('conference test relate ' + ib_streams[i] + ' ' + ob_stream + ' nospeak', function(res) {
        console.log(res.getBody());
      });
    }
  });
}
