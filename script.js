const ROWS = 6, COLS = 7;

// ── Game state ────────────────────────────────────────────
let board = [];
let current = 1;      // 1 = Red, 2 = Yellow
let gameOver = false;

// ── Multiplayer state ─────────────────────────────────────
let myId = null;
let myPlayer = 0;     // 1 or 2 (determined by join order)
let players = [];     // [p1_id, p2_id] — the seat order (player 1 = Red, player 2 = Yellow)
// The single canonical seat order, identical on every device and stable across
// reconnects. Seeded from config.playerIds (the platform roster) when available,
// otherwise from the host's checkpoint `order`. Slot assignment (myPlayer / host)
// must NEVER be re-derived from a per-client server ordering, or two clients can
// disagree on whose turn it is and deadlock (each thinks it's the opponent's move).
let canonicalRoster = null;
let playerNames = {};
let playerAvatars = {};
let isMultiplayer = false;
let waitingForOpponent = false;
let rematchRequested = false;
let lastWinnerPlayer = 0;
let lastSequence = 0; // Track last processed action sequence
let connectedCount = 0; // Live socket joins, not just authorized participants
let pendingMove = false; // Wait for server echo before allowing another multiplayer move
let lastAppliedSeq = 0; // Highest server move-sequence already reflected in `board` (secondary dedup).
// PRIMARY dedup: the set of moveIds already reflected in `board`. Each move carries a
// client-generated `moveId` in its action_data; the SDK preserves it verbatim through
// the echo, the durable log, and resync — UNLIKE the server `sequence`, which we found
// can arrive undefined on the mobile resume/redelivery path. When that happened, the
// seq-only guard (`seq && seq <= lastAppliedSeq`) was skipped for seq=0, so a buffered
// echo of our own last move dropped a SECOND disc on resume (the phantom "auto-insert",
// visible only on the device that came back from background). moveId dedup is
// seq-independent, so it holds even when the sequence is missing.
let appliedMoveIds = new Set();
let moveSerial = 0; // monotonic per-tap counter → unique moveId per move
const sessionNonce = Date.now().toString(36); // disambiguate moveIds across reloads/rematches
let lastSnapshotVersion = 0; // Ignore stale realtime board snapshots
// Highest snapshot version seen *per sender*. Snapshots are stamped with the
// sender's own Date.now(), which is only monotonic for that one client — never
// compare versions across two devices' clocks (skew silently drops valid moves).
let lastSnapshotVersionByPlayer = {};
let rematchState = "idle"; // idle | requested
let connectionPaused = false; // true while our socket is disconnected (block input)
let forfeitTimer = null;      // 20s grace countdown when the opponent leaves mid-game
const FORFEIT_GRACE_MS = 20000;

// ── DOM refs ──────────────────────────────────────────────
const boardEl          = document.getElementById("board");
const statusEl         = document.getElementById("status");
const diffSelect       = document.getElementById("difficulty");
const winnerBanner     = document.getElementById("winnerBanner");
const winnerNameDisplay= document.getElementById("winnerNameDisplay");
const winnerEmoji      = document.getElementById("winnerEmoji");
const winnerPlayAgain  = document.getElementById("winnerPlayAgain");

function showWinnerBanner() {
  if (winnerBanner) winnerBanner.hidden = false;
}

function hideWinnerBanner() {
  if (winnerBanner) winnerBanner.hidden = true;
}
const waitingOverlay   = document.getElementById("waitingOverlay");
const playBotBtn       = document.getElementById("playBotBtn");
const inviteBtn        = document.getElementById("inviteBtn");
const player1Avatar    = document.getElementById("player1Avatar");
const player2Avatar    = document.getElementById("player2Avatar");
const player1Name      = document.getElementById("player1Name");
const player2Name      = document.getElementById("player2Name");
const player1WinsEl    = document.querySelector("#player1Wins span");
const player2WinsEl    = document.querySelector("#player2Wins span");

// All-time win counts vs the current opponent (multiplayer only),
// indexed by player slot (1-based: [_, p1, p2]). Persisted in localStorage.
const playerWins = [0, 0, 0];
let winRecordedThisGame = false;

const player1WinsRow = document.getElementById("player1Wins");
const player2WinsRow = document.getElementById("player2Wins");

function setWinsVisibility(visible) {
  const display = visible ? "" : "none";
  if (player1WinsRow) player1WinsRow.style.display = display;
  if (player2WinsRow) player2WinsRow.style.display = display;
}

function updateWinCounts() {
  if (player1WinsEl) player1WinsEl.textContent = String(playerWins[1]);
  if (player2WinsEl) player2WinsEl.textContent = String(playerWins[2]);
}

function getOpponentId() {
  if (!isMultiplayer || !Array.isArray(players) || players.length < 2) return null;
  return players[0] === myId ? players[1] : players[0];
}

function storageKeyForOpponent(opponentId) {
  return "c4:wins:" + opponentId;
}

function loadWinsForOpponent(opponentId) {
  try {
    const raw = localStorage.getItem(storageKeyForOpponent(opponentId));
    if (!raw) return { mine: 0, theirs: 0 };
    const parsed = JSON.parse(raw);
    return {
      mine: Math.max(0, Number(parsed.mine) || 0),
      theirs: Math.max(0, Number(parsed.theirs) || 0),
    };
  } catch (_) {
    return { mine: 0, theirs: 0 };
  }
}

function saveWinsForOpponent(opponentId, mine, theirs) {
  try {
    localStorage.setItem(
      storageKeyForOpponent(opponentId),
      JSON.stringify({ mine, theirs })
    );
  } catch (_) { /* ignore quota / private mode */ }
}

function syncPlayerWinsFromStorage() {
  if (!isMultiplayer) return;
  const oppId = getOpponentId();
  if (!oppId || !myPlayer) return;
  const w = loadWinsForOpponent(oppId);
  const mySlot = myPlayer;
  const oppSlot = mySlot === 1 ? 2 : 1;
  playerWins[mySlot] = w.mine;
  playerWins[oppSlot] = w.theirs;
  updateWinCounts();
}

function persistCurrentWins() {
  if (!isMultiplayer) return;
  const oppId = getOpponentId();
  if (!oppId || !myPlayer) return;
  const mySlot = myPlayer;
  const oppSlot = mySlot === 1 ? 2 : 1;
  saveWinsForOpponent(oppId, playerWins[mySlot], playerWins[oppSlot]);
}

function recordWin(playerSlot) {
  if (winRecordedThisGame) return;
  if (playerSlot !== 1 && playerSlot !== 2) return;
  if (!isMultiplayer) return; // bot games don't count
  playerWins[playerSlot] += 1;
  winRecordedThisGame = true;
  updateWinCounts();
  persistCurrentWins();
}

// ── Usion capabilities: cloud stats · leaderboard · checkpoint ──
// All wrappers are defensive: missing modules / standalone preview must never
// throw (a thrown error in init blanks the game). They no-op gracefully.

let myStats = { wins: 0, losses: 0, draws: 0, games: 0 };
let statsRecordedThisGame = false;
const STATS_KEY = "c4:stats";

function isHostPlayer() {
  return isMultiplayer && Array.isArray(players) && players.length > 0 && players[0] === myId;
}

