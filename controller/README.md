### Controller for FS/Janus integration

This is not Production code and has the only purpose of proving FS and Janus can exchange media directly (e.g. there are no big SDP incompatibilities).

The simple code merely "translates" from FS' verto protocol to Janus API (over HTTP).

Many hardcoded values and assumptions on the location of both FS and Janus were made.

`verto.js` is copied from https://bitbucket.org/neilstratford/xyz/raw/35922b7d2e0c5402d9d39eb327bd7c77e52a06b1/server/verto.js and then disfigured and bent to the purposes of this PoC.

#### Constraints

The controller app needs to connect to FS over WebSocket, and to Janus over HTTP.

A rudimentary configuration element inside control.js (around line 53):

var janus_hostname = 'JANUS IP ADDRESS';

The other hardcoded piece of information is the IP address for verto registration (around line 17 in verto.js):

config.url = "ws:FS_IP_ADDRESS:8081";


#### Usage

```
npm install
./control.js
```

No log files are created but logs are provided in stdout.

