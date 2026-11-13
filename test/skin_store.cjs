const assert = require('node:assert/strict');
const { offlineClient } = require('./harness.cjs');
function client() {
  const c = offlineClient();
  c.run(`
    myId = 'buyer';
    var payments = [], deliveries = [], remoteUnlocks = [], failDelivery = false, failSave = false, storeReady = true;
    window.Usion = {
      storage: {
        get: async () => remoteUnlocks,
        set: async (key, ids) => { if (failSave) throw new Error('offline'); remoteUnlocks = ids; }
      },
      wallet: { requestPayment: async (amount, reason, opts) => {
        payments.push({amount, reason, key: opts.idempotencyKey});
        return { receiptToken: 'receipt-token-long-enough-for-validation' };
      }}
    };
    window.fetch = async (url, opts) => {
      if (!opts || !opts.method) return { ok: storeReady, json: async () => ({ready: storeReady, price:500}) };
      const body = JSON.parse(opts.body); deliveries.push(body);
      if (failDelivery) throw new Error('network');
      return { ok:true, json:async () => ({ok:true, skinId:body.skinId}) };
    };
  `);
  return c;
}
(async () => {
  let c = client();
  assert.equal(c.read('TOKEN_SETS.filter(s => s.price === 500).length'), 8);
  assert.equal(c.read('TOKEN_SETS.filter(s => !s.price).length'), 3);
  assert.equal(c.read('selectTokenSet("tiny-dragons", false)'), false);
  const grid = c.doc.getElementById('tokenSetGrid');
  assert.equal(grid.children.filter(el => el.classList.contains('is-locked')).length, 8);
  await c.run('loadTokenUnlocks()');
  c.run('storeReady = false');
  await c.run('purchaseTokenSet(tokenSetById("tiny-dragons"))');
  assert.equal(c.read('payments.length'), 0, 'unavailable server cannot charge');
  c.run('storeReady = true; failDelivery = true');
  await c.run('purchaseTokenSet(tokenSetById("tiny-dragons"))');
  assert.equal(c.read('payments[0].amount'), 500);
  assert.equal(c.read('isTokenUnlocked(tokenSetById("tiny-dragons"))'), false);
  assert.equal(c.read('!!readTokenData(TOKEN_PENDING_KEY, null)'), true);
  c.run('failDelivery = false');
  await c.run('purchaseTokenSet(tokenSetById("tiny-dragons"))');
  assert.equal(c.read('payments.length'), 1, 'retry replays receipt without charging');
  assert.equal(c.read('selectedTokenSetId'), 'tiny-dragons');
  assert.equal(c.read('readTokenData(TOKEN_PENDING_KEY, null)'), null);
  assert.equal(c.read('remoteUnlocks.includes("tiny-dragons")'), true);
  await c.run('purchaseTokenSet(tokenSetById("tiny-dragons"))');
  assert.equal(c.read('payments.length'), 1, 'owned skins cannot be purchased again');

  c = client();
  await c.run('loadTokenUnlocks()');
  c.run('failSave = true');
  await c.run('purchaseTokenSet(tokenSetById("snack-spirits"))');
  assert.equal(c.read('!!readTokenData(TOKEN_PENDING_KEY, null)'), true, 'retain receipt until unlock is durable');
  c.run('failSave = false');
  await c.run('loadTokenUnlocks()');
  assert.equal(c.read('payments.length'), 1);
  assert.equal(c.read('isTokenUnlocked(tokenSetById("snack-spirits"))'), true);
  assert.equal(c.read('readTokenData(TOKEN_PENDING_KEY, null)'), null);

  c = client();
  c.run('remoteUnlocks = ["tiny-dragons"]; localStorage.setItem(TOKEN_STORAGE_KEY, "tiny-dragons")');
  await c.run('loadTokenUnlocks()');
  assert.equal(c.read('selectedTokenSetId'), 'tiny-dragons', 'restore paid selection from durable ownership');
  assert.equal(c.read('payments.length'), 0);
  c.run('myId = "other-buyer"; unlockedTokenSets.clear(); remoteUnlocks = []');
  await c.run('loadTokenUnlocks()');
  assert.equal(c.read('isTokenUnlocked(tokenSetById("tiny-dragons"))'), false, 'local purchases are account-scoped');
  console.log('PASS: catalog, locked selection, readiness, 500 MNT charge, receipt recovery, durable unlocks, and account isolation');
})().catch(err => { console.error(err); process.exitCode = 1; });
