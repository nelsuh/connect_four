const ROWS = 6, COLS = 7;

// ── Game state ────────────────────────────────────────────
let board = [];
let current = 1;      // 1 = Red, 2 = Yellow
let gameOver = false;

// ── Multiplayer state ─────────────────────────────────────
let myId = null;
let myPlayer = 0;     // 1 or 2 (determined by join order)
let players = [];     // [p1_id, p2_id] in join order
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
let rematchState = "idle"; // idle | requested

// ── DOM refs ──────────────────────────────────────────────
const boardEl          = document.getElementById("board");
const statusEl         = document.getElementById("status");
const resetBtn         = document.getElementById("reset");
const modeSelect       = document.getElementById("mode");
const diffSelect       = document.getElementById("difficulty");
const winnerOverlay    = document.getElementById("winnerOverlay");
const winnerNameDisplay= document.getElementById("winnerNameDisplay");
const winnerEmoji      = document.getElementById("winnerEmoji");
const winnerCard       = document.getElementById("winnerCard");
const winnerPlayAgain  = document.getElementById("winnerPlayAgain");
const winnerShare      = document.getElementById("winnerShare");
const waitingOverlay   = document.getElementById("waitingOverlay");
const playBotBtn       = document.getElementById("playBotBtn");
const player1Avatar    = document.getElementById("player1Avatar");
const player2Avatar    = document.getElementById("player2Avatar");
const player1Name      = document.getElementById("player1Name");
const player2Name      = document.getElementById("player2Name");

// ── Usion Init ────────────────────────────────────────────

Usion.init(async function(config) {
  myId = config.userId;
  playerNames[myId] = config.userName || "You";
  if (config.userAvatar) playerAvatars[myId] = config.userAvatar;

  if (config.roomId) {
    showWaiting();
    await setupMultiplayer(config.roomId);
  } else {
    hideWaiting();
    modeSelect.value = "bot";
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
      if (!gameOver) updateStatus("Connection lost…");
    });
    Usion.game.onReconnect(() => {
      if (!gameOver) {
        updateStatus();
        // Re-sync on reconnect to catch missed actions
        Usion.game.requestSync(lastSequence);
      }
    });

    await Usion.game.join(roomId);
  } catch (err) {
    console.error("Multiplayer setup failed:", err);
    hideWaiting();
    modeSelect.value = "bot";
    syncControlVisibility();
    setPlayerDisplayBot();
    init();
  }
}

function onJoined(data) {
  Usion.log("onJoined: " + JSON.stringify({
    player_ids: data.player_ids,
    sequence: data.sequence,
    status: data.status,
    connected_count: data.connected_count
  }));
  players = data.player_ids || [];
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
  // Use the full player_ids array from the server (data.player_id doesn't exist)
  if (data.player_ids) {
    players = data.player_ids;
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
  if (connectedCount >= 2 && waitingForOpponent) {
    startOnlineGame();
  }
}

function onPlayerLeft(data) {
  connectedCount = Math.max(0, connectedCount - 1);
  if (!gameOver) {
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

function onSync(data) {
  Usion.log("onSync: actions=" + (data.actions ? data.actions.length : 0) + " seq=" + data.sequence);
  pendingMove = false;
  if (data.sequence !== undefined) {
    lastSnapshotVersion = Math.max(lastSnapshotVersion, Number(data.sequence) || 0);
  }
  if (!data.actions || data.actions.length === 0) return;
  if (data.sequence !== undefined) lastSequence = data.sequence;

  // Replay all missed actions from the beginning
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  current = 1;
  gameOver = false;

  for (const action of data.actions) {
    if (action.action_type === "move" && action.action_data && action.action_data.col !== undefined) {
      // Replay the move silently
      const col = action.action_data.col;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] !== 0) continue;
        board[r][col] = current;
        if (checkWin(r, col, current)) {
          gameOver = true;
          lastWinnerPlayer = current;
          renderBoard();
          highlightWinner(r, col, current);

          const winnerId = isMultiplayer ? players[current - 1] : null;
          const winnerIsMe = !isMultiplayer || winnerId === myId;
          const name = isMultiplayer
            ? (winnerIsMe ? "You" : (playerNames[winnerId] || "Opponent"))
            : (current === 1 ? "Red" : "Yellow");
          updateStatus("🎉 " + name + " wins!");
          return;
        }
        current = current === 1 ? 2 : 1;
        break;
      }
    }
  }
  renderBoard();
  updateStatus();
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
    applyBoardSnapshot(data.action_data);
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
  modeSelect.value = "online";

  myPlayer = players.indexOf(myId) + 1; // 1 or 2

  updatePlayerDisplay();
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
  isMultiplayer = false;
  waitingForOpponent = false;
  modeSelect.value = "bot";
  hideWaiting();
  syncControlVisibility();
  setPlayerDisplayBot();
  init();
});