// Cross-device stats: prefer Cloud KV, fall back to localStorage cache.
async function loadStats() {
  try {
    if (window.Usion && Usion.cloud) {
      const remote = await Usion.cloud.get(STATS_KEY);
      if (remote && typeof remote === "object") {
        myStats = Object.assign(myStats, remote);
        try { localStorage.setItem(STATS_KEY, JSON.stringify(myStats)); } catch (_) {}
        return;
      }
    }
  } catch (_) {}
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) myStats = Object.assign(myStats, JSON.parse(raw));
  } catch (_) {}
}

function persistStats() {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(myStats)); } catch (_) {}
  try { if (window.Usion && Usion.cloud) Usion.cloud.set(STATS_KEY, myStats); } catch (_) {}
}

function submitLeaderboard() {
  try {
    if (window.Usion && Usion.leaderboard) {
      // Score = total wins; ranked highest-first. (Needs leaderboard.enabled on the service.)
      Usion.leaderboard.submit(myStats.wins);
    }
  } catch (_) {}
}

// Record MY outcome exactly once per multiplayer game (idempotent across replay).
function recordOutcome(winnerPlayer) {
  if (statsRecordedThisGame || !isMultiplayer) return;
  statsRecordedThisGame = true;
  myStats.games += 1;
  if (!winnerPlayer) {
    myStats.draws += 1;
  } else if (winnerPlayer === myPlayer) {
    myStats.wins += 1;
  } else {
    myStats.losses += 1;
  }
  persistStats();
  submitLeaderboard();
  reportMatchToDM(winnerPlayer); // Game Center drops a result card into both players' DM
  try { if (window.Usion && Usion.cloud && Usion.cloud.shared) Usion.cloud.shared.incr("games_total", 1); } catch (_) {}
}

// Report the final 1-on-1 result so the platform drops a result card into both
// players' direct chat ("You beat Bob" / "Bob beat you"), each written from
// their own perspective, with a tap-to-play button. Host-authoritative: only
// players[0] reports, exactly once per match; the backend re-validates the
// roster and dedupes. Skipped vs the local AI (no real opponent) and on
// non-1v1 rooms. Mirrors table_soccer's reportMatchToGameCenter.
let matchSeq = 0;              // per-match counter → unique matchId
let resultReportedThisGame = false;
function reportMatchToDM(winnerPlayer) {
  if (resultReportedThisGame) return;
  if (!isMultiplayer || players.length !== 2 || myId !== players[0]) return;
  if (!window.Usion || !Usion.game || typeof Usion.game.reportResult !== "function") return; // older injected SDK
  resultReportedThisGame = true;
  matchSeq++;
  try {
    // No numeric score in Connect Four — omit scores/displayScore so the card
    // shows just "You beat X" / "X beat you" with no "0 : 0" line.
    var payload = { matchId: "c4-" + matchSeq };
    if (!winnerPlayer) {
      payload.draw = true;
    } else {
      payload.winnerId = players[winnerPlayer - 1];
    }
    Usion.game.reportResult(payload).catch(function () {}); // fire-and-forget — never block the win screen
  } catch (e) { /* ignore */ }
}

// Persist authoritative state so a reconnecting/returning client rebuilds from it.
//
// ⚠️ HOST-ONLY. `Usion.game.setState` is accepted by the server ONLY from the host
// (`playerIds[0]`); a guest's call is a silent no-op. (An earlier version tried to
// make this "actor-written" — every mover checkpoints — but that was validated by a
// node-sim that let any client checkpoint; on the real platform the guest writes were
// dropped, so the checkpoint only ever advanced on host moves anyway.) Because the
// checkpoint therefore LAGS by the opponent's moves made since the host's last move,
// `onSync` never trusts it as the whole story: it rebuilds as `checkpoint base + the
// post-checkpoint tail`, so the lagging moves (which live in the tail) are replayed.
// The snapshot still carries `moveIds` + `seq` (dedup watermarks) so the INCLUSIVE
// sync tail — the server re-sends the checkpoint's own last move — is recognised as
// already applied instead of stacking a duplicate disc.
function writeCheckpoint() {
  if (!isMultiplayer || !isHostPlayer()) return;
  try {
    if (window.Usion && Usion.game && Usion.game.setState) Usion.game.setState(getBoardSnapshot());
  } catch (_) {}
}

// ── Usion Init ────────────────────────────────────────────

Usion.init(async function(config) {
  myId = config.userId;
  playerNames[myId] = config.userName || "You";
  if (config.userAvatar) playerAvatars[myId] = config.userAvatar;
  if (config.playerIds && config.playerIds.length) {
    canonicalRoster = config.playerIds.slice(); // platform roster — identical on every device, stable across reconnects
    players = canonicalRoster.slice();
  }
  loadStats(); // fire-and-forget; never block init/render

  // Register the solo→host promotion handler UP FRONT, regardless of launch mode
  // (SDK ≥ 2.20). A game opened solo from Explore can be promoted into a live room
  // mid-session when the user taps the host's top-bar Share button — never gate the
  // multiplayer-handler wiring on launch mode.
  try {
    if (Usion.game && Usion.game.onRoomAssigned) Usion.game.onRoomAssigned(() => onRoomPromoted());
  } catch (_) {}

  // Only a real multiplayer launch (a chat game invite) goes online. A solo launch
  // (Explore / the Game hub) plays the bot even if it was handed a standalone room
  // for SDK plumbing — trusting roomId alone would strand it in the "waiting for
  // opponent" overlay forever. Trust the launch MODE.
  if (!launchedSolo(config) && config.roomId) {
    showWaiting();
    await setupMultiplayer(config.roomId);
  } else {
    hideWaiting();
    syncControlVisibility();
    setPlayerDisplayBot();
    init();
  }
});

// Did the platform open us solo (Explore / Game hub) rather than a chat game
// invite? Trust the launch MODE — never infer from roomId alone, since a solo
// launch may still receive an auto-created standalone_ room for SDK plumbing.
function launchedSolo(config) {
  try {
    let lp = {};
    if (window.Usion && typeof Usion.getLaunchParams === "function") lp = Usion.getLaunchParams() || {};
    if (lp.mode === "single") return true;
    if (lp.mode === "multiplayer") return false;
    if (window.Usion && Usion.game && typeof Usion.game.isMultiplayer === "function")
      return !Usion.game.isMultiplayer();
    const rid = config && config.roomId ? String(config.roomId) : "";
    return !rid || /^standalone[_-]/i.test(rid);
  } catch (_) { return false; }
}

// ── Multiplayer ───────────────────────────────────────────

