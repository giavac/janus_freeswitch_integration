freeswitch.consoleLog("NOTICE", "Entered conference_test.lua\n")

api = freeswitch.API();
num_channels = api:executeString("show channels count");
digits = api:execute("regex", num_channels  .. "|/([0-9]*)/|$1");
freeswitch.consoleLog("info", "num channels is: " .. digits .. "\n")

conference_list = api:executeString("conference list");
freeswitch.consoleLog("info", "Conference list: " .. conference_list .. "\n")
conference_test_exists = string.find(conference_list, "Conference test")

session:answer()

if (conference_test_exists) then
  freeswitch.consoleLog("info", "Conference test exists!\n")
  session:execute("conference", "test@cdquality")
else
  freeswitch.consoleLog("info", "Conference test DOES NOT exist!\n")
  -- default for G.711 at 8 KHz
  -- dial_string = "bridge:test@default:{origination_audio_mode=sendonly}verto.rtc/giacomo@${domain_name}"

  -- cdquality for opus at 48 KHz
  -- mediacontroller is the hardcoded verto login name for the MediaController app
  local app = 'mediacontroller'
  dial_string = "bridge:test@cdquality:{origination_audio_mode=sendonly}verto.rtc/" .. app .. "@${domain_name}"

  session:execute("conference", dial_string)
end

freeswitch.consoleLog("NOTICE", "conference_test.lua - dialled into conference")

session:hangup()

freeswitch.consoleLog("NOTICE", "Done with conference_test.lua")
