### PoC configuration for FS

Starting from a vanilla setup:

- Load mod_verto
- Set `<param name="blind-reg" value="true"/>` inside the IPv4 profile in verto.conf.xml (this is risky and not suggested but was used for the PoC)
- Load mod_conference
- Add 00_inbound.xml into dialplan/default/
- Add conference_test.lua into scripts/

`control.js` will connect over WebSocket as a verto client.