// All net handlers in one place, registered exactly once. Kept separate from
// setupMultiplayer so a promoted solo launch (onRoomPromoted) can register them
// too — per the multiplayer contract, never gate handler registration on mode.
let netHandlersRegistered = false;
function registerGameHandlers() {
  if (netHandlersRegistered) return;
  netHandlersRegistered = true;
  Usion.game.onJoined(onJoined);
  Usion.game.onPlayerJoined(onPlayerJoined);
  Usion.game.onPlayerLeft(onPlayerLeft);
  Usion.game.onAction(onAction);
  Usion.game.onSync(onSync);
  Usion.game.onRealtime(onRealtime);
  Usion.game.onRematchRequest(onRematchRequest);
  Usion.game.onGameRestarted(onGameRestarted);
  // Surface send failures for observability (SDK ≥ 2.22). Moves ride the durable
  // action() channel and recover via onSync/onReconnect, so we just log here.
  try {
    if (Usion.game.onError) Usion.game.onError((e) => {
      try { console.warn("game error:", e && e.code, e && e.message); } catch (_) {}
    });
  } catch (_) {}
  Usion.game.onDisconnect(() => {
    // Real pause: block our own input until we're back online (we can't trust
    // local state while disconnected — the opponent may have moved).
    connectionPaused = true;
    pendingMove = false;
    if (!gameOver) updateStatus("Connection lost…");
  });
  Usion.game.onReconnect(() => {
    connectionPaused = false;
    // Re-sync on reconnect to catch missed actions / the host checkpoint.
    Usion.game.requestSync(0);
    if (!gameOver) updateStatus();
  });
}

async function setupMultiplayer(roomId) {
  try {
    await Usion.game.connect();
    registerGameHandlers();
    await Usion.game.join(roomId);
  } catch (err) {
    console.error("Multiplayer setup failed:", err);
    hideWaiting();
    syncControlVisibility();
    setPlayerDisplayBot();
    init();
  }
}

// Solo → host promotion (SDK ≥ 2.20): the user tapped the host's top-bar Share
// button mid-solo and invited someone. The SDK has ALREADY updated
// getLaunchParams().roomId/.mode and is connect()+join()ing us as playerIds[0] —
// we do NOT connect/join again (that would race the SDK's own join). We just flip
// from the local bot game into the online waiting room and register the net
// handlers; onJoined lands right after and the normal online flow (roster
// reconcile → startOnlineGame) takes over. requestSync is a harmless idempotent
// safety net in case the auto-join fired before our handlers were wired.
function onRoomPromoted() {
  if (isMultiplayer) return;   // already online — nothing to flip
  // Re-seed the canonical roster from the freshly-assigned platform roster so the
  // seat order (player 1/2) is identical on every device.
  try {
    const ids = (Usion.config && Usion.config.playerIds) || [];
    if (ids && ids.length) { canonicalRoster = ids.slice(); players = canonicalRoster.slice(); }
  } catch (_) {}
  waitingForOpponent = true;
  pendingMove = false;
  init();                 // reset to a clean board for the online match
  showWaiting();
  registerGameHandlers();
  try { if (Usion.game && Usion.game.requestSync) Usion.game.requestSync(0); } catch (_) {}
}

// ── Foreground catch-up ───────────────────────────────────
// A backgrounded WebView is suspended and can miss the live `move` actions the
// host relays during the gap. RN WebViews do NOT fire `visibilitychange` on app
// background/foreground, and a quick (<3s) app-switch never trips a socket
// reconnect — so without this a player who switches apps mid-game returns to a
// stale board with no recovery. On every return to the foreground pull a fresh
// sync; onSync rebuilds authoritatively from the action log, so an extra sync is
// a harmless no-op. (>3s backgrounds are also covered by onReconnect.)
function foregroundResync() {
  if (!isMultiplayer || gameOver) return;
  connectionPaused = false;
  try { if (window.Usion && Usion.game && Usion.game.requestSync) Usion.game.requestSync(0); } catch (_) {}
  if (!gameOver) updateStatus();
}
// Web fires visibilitychange on tab refocus — use it there.
if (typeof document !== "undefined" && document.addEventListener) {
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") foregroundResync();
  });
}
// Mobile: RN WebViews don't fire visibilitychange on app foreground, so detect
// the resume from a wall-clock jump (our JS was frozen while backgrounded) and
// pull a sync — retrying a few times while the host socket finishes reconnecting.
(function resumeWatchdog() {
  var lastBeat = Date.now();
  setInterval(function () {
    var now = Date.now();
    var gap = now - lastBeat;
    lastBeat = now;
    if (gap > 3000 && isMultiplayer && !gameOver) {
      foregroundResync();
      setTimeout(foregroundResync, 1500);
      setTimeout(foregroundResync, 3500);
    }
  }, 1000);
})();

// Reconcile the server's id list into `players` WITHOUT disturbing the canonical
// seat order. When we have a canonical roster (config / checkpoint), we keep that
// order and only append ids we hadn't seen; otherwise we adopt the server order
// (first join only). This is what keeps player 1/2 — and therefore myPlayer and
// whose-turn-it-is — identical on both devices across reconnects.
function reconcilePlayers(idsFromServer) {
  const ids = Array.isArray(idsFromServer) ? idsFromServer.filter(Boolean) : [];
  if (canonicalRoster && canonicalRoster.length) {
    players = canonicalRoster.slice();
    ids.forEach((id) => { if (!players.includes(id)) players.push(id); });
  } else if (ids.length) {
    players = ids.slice();
  }
}

function onJoined(data) {
  Usion.log("onJoined: " + JSON.stringify({
    player_ids: data.player_ids,
    sequence: data.sequence,
    status: data.status,
    connected_count: data.connected_count
  }));
  reconcilePlayers(data.player_ids);
  connectedCount = Number(data.connected_count || 0);
  if (data.sequence !== undefined) lastSequence = data.sequence;

  // Announce our identity to the room
  Usion.game.realtime("player_info", {
    name: playerNames[myId],
    avatar: playerAvatars[myId] || null
  });

  if (connectedCount >= 2 && waitingForOpponent) {
    startOnlineGame();
  } else if (waitingForOpponent && data.game_state && Array.isArray(data.game_state.board)) {
    // A host checkpoint in the join ack means a match is already underway — rejoin
    // it even if the live connected_count momentarily reads 1 (opponent not yet
    // counted). startOnlineGame → requestSync(0) → onSync rebuilds from it.
    startOnlineGame();
  }
}

function onPlayerJoined(data) {
  Usion.log("onPlayerJoined: " + JSON.stringify({
    player_ids: data.player_ids,
    player: data.player
  }));
  // Reconcile into the canonical seat order (never blindly adopt the server's
  // per-client ordering — that's what made the two devices disagree on turns).
  if (data.player_ids) {
    reconcilePlayers(data.player_ids);
  } else if (data.player && data.player.id && !players.includes(data.player.id)) {
    players.push(data.player.id);
  }
  // Presence from any signal the SDK gives us (don't depend solely on the
  // possibly-absent nested is_connected, or forfeit-cancel can fail to fire).
  if (typeof data.connected_count === "number") connectedCount = Math.max(connectedCount, data.connected_count);
  if (Array.isArray(data.player_ids) && data.player_ids.length >= 2) connectedCount = Math.max(connectedCount, 2);
  if (data.player && data.player.is_connected) connectedCount = Math.max(connectedCount, 2);
  // Re-broadcast our identity to the new joiner
  Usion.game.realtime("player_info", {
    name: playerNames[myId],
    avatar: playerAvatars[myId] || null
  });
  // Opponent came back during the forfeit grace window → cancel and resync.
  if (connectedCount >= 2 && forfeitTimer) {
    clearForfeitGrace();
    if (!gameOver) { updateStatus(); Usion.game.requestSync(0); }
  }
  if (connectedCount >= 2 && waitingForOpponent) {
    startOnlineGame();
  }
}

