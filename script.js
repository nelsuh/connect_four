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

// ── Usion capabilities: cloud stats · leaderboard · notify · checkpoint ──
// All wrappers are defensive: missing modules / standalone preview must never
// throw (a thrown error in init blanks the game). They no-op gracefully.

let myStats = { wins: 0, losses: 0, draws: 0, games: 0 };
let statsRecordedThisGame = false;
let lastTurnNotified = false;
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
      Usion.leaderboard.submit(myStats.wins, { games: myStats.games, draws: myStats.draws });
    }
  } catch (_) {}
}

function notifySelf(title, body) {
  // Only fires when the app is backgrounded (banner if online elsewhere, OS push if offline).
  try { if (window.Usion && Usion.notify && document.hidden) Usion.notify.send({ title, body }); } catch (_) {}
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
    notifySelf("You won! 🎉", "You won your Connect Four match");
  } else {
    myStats.losses += 1;
    notifySelf("Match over", "Your Connect Four match ended");
  }
  persistStats();
  submitLeaderboard();
  try { if (window.Usion && Usion.cloud && Usion.cloud.shared) Usion.cloud.shared.incr("games_total", 1); } catch (_) {}
}

function maybeNotifyTurn() {
  if (!isMultiplayer || gameOver) { lastTurnNotified = false; return; }
  const myTurn = current === myPlayer;
  if (myTurn && document.hidden && !lastTurnNotified) {
    lastTurnNotified = true;
    notifySelf("Your turn", "It's your move in Connect Four");
  }
  if (!myTurn) lastTurnNotified = false;
}

// Host (playerIds[0]) checkpoints authoritative state so reconnecting clients
// receive it as game_state instead of replaying from zero.
function hostCheckpoint() {
  if (!isHostPlayer()) return;
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

  if (config.roomId) {
    showWaiting();
    await setupMultiplayer(config.roomId);
  } else {
    hideWaiting();
    syncControlVisibility();
    setPlayerDisplayBot();
    init();
  }
});

// ── Multiplayer ───────────────────────────────────────────

async function setupMultiplayer(roomId) {
  try {
    await Usion.game.connect();

    Usion.game.onJoined(onJoined);
    Usion.game.onPlayerJoined(onPlayerJoined);
    Usion.game.onPlayerLeft(onPlayerLeft);
    Usion.game.onAction(onAction);
    Usion.game.onSync(onSync);
    Usion.game.onRealtime(onRealtime);
    Usion.game.onRematchRequest(onRematchRequest);
    Usion.game.onGameRestarted(onGameRestarted);
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

    await Usion.game.join(roomId);
  } catch (err) {
    console.error("Multiplayer setup failed:", err);
    hideWaiting();
    syncControlVisibility();
    setPlayerDisplayBot();
    init();
  }
}

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
  if (data.player && data.player.is_connected) {
    connectedCount = Math.max(connectedCount, 2);
  }
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
  notifySelf("Opponent left", "Your opponent left the Connect Four match");
  if (isMultiplayer && myPlayer && connectedCount <= 1) {
    // Decisive: only we remain. Hold a grace window before declaring forfeit so
    // a quick rejoin resumes the game exactly where it was.
    startForfeitGrace();
  } else {
    updateStatus("Opponent left the game");
  }
}

function onAction(data) {
  Usion.log("onAction: type=" + data.action_type + " player=" + data.player_id + " myId=" + myId + " seq=" + data.sequence);
  if (data.sequence !== undefined) lastSequence = Math.max(lastSequence, data.sequence);
  if (data.action_type === "move" && data.player_id === myId) {
    pendingMove = false;
  }
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
  if (isMultiplayer) hostCheckpoint();
}

function onSync(data) {
  Usion.log("onSync: actions=" + (data.actions ? data.actions.length : 0) + " seq=" + data.sequence + " checkpoint=" + !!(data.game_state && data.game_state.board));
  pendingMove = false;
  if (data.sequence !== undefined) {
    lastSnapshotVersion = Math.max(lastSnapshotVersion, Number(data.sequence) || 0);
    lastSequence = data.sequence;
  }

  const moveActions = (data.actions || []).filter(
    (a) => a.action_type === "move" && a.action_data && a.action_data.col !== undefined
  );
  const cp = (data.game_state && Array.isArray(data.game_state.board)) ? data.game_state : null;
  if (!cp && moveActions.length === 0) return; // nothing to rebuild from

  // The action log is the complete, authoritative move history; the host-written
  // checkpoint can LAG it (a non-host move made while the host was away lives only
  // in the log). So trust the log and only fall back to the checkpoint when the log
  // was actually compacted — i.e. it carries fewer moves than the checkpoint, in
  // which case the missing prefix is in the checkpoint and the log is the tail.
  const cpDiscs = cp ? discCount(cp.board) : -1;
  if (cp && cpDiscs > moveActions.length) {
    applyCheckpoint(cp);                                   // checkpoint = base (the compacted-away prefix)
    for (const a of moveActions) {                          // log = post-checkpoint tail
      if (replayMoveSilent(a.action_data.col)) break;
    }
    finalizeSyncRender();
    return;
  }

  // Authoritative full replay from an empty board. This is what fixes the
  // stale-checkpoint deadlock: every move (including the opponent's last one) is
  // in the log, so `current` always reflects whose turn it really is.
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  current = 1;
  gameOver = false;
  lastWinnerPlayer = 0;
  lastInsertedPos = null;
  for (const a of moveActions) {
    if (replayMoveSilent(a.action_data.col)) break;
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
}

function hideWaiting() {
  waitingOverlay.classList.remove("show");
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
  lastWinnerPlayer = 0;
  lastSnapshotVersion = 0;
  lastSnapshotVersionByPlayer = {};
  rematchState = "idle";
  lastInsertedPos = null;
  winRecordedThisGame = false;
  statsRecordedThisGame = false;
  lastTurnNotified = false;
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
  maybeNotifyTurn();
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
    pendingMove = true;
    const applied = handleMove(col, true);
    if (!applied) {
      pendingMove = false;
      return;
    }
    broadcastBoardSnapshot();
    Usion.game.action("move", { col }).catch((err) => {
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
  applyBoardSnapshot(state, state.order && state.order[0] ? state.order[0] : (players[0] || "host"));
  return true;
}

function applyBoardSnapshot(snapshot, senderId) {
  const version = Number(snapshot.version || 0);
  // Order snapshots per-sender: each sender's own clock is monotonic, so this
  // drops only genuinely out-of-order packets from THAT player. Comparing across
  // two devices' clocks (skew) used to drop valid moves and deadlock the game.
  const prevFromSender = lastSnapshotVersionByPlayer[senderId] || 0;
  if (version && version < prevFromSender) return;
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
  if (isMultiplayer) hostCheckpoint();
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
    if (isMultiplayer) hostCheckpoint();

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
