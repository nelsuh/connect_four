# Connect Four multiplayer tests

Run:

```powershell
node connect_four/test/sync_scenarios.cjs
```

The harness runs two isolated copies of the real `script.js` against a fake
Usion relay with durable actions, actor-written CAS checkpoints, dropped
messages, suspended clients, reconnects, duplicate delivery, and compacted
checkpoint tails.

## Paid token pairs

Classic, Prism Pals, and Orbit Buddies remain free. The other eight pairs cost
500 MNT each, as a permanent unlock for the buyer (the complete two-token pair).

```powershell
node connect_four/test/skin_purchase_api.cjs
node connect_four/test/skin_store.cjs
```

The API tests stub the wallet and Redis: no real money moves. Client tests cover
locked selections, store readiness, exact price, delivery retries without another
charge, durable ownership, and account-scoped local caches.

### Hosting the purchase API

Deploy the entire `connect_four` directory to a Node.js serverless host supporting
`api/purchase-skin.js` (for example Vercel). Static-only hosting does not execute
this endpoint. Configure these server environment variables:

- `USION_SERVICE_ID`: this Connect Four service's registry ID.
- `KV_REST_API_URL` and `KV_REST_API_TOKEN`: durable Redis REST storage.
  `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are also supported.

Keep credentials server-side. `GET /api/purchase-skin` must return
`{"ready":true,"price":500}` before purchases become available. The client refuses
to request payment when the endpoint is unavailable or ownership cannot load.
The server verifies the service and 500 MNT amount, binds a receipt to one skin,
then settles the escrow. The client keeps its receipt until Usion durable storage
acknowledges the unlock, and retries interrupted delivery at the next launch.

Real wallet and native WebView end-to-end verification must be performed in the
configured Usion service after deployment; local tests use mocked payments.