// ── Forfeit grace period ──────────────────────────────────
// When the opponent leaves mid-game, defer the result for a grace window so a
// quick rejoin resumes the game untouched. If they don't return, the remaining
// player wins by forfeit. (Mirrors 13 / mini_golf.)
function clearForfeitGrace() {
  if (forfeitTimer) { clearInterval(forfeitTimer); forfeitTimer = null; }
}

function startForfeitGrace() {
  if (forfeitTimer) clearInterval(forfeitTimer);
  let secs = Math.ceil(FORFEIT_GRACE_MS / 1000);
  updateStatus("Opponent left — waiting to rejoin… (" + secs + "s)");
  forfeitTimer = setInterval(() => {
    if (gameOver || connectedCount > 1) { // resolved or opponent returned
      clearForfeitGrace();
      if (!gameOver) updateStatus();
      return;
    }
    secs -= 1;
    if (secs > 0) {
      updateStatus("Opponent left — waiting to rejoin… (" + secs + "s)");
      return;
    }
    clearForfeitGrace();
    forfeitToMe();
  }, 1000);
}

function forfeitToMe() {
  if (gameOver || !isMultiplayer || !myPlayer) return;
  gameOver = true;
  lastWinnerPlayer = myPlayer;
  recordWin(myPlayer);
  recordOutcome(myPlayer);
  updateStatus("🎉 You win! (opponent left)");
  showWinnerOverlay();
}

function onPlayerLeft(data) {
  connectedCount = Math.max(0, connectedCount - 1);
  if (gameOver) return;
  if (isMultiplayer && myPlayer && connectedCount <= 1) {
    // Decisive: only we remain. Hold a grace window before declaring forfeit so
    // a quick rejoin resumes the game exactly where it was.
    startForfeitGrace();
  } else {
    updateStatus("Opponent left the game");
  }
}

// Apply ONE durably-sequenced move (own or opponent) exactly once. The server
// `seq` is monotonic, so a move we've already reflected — because onSync replayed
// it, or because it was redelivered after we resumed from background — is skipped
// here instead of dropping a second disc. This is the single funnel every move
// (including our own) flows through: we never place a disc optimistically anymore,
// so there is no local state to roll back and re-apply (the source of the phantom
// "auto-inserted" disc + turn break when returning from another app).
function applyDurableMove(playerId, col, seq, moveId) {
  const mine = playerId === myId;
  if (mine) pendingMove = false;           // our move came back from the server → unlock
  if (!isMultiplayer || gameOver) return;
  if (moveId && appliedMoveIds.has(moveId)) return; // PRIMARY dedup (seq-independent)
  if (seq && seq <= lastAppliedSeq) return;          // secondary dedup (when moveId absent)
  if (typeof col !== "number") return;
  if (board[0][col] !== 0) {                // column full / out of sync — record id, don't drop
    if (moveId) appliedMoveIds.add(moveId);
    if (seq) lastAppliedSeq = Math.max(lastAppliedSeq, seq);
    return;
  }
  if (moveId) appliedMoveIds.add(moveId);
  if (seq) lastAppliedSeq = Math.max(lastAppliedSeq, seq);
  handleMove(col, false);                   // animate, advance turn, detect win/draw
  // The HOST refreshes the server checkpoint after EVERY move it applies — its own
  // AND the opponent's (relayed here via onAction). `setState` is host-only, so this
  // self-gates (writeCheckpoint no-ops for the guest). Checkpointing on every move,
  // not just the host's own, keeps the checkpoint from lagging by the opponent's
  // latest move, so the post-checkpoint tail onSync replays stays minimal.
  writeCheckpoint();
}

function onAction(data) {
  Usion.log("onAction: type=" + data.action_type + " player=" + data.player_id + " myId=" + myId + " seq=" + data.sequence);
  if (data.sequence !== undefined) lastSequence = Math.max(lastSequence, data.sequence);
  if (data.action_type !== "move") return;
  const col = data.action_data && data.action_data.col;
  const moveId = data.action_data && data.action_data.moveId;
  applyDurableMove(data.player_id, col, Number(data.sequence) || 0, moveId);
}

function discCount(b) {
  let n = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (b[r][c]) n++;
  return n;
}

// Drop the current player's disc into `col` on the GLOBAL board, advancing the
// turn and detecting win/draw exactly like a live move but without animation.
// Returns true if the game just ended (caller should stop replaying).
function replayMoveSilent(col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] !== 0) continue;
    board[r][col] = current;
    lastInsertedPos = { r, c: col };
    if (checkWin(r, col, current)) {
      gameOver = true;
      lastWinnerPlayer = current;
      recordWin(current);
      recordOutcome(current);
      return true;
    }
    if (isFull()) {
      gameOver = true;
      recordOutcome(0);
      return true;
    }
    current = current === 1 ? 2 : 1;
    return false;
  }
  return false; // column full / invalid — skip
}

function finalizeSyncRender() {
  renderBoard();
  if (gameOver && lastWinnerPlayer) {
    const cells = findWinningCells(lastWinnerPlayer);
    for (const [row, col] of cells) {
      const el = boardEl.children[row * COLS + col];
      if (el) el.classList.add("winner");
    }
    const winnerId = isMultiplayer ? players[lastWinnerPlayer - 1] : null;
    const name = isMultiplayer
      ? playerLabelForStatus(winnerId, lastWinnerPlayer === 1 ? "Red" : "Yellow")
      : (lastWinnerPlayer === 1 ? "Red" : "Yellow");
    updateStatus("🎉 " + name + " wins!");
    showWinnerOverlay();
  } else if (gameOver) {
    updateStatus("Draw!");
  } else {
    updateStatus();
  }
  // Do NOT write a checkpoint here: a rebuild from sync must not re-persist state (it
  // can race a fresher actor checkpoint backwards). Only the actor writes, on its move.
}

