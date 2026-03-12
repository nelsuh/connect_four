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
    status: data.status
  }));
  players = data.player_ids || [];
  if (data.sequence !== undefined) lastSequence = data.sequence;

  // Announce our identity to the room
  Usion.game.realtime("player_info", {
    name: playerNames[myId],
    avatar: playerAvatars[myId] || null
  });

  if (players.length >= 2 && waitingForOpponent) {
    startOnlineGame();
    // Request sync to catch any actions we may have missed
    if (lastSequence > 0) {
      Usion.game.requestSync(0);
    }
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
  // Re-broadcast our identity to the new joiner
  Usion.game.realtime("player_info", {
    name: playerNames[myId],
    avatar: playerAvatars[myId] || null
  });
  if (players.length >= 2 && waitingForOpponent) {
    startOnlineGame();
  }
}

function onPlayerLeft(data) {
  if (!gameOver) {
    updateStatus("Opponent left the game");
  }
}

function onAction(data) {
  Usion.log("onAction: type=" + data.action_type + " player=" + data.player_id + " myId=" + myId + " seq=" + data.sequence);
  if (data.sequence !== undefined) lastSequence = Math.max(lastSequence, data.sequence);
  if (data.action_type === "move" && data.player_id !== myId) {
    handleMove(data.action_data.col, false);
  }
}

function onSync(data) {
  Usion.log("onSync: actions=" + (data.actions ? data.actions.length : 0) + " seq=" + data.sequence);
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
  }
}

function onRematchRequest(data) {
  if (data.player_id === myId) return;
  if (rematchRequested) {
    // Both sides have requested — start new game
    resetForRematch();
  } else {
    // Show accept prompt on the overlay button
    winnerPlayAgain.textContent = "Accept Rematch";
    winnerPlayAgain.disabled = false;
    winnerPlayAgain.onclick = acceptRematch;
  }
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
  Usion.game.requestRematch();
  winnerPlayAgain.textContent = "Waiting for rematch…";
  winnerPlayAgain.disabled = true;
}

function acceptRematch() {
  rematchRequested = true;
  Usion.game.requestRematch();
  resetForRematch();
}

function resetForRematch() {
  rematchRequested = false;
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
  lastWinnerPlayer = 0;
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

function updateStatus(text) {
  if (text) { statusEl.textContent = text; return; }
  if (gameOver) return;

  if (isMultiplayer) {
    const color = current === 1 ? "#ff2e2e" : "#ffc400";
    if (current === myPlayer) {
      statusEl.innerHTML = `<span style="color:${color};font-weight:700;">Your turn</span>`;
    } else {
      statusEl.innerHTML = `<span style="color:${color};font-weight:700;">Opponent's turn</span>`;
    }
  } else {
    const name  = current === 1 ? "Red" : "Yellow";
    const color = current === 1 ? "#ff2e2e" : "#ffc400";
    statusEl.innerHTML = `<span style="color:${color};font-weight:700;">${name}</span>'s turn`;
  }
}

boardEl.addEventListener("click", (e) => {
  if (gameOver) return;

  if (isMultiplayer) {
    if (current !== myPlayer) return;
  } else {
    if (modeSelect.value === "bot" && current === 2) return;
  }

  const cell = e.target.closest(".cell");
  if (!cell) return;

  handleMove(Number(cell.dataset.col), true);
});

// local=true → initiated by this client (send to server); false → received from opponent
function handleMove(col, local = true) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] !== 0) continue;

    board[r][col] = current;
    renderBoard();

    if (local && isMultiplayer) {
      Usion.game.action("move", { col });
    }

    if (checkWin(r, col, current)) {
      gameOver = true;
      lastWinnerPlayer = current;
      highlightWinner(r, col, current);

      const winnerId   = isMultiplayer ? players[current - 1] : null;
      const winnerIsMe = !isMultiplayer || winnerId === myId;
      const name  = isMultiplayer
        ? (winnerIsMe ? "You" : (playerNames[winnerId] || "Opponent"))
        : (current === 1 ? "Red" : "Yellow");
      const color = current === 1 ? "#ff4444" : "#ffc400";

      updateStatus(`🎉 ${name} wins!`);

      setTimeout(() => {
        winnerNameDisplay.textContent = name;
        winnerNameDisplay.style.color = color;
        winnerEmoji.textContent = current === 1 ? "🔴" : "🟡";
        spawnConfetti();
        winnerOverlay.classList.add("show");

        if (isMultiplayer) {
          winnerPlayAgain.textContent = "Rematch";
          winnerPlayAgain.disabled = false;
          winnerPlayAgain.onclick = requestRematch;
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

    return;
  }
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
