# janus_freeswitch_integration
Integrating Janus and FreeSWITCH for an heterogeneous conferencing system

The code in this repo is part of a Proof Of Concept presented at JanusCon in 2019.

The purpose is to show how Janus and FreeSWITCH can be integrated to provide a conferencing system for WebRTC and non-WebRTC clients.

A controller application, written in nodejs, is provided. It's a rudimentary application that controls Janus via its REST API and FreeSWITCH via verto protocol (over WebSocket) and ESL (over TCP).

Also a few snippets to configure FreeSWITCH and create the conference when a VoIP call is received.

The plantUML code for the sequence diagram presented during JanusCon are also provided.

One file from the PoC is missing: verto.js, while its licensing is being sorted.

Giacomo Vacca