function onSync(data) {
  Usion.log("onSync: actions=" + (data.actions ? data.actions.length : 0) + " seq=" + data.sequence + " checkpoint=" + !!(data.game_state && data.game_state.board));
  // Nothing newer than we've already applied? No-op. The resume watchdog fires
  // requestSync several times and stale replies land after we've caught up; each
  // rebuild would clear pendingMove (letting us double-tap our own turn) and re-render
  // for nothing. A genuinely newer checkpoint always has seq > lastSequence, so this
  // never skips real recovery. (Mirrors 13's `syncTop <= lastSeq` guard.)
  const syncTop = data.sequence !== undefined ? Number(data.sequence) : null;
  if (syncTop !== null && syncTop <= lastSequence) return;
  pendingMove = false;
  if (syncTop !== null) {
    lastSnapshotVersion = Math.max(lastSnapshotVersion, syncTop);
    lastSequence = syncTop;
  }

  const moveActions = (data.actions || []).filter(
    (a) => a.action_type === "move" && a.action_data && a.action_data.col !== undefined
  );
  const cp = (data.game_state && Array.isArray(data.game_state.board)) ? data.game_state : null;
  if (!cp && moveActions.length === 0) return; // nothing to rebuild from

  // Replay one tail move, deduped, recording its id/seq so a later onAction echo of
  // it is skipped. Returns true when the game just ended (caller stops replaying).
  function replayTail(a) {
    const mid = a.action_data && a.action_data.moveId;
    if (mid) {
      if (appliedMoveIds.has(mid)) return false; // already applied → collapse
      appliedMoveIds.add(mid);
    }
    if (a.sequence) lastAppliedSeq = Math.max(lastAppliedSeq, Number(a.sequence) || 0);
    return replayMoveSilent(a.action_data.col);
  }

  if (cp) {
    // ALWAYS reconstruct as: host checkpoint (the authoritative base) + ONLY the
    // moves that come AFTER it (the tail). `setState` is HOST-ONLY (playerIds[0]),
    // so the server checkpoint advances only on the host's moves and `data.actions`
    // is the POST-CHECKPOINT TAIL the server kept — NOT the full history. The old
    // code had two wrong paths for this:
    //   • "full replay from an empty board" dropped every PRE-checkpoint move → the
    //     board came back SHORT (under-count / desync), and
    //   • replaying an INCLUSIVE tail (the server re-sends the checkpoint's own last
    //     move) onto the checkpoint DOUBLED moves → the "too many disks" phantom that
    //     then got persisted into the next checkpoint and snowballed.
    // The checkpoint can lag by the opponent's most recent moves (made while the host
    // was backgrounded); those live in the tail and are applied below.
    applyCheckpoint(cp);                 // base board + current + dedup watermarks (moveIds/seq)
    const baseCount = discCount(board);  // moves already baked into the checkpoint
    // The checkpoint's sequence watermark. `sequence` resets per game (rematch) and
    // only `move` actions are durable, so it equals the baked-in move count; take the
    // max so a stored cp.seq can only raise, never undercount, the boundary.
    const baseSeq = Math.max(Number(cp.seq) || 0, baseCount);
    for (const a of moveActions) {
      const s = Number(a.sequence) || 0;
      const mid = a.action_data && a.action_data.moveId;
      // Apply a tail move ONLY if we can PROVE it post-dates the checkpoint base:
      //   • its sequence is beyond the base watermark, OR
      //   • its moveId hasn't been applied yet (covers the resume path where the SDK
      //     drops `sequence`; cp.moveIds seeds appliedMoveIds via applyCheckpoint).
      // If neither is determinable, SKIP — trust the checkpoint. A genuinely-new move
      // missed here is recovered by the next sync; a duplicated disc would corrupt the
      // board permanently (it gets persisted into the next checkpoint).
      const isNew = (s && s > baseSeq) || (mid && !appliedMoveIds.has(mid));
      if (!isNew) continue;
      if (replayTail(a)) break;
    }
    finalizeSyncRender();
    return;
  }

  // No checkpoint yet (early game, host hasn't checkpointed): the log IS the full
  // history from move 1, so replay it from an empty board.
  lastAppliedSeq = 0;
  appliedMoveIds = new Set();
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  current = 1;
  gameOver = false;
  lastWinnerPlayer = 0;
  lastInsertedPos = null;
  for (const a of moveActions) {
    if (replayTail(a)) break;
  }
  finalizeSyncRender();
}

function onRealtime(data) {
  if (data.action_type === "player_info" && data.player_id !== myId) {
    if (data.action_data.name)   playerNames[data.player_id]   = data.action_data.name;
    if (data.action_data.avatar) playerAvatars[data.player_id] = data.action_data.avatar;
    updatePlayerDisplay();
    return;
  }

  if (data.action_type === "board_state" && data.action_data) {
    if (data.player_id === myId) return;
    applyBoardSnapshot(data.action_data, data.player_id);
    return;
  }

  if (data.action_type === "rematch_state" && data.action_data) {
    applyRematchState(data.action_data);
  }
}

function onRematchRequest(data) {
  if (data.player_id === myId) return;
  if (rematchRequested) {
    resetForRematch();
    broadcastBoardSnapshot();
    return;
  }
  rematchState = "requested";
  syncRematchUi();
}


function onGameRestarted() {
  resetForRematch();
}

function startOnlineGame() {
  isMultiplayer = true;
  waitingForOpponent = false;

  myPlayer = players.indexOf(myId) + 1; // 1 or 2

  updatePlayerDisplay();
  setWinsVisibility(true);
  syncPlayerWinsFromStorage();
  hideWaiting();
  syncControlVisibility();
  init();

  // Always sync once at game start so a move sent during the join race is replayed.
  Usion.game.requestSync(0);
}

function updatePlayerDisplay() {
  const p1id = players[0];
  const p2id = players[1];

  if (p1id) {
    const isMe = p1id === myId;
    player1Name.textContent = isMe ? "You" : (playerNames[p1id] || "Opponent");
    if (playerAvatars[p1id]) player1Avatar.src = playerAvatars[p1id];
  }
  if (p2id) {
    const isMe = p2id === myId;
    player2Name.textContent = isMe ? "You" : (playerNames[p2id] || "Opponent");
    if (playerAvatars[p2id]) player2Avatar.src = playerAvatars[p2id];
  }
}

function setPlayerDisplayBot() {
  player1Name.textContent = playerNames[myId] || "You";
  player2Name.textContent = "Bot";
  if (playerAvatars[myId]) player1Avatar.src = playerAvatars[myId];
  player2Avatar.src = "https://api.dicebear.com/7.x/bottts/svg?seed=bot";
  setWinsVisibility(false);
}

// ── Waiting overlay ───────────────────────────────────────

function showWaiting() {
  waitingForOpponent = true;
  waitingOverlay.classList.add("show");
  // The invite button opens the platform's friend/group picker (Usion.game.invite)
  // — never a custom UI. The host's top-bar Share button does the same; both are
  // the platform's. Show it only when the SDK actually supports invite().
  if (inviteBtn) {
    const canInvite = typeof Usion !== "undefined" && Usion.game && typeof Usion.game.invite === "function";
    inviteBtn.classList.toggle("hidden", !canInvite);
  }
}

function hideWaiting() {
  waitingOverlay.classList.remove("show");
}

if (inviteBtn) {
  inviteBtn.addEventListener("click", () => {
    try {
      inviteBtn.disabled = true;
      Promise.resolve(Usion.game.invite()).catch(() => {}).finally(() => { inviteBtn.disabled = false; });
    } catch (_) { inviteBtn.disabled = false; }
  });
}

playBotBtn.addEventListener("click", () => {
  // Bot interlude: stay in the room and keep `waitingForOpponent = true` so
  // `onPlayerJoined` will purge this bot game and call `startOnlineGame()`
  // the moment the friend arrives.
  isMultiplayer = false;
  pendingMove = false;
  hideWaiting();
  syncControlVisibility();
  setPlayerDisplayBot();
  init();
});

// ── Controls ──────────────────────────────────────────────

function syncControlVisibility() {
  diffSelect.style.display = isMultiplayer ? "none" : "";
}

// ── Rematch ───────────────────────────────────────────────

function requestRematch() {
  rematchRequested = true;
  rematchState = "requested";
  syncRematchUi();
  broadcastRematchState();
  Usion.game.requestRematch();
}

