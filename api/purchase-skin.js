const crypto = require("node:crypto");

const PRICE = 500;
const PREMIUM_SKINS = new Set([
  "snack-spirits", "garden-charms", "royal-blooms", "cozy-capybaras", "sky-friends", "forest-sprites", "ocean-minis", "tiny-dragons",
]);
const WALLET_ORIGIN = "https://mobile.mongolai.mn";

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function config() {
  return {
    serviceId: process.env.USION_SERVICE_ID || "",
    redisUrl: (
      process.env.KV_REST_API_URL ||
      process.env.UPSTASH_REDIS_REST_URL ||
      process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ||
      process.env.STORAGE_KV_REST_API_URL ||
      ""
    ).replace(/\/$/, ""),
    redisToken:
      process.env.KV_REST_API_TOKEN ||
      process.env.UPSTASH_REDIS_REST_TOKEN ||
      process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ||
      process.env.STORAGE_KV_REST_API_TOKEN ||
      "",
  };
}

async function redis(command, cfg) {
  const response = await fetch(cfg.redisUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const out = await response.json().catch(() => ({}));
  if (!response.ok || out.error) throw new Error("ENTITLEMENT_STORE_FAILED");
  return out.result;
}

async function wallet(path, payload) {
  const response = await fetch(`${WALLET_ORIGIN}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { response, body: await response.json().catch(() => ({})) };
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.length <= 8192) {
    try { return JSON.parse(req.body); } catch (_) { return null; }
  }
  return null;
}

module.exports = async function purchaseSkin(req, res) {
  const cfg = config();
  const ready = Boolean(cfg.serviceId && cfg.redisUrl && cfg.redisToken);

  if (req.method === "GET") return send(res, ready ? 200 : 503, { ready, price: PRICE });
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  if (!ready) return send(res, 503, { ok: false, error: "STORE_NOT_CONFIGURED" });

  const body = parseBody(req);
  const skinId = body && typeof body.skinId === "string" ? body.skinId : "";
  const receiptToken = body && typeof body.receiptToken === "string" ? body.receiptToken : "";
  if (!PREMIUM_SKINS.has(skinId) || receiptToken.length < 32 || receiptToken.length > 4096) {
    return send(res, 400, { ok: false, error: "INVALID_PURCHASE" });
  }

  const digest = crypto.createHash("sha256").update(receiptToken).digest("hex");
  const ledgerKey = `connect-four:skin-receipt:${digest}`;

  try {
    let raw = await redis(["GET", ledgerKey], cfg);
    let record = raw ? JSON.parse(raw) : null;
    if (record && record.skinId !== skinId) {
      return send(res, 409, { ok: false, error: "RECEIPT_ALREADY_BOUND" });
    }
    if (record && record.status === "settled") {
      return send(res, 200, { ok: true, skinId, recovered: true });
    }
    // A refunded receipt can never settle. Say so distinctly so the client
    // retires this purchase intent instead of replaying a dead token forever.
    if (record && record.status === "refunded") {
      return send(res, 409, { ok: false, error: "RECEIPT_REFUNDED" });
    }

    if (!record) {
      const verified = await wallet("/wallet/receipt/verify-pending", {
        receipt_token: receiptToken,
        expected_service_id: cfg.serviceId,
        expected_amount: PRICE,
      });
      // Only an explicit verdict from the wallet judges the receipt. A 404 or a
      // 5xx here is OUR outage — reporting it as a bad receipt would throw away
      // a charge the player already paid, so it stays retryable instead.
      const judged = verified.response.ok || verified.response.status === 409;
      if (!judged) {
        return send(res, 503, {
          ok: false,
          error: "VERIFY_UNAVAILABLE",
          detail: `verify-pending ${verified.response.status}`,
        });
      }
      const amount = Number(verified.body.amount);
      if (!verified.body.valid || (Number.isFinite(amount) && amount !== PRICE)) {
        return send(res, 409, {
          ok: false,
          error: "RECEIPT_NOT_PENDING",
          detail: [
            `verify-pending ${verified.response.status}`,
            verified.body.error || verified.body.detail || "",
            verified.body.status ? `receipt=${verified.body.status}` : "",
            Number.isFinite(amount) && amount !== PRICE ? `amount=${verified.body.amount}` : "",
          ].filter(Boolean).join(" "),
        });
      }

      record = {
        skinId,
        userId: verified.body.user_id,
        transactionId: verified.body.tx_id || null,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      const claimed = await redis(["SET", ledgerKey, JSON.stringify(record), "NX"], cfg);
      if (claimed !== "OK") {
        raw = await redis(["GET", ledgerKey], cfg);
        const winner = raw ? JSON.parse(raw) : null;
        if (!winner || winner.skinId !== skinId) {
          return send(res, 409, { ok: false, error: "RECEIPT_ALREADY_BOUND" });
        }
        record = winner;
      }
    }

    const settled = await wallet("/wallet/receipt/settle", { receipt_token: receiptToken });
    if (!settled.response.ok || !["settled", "already_settled"].includes(settled.body.outcome)) {
      if (settled.body.outcome === "already_refunded") {
        record.status = "refunded";
        await redis(["SET", ledgerKey, JSON.stringify(record)], cfg);
        return send(res, 409, { ok: false, error: "RECEIPT_REFUNDED" });
      }
      // Ambiguous — the hold may still be pending, so this stays retryable.
      return send(res, 409, {
        ok: false,
        error: "SETTLEMENT_FAILED",
        detail: `settle ${settled.response.status} ${settled.body.outcome || settled.body.error || ""}`.trim(),
      });
    }

    record.status = "settled";
    record.settledAt = new Date().toISOString();
    record.transactionId = settled.body.tx_id || record.transactionId;
    await redis(["SET", ledgerKey, JSON.stringify(record)], cfg);
    return send(res, 200, { ok: true, skinId });
  } catch (_) {
    return send(res, 503, { ok: false, error: "PURCHASE_SERVICE_UNAVAILABLE" });
  }
};