// ── Controls ──────────────────────────────────────────────

function syncControlVisibility() {
  const isBotMode = modeSelect.value === "bot";
  diffSelect.style.display = isBotMode ? "" : "none";
}

modeSelect.addEventListener("change", () => {
  syncControlVisibility();
  if (!isMultiplayer) {
    if (modeSelect.value === "bot") {
      setPlayerDisplayBot();
    } else {
      player1Name.textContent = "Red";
      player1Avatar.src = "https://api.dicebear.com/7.x/bottts/svg?seed=red";
      player2Name.textContent = "Yellow";
      player2Avatar.src = "https://api.dicebear.com/7.x/bottts/svg?seed=yellow";
    }
    init();
  }
});

resetBtn.addEventListener("click", () => {
  if (isMultiplayer) {
    requestRematch();
  } else {
    init();
  }
});

winnerShare.addEventListener("click", () => {
  const winnerText = winnerNameDisplay.textContent;
  Usion.share({
    contentType: "text",
    text: `${winnerText} won at Connect 4! 🔴🟡`,
    title: "Connect 4",
    message: `${winnerText} won at Connect 4! 🔴🟡`
  });
});

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
  winnerOverlay.classList.remove("show");
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
  rematchState = "idle";
  winnerOverlay.classList.remove("show");
  renderBoard();
  updateStatus();
}


function renderBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = r;
      cell.dataset.col = c;
      if (board[r][c]) cell.dataset.player = board[r][c];
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

  if (modeSelect.value === "bot" && current === 2) return;
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
    winnerOverlayVisible: gameOver,
    rematchState,
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
  winnerOverlay.classList.add("show");
  syncRematchUi();
}

function applyRematchState(payload) {
  const nextState = String(payload.state || "idle");
  if (!["idle", "requested"].includes(nextState)) return;
  rematchState = nextState;
  syncRematchUi();
}

function applyBoardSnapshot(snapshot) {
  const version = Number(snapshot.version || 0);
  if (version && version < lastSnapshotVersion) return;
  lastSnapshotVersion = Math.max(lastSnapshotVersion, version);
  if (Array.isArray(snapshot.board)) {
    board = snapshot.board.map((row) => Array.isArray(row) ? row.slice() : Array(COLS).fill(0));
  }
  current = snapshot.current === 2 ? 2 : 1;
  gameOver = !!snapshot.gameOver;
  lastWinnerPlayer = snapshot.lastWinnerPlayer === 2 ? 2 : (snapshot.lastWinnerPlayer === 1 ? 1 : 0);
  rematchState = ["idle", "requested"].includes(snapshot.rematchState) ? snapshot.rematchState : rematchState;
  pendingMove = false;
  winnerOverlay.classList.remove("show");
  renderBoard();
  if (gameOver && lastWinnerPlayer) {
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
    if (snapshot.winnerOverlayVisible !== false) {
      showWinnerOverlay();
    }
  } else if (isFull()) {
    updateStatus("Draw!");
  } else {
    updateStatus();
  }
}


// local=true → initiated by this client; false → local bot/offline replay
function handleMove(col, local = true) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] !== 0) continue;

    board[r][col] = current;
    renderBoard();

    if (checkWin(r, col, current)) {
      gameOver = true;
      lastWinnerPlayer = current;
      highlightWinner(r, col, current);

      const winnerId   = isMultiplayer ? players[current - 1] : null;
      const name  = isMultiplayer
        ? playerLabelForStatus(winnerId, current === 1 ? "Red" : "Yellow")
        : (current === 1 ? "Red" : "Yellow");
      const color = current === 1 ? "#ff4444" : "#ffc400";

      updateStatus("🎉 " + name + " wins!");

      setTimeout(() => {
        winnerNameDisplay.textContent = name;
        winnerNameDisplay.style.color = color;
        winnerEmoji.textContent = current === 1 ? "🔴" : "🟡";
        spawnConfetti();
        winnerOverlay.classList.add("show");

        if (isMultiplayer) {
          rematchState = "idle";
          syncRematchUi();

        } else {
          winnerPlayAgain.textContent = "Play Again";
          winnerPlayAgain.disabled = false;
          winnerPlayAgain.onclick = () => {
            winnerOverlay.classList.remove("show");
            init();
          };
        }
      }, 600);

    } else if (isFull()) {
      gameOver = true;
      updateStatus("Draw!");

    } else {
      current = current === 1 ? 2 : 1;
      updateStatus();

      if (!isMultiplayer && modeSelect.value === "bot" && current === 2 && !gameOver) {
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
    winnerCard.appendChild(el);
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
syncControlVisibility();