function acceptRematch() {
  rematchRequested = true;
  resetForRematch();
  broadcastBoardSnapshot();
  Usion.game.requestRematch();
}

function resetForRematch() {
  rematchRequested = false;
  rematchState = "idle";
  pendingMove = false;
  lastSnapshotVersion = 0;
  hideWinnerBanner();
  winnerPlayAgain.textContent = "Rematch";
  winnerPlayAgain.disabled = false;
  winnerPlayAgain.onclick = requestRematch;
  init();
}


// ── Game Core ─────────────────────────────────────────────

function init() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  current = 1;
  gameOver = false;
  pendingMove = false;
  lastAppliedSeq = 0;
  appliedMoveIds = new Set();
  lastWinnerPlayer = 0;
  lastSnapshotVersion = 0;
  lastSnapshotVersionByPlayer = {};
  rematchState = "idle";
  lastInsertedPos = null;
  winRecordedThisGame = false;
  statsRecordedThisGame = false;
  resultReportedThisGame = false;
  clearForfeitGrace();
  hideWinnerBanner();
  renderBoard();
  updateStatus();
  updateWinCounts();
}


let lastInsertedPos = null; // {r, c} of the most recently placed disk

function renderBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = r;
      cell.dataset.col = c;
      if (board[r][c]) {
        cell.dataset.player = board[r][c];
        if (lastInsertedPos && lastInsertedPos.r === r && lastInsertedPos.c === c) {
          cell.classList.add("last-inserted");
        }
      }
      boardEl.appendChild(cell);
    }
  }
}

function playerLabelForStatus(playerId, fallback) {
  if (!playerId) return fallback || "Player";
  return playerNames[playerId] || fallback || "Player";
}

function updateStatus(text) {
  if (text) { statusEl.textContent = text; return; }
  // While the opponent is gone, the grace countdown owns the status line — don't
  // let a stray resync overwrite the "paused / waiting to rejoin" message.
  if (forfeitTimer && !gameOver) return;

  if (isMultiplayer) {
    if (gameOver) {
      if (lastWinnerPlayer) {
        const winnerId = players[lastWinnerPlayer - 1];
        updateStatus("🎉 " + playerLabelForStatus(winnerId, "Winner") + " wins!");
      } else {
        updateStatus("Draw!");
      }
      return;
    }

    const currentPlayerId = players[current - 1];
    const currentPlayerName = playerLabelForStatus(currentPlayerId, current === 1 ? "Red" : "Yellow");
    const color = current === 1 ? "#ff2e2e" : "#ffc400";
    statusEl.innerHTML = '<span style="color:' + color + ';font-weight:700;">' + currentPlayerName + '</span>\'s turn';
    return;
  }

  if (gameOver) return;
  const name  = current === 1 ? "Red" : "Yellow";
  const color = current === 1 ? "#ff2e2e" : "#ffc400";
  statusEl.innerHTML = '<span style="color:' + color + ';font-weight:700;">' + name + '</span>\'s turn';
}


boardEl.addEventListener("click", (e) => {
  if (gameOver) return;

  const cell = e.target.closest(".cell");
  if (!cell) return;
  const col = Number(cell.dataset.col);

  if (isMultiplayer) {
    if (connectionPaused) return;  // paused while OUR socket is offline; wait for resync
    if (forfeitTimer) return;      // paused while the opponent is gone (grace countdown running)
    if (current !== myPlayer || pendingMove) return;
    if (board[0][col] !== 0) return;        // column full
    // No optimistic placement. We lock input (pendingMove) and place our disc only
    // when the server echoes the move back through the DURABLE, sequenced channel
    // (applyDurableMove via onAction). Both devices then apply the identical move
    // from the identical source, keyed by the same sequence — so there is nothing
    // to roll back if we background mid-move, and no second channel that can drop a
    // duplicate disc on resume. The ~1 RTT before our disc appears is the correct
    // trade for a turn-based game that must never desync. If the send fails we
    // unlock and resync; if the echo is lost, onSync/onReconnect recovers it.
    pendingMove = true;
    // Stable per-tap id: survives SDK re-sends (same payload) and round-trips through
    // the echo + durable log + resync, so the move is applied exactly once everywhere.
    const moveId = myId + ":" + sessionNonce + ":" + (++moveSerial);
    Usion.game.action("move", { col, moveId }).catch((err) => {
      pendingMove = false;
      Usion.log("move send failed: " + (err && err.message ? err.message : err));
      Usion.game.requestSync(0);
    });
    return;
  }

  if (current === 2) return; // bot's turn
  handleMove(col, true);
});

function cloneBoardState() {
  return board.map((row) => row.slice());
}

function getBoardSnapshot() {
  return {
    board: cloneBoardState(),
    current,
    gameOver,
    lastWinnerPlayer,
    lastInsertedPos,
    winnerOverlayVisible: gameOver,
    rematchState,
    order: players.slice(), // authoritative seat order, so a rejoiner restores the same player 1/2 mapping
    moveIds: Array.from(appliedMoveIds), // dedup watermark: which moves this board already bakes in
    seq: lastAppliedSeq,                 // secondary watermark (when moveId is absent)
    version: Date.now(),
  };
}

function broadcastBoardSnapshot() {
  if (!isMultiplayer) return;
  const snapshot = getBoardSnapshot();
  lastSnapshotVersion = Math.max(lastSnapshotVersion, Number(snapshot.version) || 0);
  Usion.game.realtime("board_state", snapshot);
}

function broadcastRematchState() {
  if (!isMultiplayer) return;
  Usion.game.realtime("rematch_state", { state: rematchState });
}

function syncRematchUi() {
  if (!isMultiplayer || !gameOver) return;

  if (rematchState === "requested") {
    if (rematchRequested) {
      winnerPlayAgain.textContent = "Waiting for rematch...";
      winnerPlayAgain.disabled = true;
      winnerPlayAgain.onclick = requestRematch;
    } else {
      winnerPlayAgain.textContent = "Accept Rematch";
      winnerPlayAgain.disabled = false;
      winnerPlayAgain.onclick = acceptRematch;
    }
    return;
  }

  winnerPlayAgain.textContent = "Rematch";
  winnerPlayAgain.disabled = false;
  winnerPlayAgain.onclick = requestRematch;
}

function showWinnerOverlay() {
  if (!gameOver || !lastWinnerPlayer) return;

  const winnerId = isMultiplayer ? players[lastWinnerPlayer - 1] : null;
  const winnerName = isMultiplayer
    ? playerLabelForStatus(winnerId, lastWinnerPlayer === 1 ? "Red" : "Yellow")
    : (lastWinnerPlayer === 1 ? "Red" : "Yellow");
  const color = lastWinnerPlayer === 1 ? "#ff4444" : "#ffc400";

  winnerNameDisplay.textContent = winnerName;
  winnerNameDisplay.style.color = color;
  winnerEmoji.textContent = lastWinnerPlayer === 1 ? "🔴" : "🟡";
  showWinnerBanner();
  syncRematchUi();
}

function applyRematchState(payload) {
  const nextState = String(payload.state || "idle");
  if (!["idle", "requested"].includes(nextState)) return;
  rematchState = nextState;
  syncRematchUi();
}

