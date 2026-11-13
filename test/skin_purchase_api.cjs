const assert = require("node:assert/strict");

process.env.USION_SERVICE_ID = "service-connect-four";
process.env.KV_REST_API_URL = "https://redis.test";
process.env.KV_REST_API_TOKEN = "test-token";

const handler = require("../api/purchase-skin.js");
const store = new Map();
let verifyCalls = 0;
let settleCalls = 0;
let settleOutcome = { outcome: "settled", tx_id: "tx-1", status: "completed" };
let verifyStatus = 200;
let verifyBody = { valid: true, tx_id: "tx-1", user_id: "user-1", amount: 500, status: "pending" };

global.fetch = async (url, options = {}) => {
  if (url === "https://redis.test") {
    const [command, key, value, mode] = JSON.parse(options.body);
    if (command === "GET") return response(200, { result: store.get(key) || null });
    if (command === "SET") {
      if (mode === "NX" && store.has(key)) return response(200, { result: null });
      store.set(key, value);
      return response(200, { result: "OK" });
    }
  }
  if (String(url).endsWith("/verify-pending")) {
    assert.equal(JSON.parse(options.body).expected_amount, 500);
    assert.equal(JSON.parse(options.body).expected_service_id, "service-connect-four");
    verifyCalls++;
    return response(verifyStatus, verifyBody);
  }
  if (String(url).endsWith("/settle")) {
    settleCalls++;
    return response(200, settleOutcome);
  }
  throw new Error(`Unexpected fetch: ${url}`);
};

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
function invoke(method, body) {
  return new Promise(resolve => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      end(text) { resolve({ status: this.statusCode, body: JSON.parse(text) }); },
    };
    handler({ method, body }, res);
  });
}

(async () => {
  const health = await invoke("GET");
  assert.equal(health.status, 200);
  assert.deepEqual(health.body, { ready: true, price: 500 });

  const token = "receipt-token-that-is-long-enough-for-validation";
  const first = await invoke("POST", { skinId: "snack-spirits", receiptToken: token });
  assert.equal(first.status, 200);
  assert.equal(first.body.ok, true);
  assert.equal(verifyCalls, 1);
  assert.equal(settleCalls, 1);

  const retry = await invoke("POST", { skinId: "snack-spirits", receiptToken: token });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.recovered, true);
  assert.equal(verifyCalls, 1);
  assert.equal(settleCalls, 1);

  const replay = await invoke("POST", { skinId: "tiny-dragons", receiptToken: token });
  assert.equal(replay.status, 409);
  assert.equal(replay.body.error, "RECEIPT_ALREADY_BOUND");

  const freeSkin = await invoke("POST", { skinId: "classic", receiptToken: token + "-2" });
  assert.equal(freeSkin.status, 400);

  // A hold the 72h sweeper already refunded can never settle. It must report a
  // distinct verdict — the client retires the purchase intent on it, and
  // replaying the same dead token instead would lock the skin out for good.
  settleOutcome = { outcome: "already_refunded", tx_id: "tx-2", status: "refunded" };
  const stale = token + "-stale-receipt-token-long-enough";
  const refunded = await invoke("POST", { skinId: "garden-charms", receiptToken: stale });
  assert.equal(refunded.status, 409);
  assert.equal(refunded.body.error, "RECEIPT_REFUNDED");

  // The ledger remembers it, so a later retry never re-hits the wallet.
  const settleCallsAfterRefund = settleCalls;
  const retryRefunded = await invoke("POST", { skinId: "garden-charms", receiptToken: stale });
  assert.equal(retryRefunded.status, 409);
  assert.equal(retryRefunded.body.error, "RECEIPT_REFUNDED");
  assert.equal(settleCalls, settleCallsAfterRefund);

  // The wallet being unreachable is OUR outage, not a bad receipt. It must come
  // back as a retryable 503 — a 409 here would tell the client to retire a
  // charge the player already paid.
  settleOutcome = { outcome: "settled", tx_id: "tx-3", status: "completed" };
  verifyStatus = 502;
  verifyBody = {};
  const wobble = await invoke("POST", { skinId: "sky-friends", receiptToken: token + "-sky-friends-receipt-token-long" });
  assert.equal(wobble.status, 503);
  assert.equal(wobble.body.error, "VERIFY_UNAVAILABLE");
  assert.match(wobble.body.detail, /502/);

  // An explicit rejection is a verdict, and carries why.
  verifyStatus = 409;
  verifyBody = { valid: false, status: "settled" };
  const foreign = await invoke("POST", { skinId: "royal-blooms", receiptToken: token + "-royal-blooms-receipt-token-lng" });
  assert.equal(foreign.status, 409);
  assert.equal(foreign.body.error, "RECEIPT_NOT_PENDING");
  assert.match(foreign.body.detail, /receipt=settled/);

  // A receipt minted for the wrong amount is rejected with the amount shown.
  verifyStatus = 200;
  verifyBody = { valid: true, tx_id: "tx-4", user_id: "user-1", amount: 50, status: "pending" };
  const cheap = await invoke("POST", { skinId: "tiny-dragons", receiptToken: token + "-tiny-dragons-receipt-token-lng" });
  assert.equal(cheap.status, 409);
  assert.match(cheap.body.detail, /amount=50/);

  console.log("PASS: readiness, settlement, recovery, replay protection, refunds, and verify verdicts");
})().catch(err => { console.error(err); process.exitCode = 1; });
