# Connect Four multiplayer tests

Run:

```powershell
node connect_four/test/sync_scenarios.cjs
```

The harness runs two isolated copies of the real `script.js` against a fake
Usion relay with durable actions, actor-written CAS checkpoints, dropped
messages, suspended clients, reconnects, duplicate delivery, and compacted
checkpoint tails.