// Rebuild the board from a host checkpoint delivered as game_state on join/sync.
// The checkpoint shape is a board snapshot (see getBoardSnapshot), so reuse the
// same apply path used for realtime snapshots. Returns true if applied.
function applyCheckpoint(state) {
  if (!state || typeof state !== "object" || !Array.isArray(state.board)) return false;
  isMultiplayer = true;
  // trusted=true: the onSync `game_state` is the SERVER's authoritative latest. Now
  // that BOTH players write checkpoints (actor-written), attributing every checkpoint
  // to the host id and applying the per-sender clock guard would let a skewed clock
  // drop a valid newer checkpoint. The server already resolved last-writer-wins, so
  // bypass the realtime ordering guard here.
  applyBoardSnapshot(state, state.order && state.order[0] ? state.order[0] : (players[0] || "host"), true);
  return true;
}

function applyBoardSnapshot(snapshot, senderId, trusted) {
  const version = Number(snapshot.version || 0);
  // Order snapshots per-sender: each sender's own clock is monotonic, so this
  // drops only genuinely out-of-order packets from THAT player. Comparing across
  // two devices' clocks (skew) used to drop valid moves and deadlock the game.
  // Skipped for `trusted` (server-authoritative checkpoint) snapshots.
  const prevFromSender = lastSnapshotVersionByPlayer[senderId] || 0;
  if (!trusted && version && version < prevFromSender) return;
  if (senderId) lastSnapshotVersionByPlayer[senderId] = Math.max(prevFromSender, version);
  lastSnapshotVersion = Math.max(lastSnapshotVersion, version);
  // Adopt the sender's authoritative seat order so player 1/2 — and therefore
  // myPlayer and whose-turn — stay identical on both devices. A canonical roster
  // (config.playerIds) already pins this; the snapshot order covers the rest and
  // self-heals a client whose order diverged after a reconnect (the deadlock fix).
  if (!(canonicalRoster && canonicalRoster.length) && Array.isArray(snapshot.order) && snapshot.order.length >= 2) {
    players = snapshot.order.slice();
    if (myId) myPlayer = players.indexOf(myId) + 1;
  }
  if (Array.isArray(snapshot.board)) {
    board = snapshot.board.map((row) => Array.isArray(row) ? row.slice() : Array(COLS).fill(0));
  }
  // Adopt the dedup watermarks the snapshot/checkpoint carries. This is THE fix for
  // the host-resume phantom: the checkpoint bakes its moves into `board`, and the
  // INCLUSIVE sync tail re-sends the checkpoint's own last move — so unless we know
  // those moves are "already applied", onSync replays them again and stacks a
  // duplicate disc (seen only on the device returning from background, since it is
  // the one that re-syncs). A fresh/empty board (rematch) has no watermarks → reset.
  if (discCount(board) === 0 && !snapshot.gameOver) {
    lastAppliedSeq = 0; appliedMoveIds = new Set();
  } else {
    appliedMoveIds = new Set(Array.isArray(snapshot.moveIds) ? snapshot.moveIds : []);
    lastAppliedSeq = Number(snapshot.seq) || lastAppliedSeq;
  }
  current = snapshot.current === 2 ? 2 : 1;
  gameOver = !!snapshot.gameOver;
  lastWinnerPlayer = snapshot.lastWinnerPlayer === 2 ? 2 : (snapshot.lastWinnerPlayer === 1 ? 1 : 0);
  rematchState = ["idle", "requested"].includes(snapshot.rematchState) ? snapshot.rematchState : rematchState;
  pendingMove = false;
  if (snapshot.lastInsertedPos && typeof snapshot.lastInsertedPos.r === "number") {
    lastInsertedPos = snapshot.lastInsertedPos;
  } else {
    lastInsertedPos = null;
  }
  hideWinnerBanner();
  renderBoard();
  // No checkpoint write here — applying someone else's snapshot must not re-persist
  // our (possibly older) view over theirs. The actor writes on its own move.
  if (gameOver && lastWinnerPlayer) {
    recordWin(lastWinnerPlayer);
    recordOutcome(lastWinnerPlayer);
    const cells = findWinningCells(lastWinnerPlayer);
    if (cells.length >= 4) {
      for (const [row, col] of cells) {
        const el = boardEl.children[row * COLS + col];
        if (el) el.classList.add("winner");
      }
    }
    const winnerId = isMultiplayer ? players[lastWinnerPlayer - 1] : null;
    const name = isMultiplayer
      ? playerLabelForStatus(winnerId, lastWinnerPlayer === 1 ? "Red" : "Yellow")
      : (lastWinnerPlayer === 1 ? "Red" : "Yellow");
    updateStatus("🎉 " + name + " wins!");
    showWinnerOverlay();
  } else if (isFull()) {
    recordOutcome(0);
    updateStatus("Draw!");
  } else {
    updateStatus();
  }
}


function animateDrop(col, targetRow, player, onDone) {
  const targetCell = boardEl.children[targetRow * COLS + col];
  const boardRect = boardEl.getBoundingClientRect();
  const cellRect = targetCell.getBoundingClientRect();
  const cellSize = cellRect.width;

  const disk = document.createElement("div");
  disk.className = "drop-disk";
  disk.dataset.player = player;

  const left = (cellRect.left - boardRect.left) + cellSize * 0.075;
  disk.style.width  = (cellSize * 0.85) + "px";
  disk.style.height = (cellSize * 0.85) + "px";
  disk.style.left   = left + "px";

  const topCell = boardEl.children[col];
  const topCellRect = topCell.getBoundingClientRect();
  const startTop = (topCellRect.top - boardRect.top) + cellSize * 0.075;
  const endTop   = (cellRect.top - boardRect.top) + cellSize * 0.075;

  disk.style.top = startTop + "px";
  boardEl.appendChild(disk);

  const duration = 60 + targetRow * 40; // ms, faster for top rows
  const startTime = performance.now();

  function frame(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    // ease-in (accelerate downward)
    const eased = t * t;
    disk.style.top = (startTop + (endTop - startTop) * eased) + "px";
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      disk.remove();
      onDone();
    }
  }
  requestAnimationFrame(frame);
}

// local=true → initiated by this client; false → local bot/offline replay
function handleMove(col, local = true) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] !== 0) continue;

    const player = current;
    board[r][col] = player;
    lastInsertedPos = { r, c: col };

    const isWin  = checkWin(r, col, current);
    const isDraw = !isWin && isFull();

    if (isWin) {
      gameOver = true;
      lastWinnerPlayer = current;
      recordWin(current);
      recordOutcome(current);
    } else if (isDraw) {
      gameOver = true;
      recordOutcome(0);
    }
    // Checkpoint is written by the ACTOR in applyDurableMove (mine), not here — so an
    // opponent move we apply locally doesn't overwrite the room state with our view.

    animateDrop(col, r, player, () => {
      renderBoard();

      if (isWin) {
        highlightWinner(r, col, player);

        const winnerId = isMultiplayer ? players[player - 1] : null;
        const name  = isMultiplayer
          ? playerLabelForStatus(winnerId, player === 1 ? "Red" : "Yellow")
          : (player === 1 ? "Red" : "Yellow");
        const color = player === 1 ? "#ff4444" : "#ffc400";

        updateStatus("🎉 " + name + " wins!");

        setTimeout(() => {
          winnerNameDisplay.textContent = name;
          winnerNameDisplay.style.color = color;
          winnerEmoji.textContent = player === 1 ? "🔴" : "🟡";
          showWinnerBanner();
          spawnConfetti();

          if (isMultiplayer) {
            rematchState = "idle";
            syncRematchUi();
          } else {
            winnerPlayAgain.textContent = "Play Again";
            winnerPlayAgain.disabled = false;
            winnerPlayAgain.onclick = () => {
              hideWinnerBanner();
              init();
            };
          }
        }, 600);

      } else if (isDraw) {
        updateStatus("Draw!");
      }
    });

    if (!isWin && !isDraw) {
      current = current === 1 ? 2 : 1;
      updateStatus();

      if (!isMultiplayer && current === 2 && !gameOver) {
        botMove();
      }
    }

    return true;
  }
  return false;
}

function isFull() {
  return board.every(row => row.every(cell => cell !== 0));
}

function checkWin(r, c, player) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    count += countDir(r, c, dr, dc, player);
    count += countDir(r, c, -dr, -dc, player);
    if (count >= 4) return true;
  }
  return false;
}

function findWinningCells(player) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== player) continue;
      const dirs = [[0,1],[1,0],[1,1],[1,-1]];
      for (const [dr, dc] of dirs) {
        const line = [];
        let rr = r;
        let cc = c;
        while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === player) {
          line.push([rr, cc]);
          rr += dr;
          cc += dc;
        }
        if (line.length >= 4) {
          return line;
        }
      }
    }
  }
  return [];
}

function countDir(r, c, dr, dc, player) {
  let cnt = 0, rr = r + dr, cc = c + dc;
  while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === player) {
    cnt++; rr += dr; cc += dc;
  }
  return cnt;
}

function highlightWinner(r, c, player) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    let line = [[r, c]];
    let rr = r + dr, cc = c + dc;
    while (rr>=0 && rr<ROWS && cc>=0 && cc<COLS && board[rr][cc]===player) {
      line.push([rr, cc]); rr+=dr; cc+=dc;
    }
    rr = r - dr; cc = c - dc;
    while (rr>=0 && rr<ROWS && cc>=0 && cc<COLS && board[rr][cc]===player) {
      line.push([rr, cc]); rr-=dr; cc-=dc;
    }
    if (line.length >= 4) {
      for (const [ar, ac] of line) {
        const el = boardEl.children[ar * COLS + ac];
        if (el) el.classList.add("winner");
      }
      return;
    }
  }
}

function spawnConfetti() {
  const colors = ["#ff2e2e","#ffc400","#3d42ff","#ff2f6e","#00e5ff","#76ff03","#ff6b2e"];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";
    el.style.left = Math.random() * 100 + "%";
    el.style.top = "0px";
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDelay = Math.random() * 0.8 + "s";
    el.style.animationDuration = (0.9 + Math.random() * 0.8) + "s";
    el.style.transform = `rotate(${Math.random()*360}deg)`;
    winnerBanner.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }
}

// ── Bot AI ────────────────────────────────────────────────

function botMove() {
  if (gameOver) return;
  const depth = Number(diffSelect.value);
  setTimeout(() => {
    const best = minimax(board, depth, -Infinity, Infinity, true);
    handleMove(best.col, false);
  }, 300);
}

function getValidColumns() {
  const valid = [];
  for (let c = 0; c < COLS; c++) if (board[0][c] === 0) valid.push(c);
  return valid;
}

function getSortedColumns() {
  return getValidColumns().sort((a, b) =>
    Math.abs(a - Math.floor(COLS / 2)) - Math.abs(b - Math.floor(COLS / 2))
  );
}

function getNextRow(col) {
  for (let r = ROWS - 1; r >= 0; r--) if (board[r][col] === 0) return r;
  return null;
}

function isWinningBoard(b, player) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      if (b[r][c]===player && b[r][c+1]===player && b[r][c+2]===player && b[r][c+3]===player) return true;
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r <= ROWS - 4; r++)
      if (b[r][c]===player && b[r+1][c]===player && b[r+2][c]===player && b[r+3][c]===player) return true;
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c <= COLS - 4; c++)
      if (b[r][c]===player && b[r+1][c+1]===player && b[r+2][c+2]===player && b[r+3][c+3]===player) return true;
  for (let r = 3; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      if (b[r][c]===player && b[r-1][c+1]===player && b[r-2][c+2]===player && b[r-3][c+3]===player) return true;
  return false;
}

function isBoardFull(b) {
  return b[0].every(cell => cell !== 0);
}

function evaluateWindow(window, player) {
  const opp = player === 2 ? 1 : 2;
  const p = window.filter(v => v === player).length;
  const e = window.filter(v => v === 0).length;
  const o = window.filter(v => v === opp).length;
  if (p === 4) return 10000;
  if (o === 4) return -10000;
  if (p === 3 && e === 1) return 50;
  if (p === 2 && e === 2) return 10;
  if (o === 3 && e === 1) return -80;
  if (o === 2 && e === 2) return -10;
  return 0;
}

function scorePosition(b, player) {
  let score = 0;
  for (let r = 0; r < ROWS; r++) {
    if (b[r][3] === player) score += 8;
    if (b[r][2] === player || b[r][4] === player) score += 4;
  }
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      score += evaluateWindow([b[r][c], b[r][c+1], b[r][c+2], b[r][c+3]], player);
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r <= ROWS - 4; r++)
      score += evaluateWindow([b[r][c], b[r+1][c], b[r+2][c], b[r+3][c]], player);
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c <= COLS - 4; c++)
      score += evaluateWindow([b[r][c], b[r+1][c+1], b[r+2][c+2], b[r+3][c+3]], player);
  for (let r = 3; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      score += evaluateWindow([b[r][c], b[r-1][c+1], b[r-2][c+2], b[r-3][c+3]], player);
  return score;
}

function minimax(b, depth, alpha, beta, maximizing) {
  if (isWinningBoard(b, 2)) return { col: null, score: 100000 + depth };
  if (isWinningBoard(b, 1)) return { col: null, score: -100000 - depth };
  if (isBoardFull(b))       return { col: null, score: 0 };

  const cols = getSortedColumns();
  if (depth === 0) return { col: cols[0], score: scorePosition(b, 2) - scorePosition(b, 1) };

  if (maximizing) {
    let value = -Infinity, bestCol = cols[0];
    for (const col of cols) {
      const row = getNextRow(col);
      b[row][col] = 2;
      const result = minimax(b, depth - 1, alpha, beta, false);
      b[row][col] = 0;
      if (result.score > value) { value = result.score; bestCol = col; }
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return { col: bestCol, score: value };
  } else {
    let value = Infinity, bestCol = cols[0];
    for (const col of cols) {
      const row = getNextRow(col);
      b[row][col] = 1;
      const result = minimax(b, depth - 1, alpha, beta, true);
      b[row][col] = 0;
      if (result.score < value) { value = result.score; bestCol = col; }
      beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return { col: bestCol, score: value };
  }
}

// ── Boot ──────────────────────────────────────────────────
setWinsVisibility(false);
syncControlVisibility();
