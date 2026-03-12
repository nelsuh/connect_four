const ROWS = 6, COLS = 7;

let board = [];
let current = 1;
let gameOver = false;

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const resetBtn = document.getElementById("reset");
const modeSelect = document.getElementById("mode");
const winnerOverlay = document.getElementById("winnerOverlay");
const winnerNameDisplay = document.getElementById("winnerNameDisplay");
const winnerEmoji = document.getElementById("winnerEmoji");
const winnerCard = document.getElementById("winnerCard");
const winnerPlayAgain = document.getElementById("winnerPlayAgain");

winnerPlayAgain.addEventListener("click", () => {
  winnerOverlay.classList.remove("show");
  init();
});

function init() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  current = 1;
  gameOver = false;
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

      if (board[r][c]) {
        cell.dataset.player = board[r][c];
      }

      boardEl.appendChild(cell);
    }
  }
}

function updateStatus(text) {

  if (text) {
    statusEl.textContent = text;
    return;
  }

  if (gameOver) return;

  const name = current === 1 ? "Red" : "Yellow";
  const color = current === 1 ? "#ff2e2e" : "#ffc400";

  statusEl.innerHTML = `<span style="color:${color};font-weight:700;">${name}</span>'s turn`;
}

boardEl.addEventListener("click", (e) => {

  if (gameOver) return;

  // only block clicks when bot is playing and it's bot's turn
  if (modeSelect && modeSelect.value === "bot" && current === 2) return;

  const cell = e.target.closest(".cell");
  if (!cell) return;

  const col = Number(cell.dataset.col);

  handleMove(col);
});

function handleMove(col) {

  for (let r = ROWS - 1; r >= 0; r--) {

    if (board[r][col] === 0) {

      board[r][col] = current;

      renderBoard();

      if (checkWin(r, col, current)) {

        gameOver = true;

        highlightWinner(r, col, current);

        const name = current === 1 ? "Red" : "Yellow";
        const color = current === 1 ? "#ff4444" : "#ffc400";
        updateStatus(`🎉 ${name} wins!`);

        // show overlay after brief delay
        setTimeout(() => {
          winnerNameDisplay.textContent = name;
          winnerNameDisplay.style.color = color;
          winnerEmoji.textContent = current === 1 ? "🔴" : "🟡";
          spawnConfetti();
          winnerOverlay.classList.add("show");
        }, 600);
      }

      else if (isFull()) {

        gameOver = true;

        updateStatus("Draw!");
      }

      else {

        current = current === 1 ? 2 : 1;

        updateStatus();

        if(modeSelect.value === "bot" && current === 2 && !gameOver){
            botMove();
        }
      }

      return;
    }
  }
}

function botMove() {
  if (gameOver) return;
  const depth = Number(document.getElementById("difficulty").value);
  setTimeout(() => {
    const best = minimax(board, depth, -Infinity, Infinity, true);
    handleMove(best.col);
  }, 300);
}

function getValidColumns() {
  const valid = [];
  for (let c = 0; c < COLS; c++) {
    if (board[0][c] === 0) valid.push(c);
  }
  return valid;
}

// Return columns sorted center-first for better pruning
function getSortedColumns() {
  return getValidColumns().sort((a, b) =>
    Math.abs(a - Math.floor(COLS / 2)) - Math.abs(b - Math.floor(COLS / 2))
  );
}

function getNextRow(col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) return r;
  }
  return null;
}

// Check if a specific player has won on the given board state
function isWinningBoard(b, player) {
  // Horizontal
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      if (b[r][c]===player && b[r][c+1]===player && b[r][c+2]===player && b[r][c+3]===player) return true;
  // Vertical
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r <= ROWS - 4; r++)
      if (b[r][c]===player && b[r+1][c]===player && b[r+2][c]===player && b[r+3][c]===player) return true;
  // Diagonal down-right
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c <= COLS - 4; c++)
      if (b[r][c]===player && b[r+1][c+1]===player && b[r+2][c+2]===player && b[r+3][c+3]===player) return true;
  // Diagonal up-right
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
  if (o === 3 && e === 1) return -80;  // block opponent threats strongly
  if (o === 2 && e === 2) return -10;
  return 0;
}

function scorePosition(b, player) {
  let score = 0;

  // Center column preference
  for (let r = 0; r < ROWS; r++) {
    if (b[r][3] === player) score += 8;
    if (b[r][2] === player || b[r][4] === player) score += 4;
  }

  // Horizontal windows
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      score += evaluateWindow([b[r][c], b[r][c+1], b[r][c+2], b[r][c+3]], player);

  // Vertical windows
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r <= ROWS - 4; r++)
      score += evaluateWindow([b[r][c], b[r+1][c], b[r+2][c], b[r+3][c]], player);

  // Diagonal down-right
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c <= COLS - 4; c++)
      score += evaluateWindow([b[r][c], b[r+1][c+1], b[r+2][c+2], b[r+3][c+3]], player);

  // Diagonal up-right
  for (let r = 3; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      score += evaluateWindow([b[r][c], b[r-1][c+1], b[r-2][c+2], b[r-3][c+3]], player);

  return score;
}

function minimax(b, depth, alpha, beta, maximizing) {
  const botWon = isWinningBoard(b, 2);
  const playerWon = isWinningBoard(b, 1);

  // Terminal states
  if (botWon) return { col: null, score: 100000 + depth };   // win sooner = higher score
  if (playerWon) return { col: null, score: -100000 - depth };
  if (isBoardFull(b)) return { col: null, score: 0 };

  const cols = getSortedColumns();
  if (depth === 0) return { col: cols[0], score: scorePosition(b, 2) - scorePosition(b, 1) };

  if (maximizing) {
    let value = -Infinity;
    let bestCol = cols[0];

    for (const col of cols) {
      const row = getNextRow(col);
      b[row][col] = 2;
      const result = minimax(b, depth - 1, alpha, beta, false);
      b[row][col] = 0;

      if (result.score > value) {
        value = result.score;
        bestCol = col;
      }
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break; // prune
    }
    return { col: bestCol, score: value };

  } else {
    let value = Infinity;
    let bestCol = cols[0];

    for (const col of cols) {
      const row = getNextRow(col);
      b[row][col] = 1;
      const result = minimax(b, depth - 1, alpha, beta, true);
      b[row][col] = 0;

      if (result.score < value) {
        value = result.score;
        bestCol = col;
      }
      beta = Math.min(beta, value);
      if (alpha >= beta) break; // prune
    }
    return { col: bestCol, score: value };
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

  let cnt = 0;

  let rr = r + dr;
  let cc = c + dc;

  while (
    rr >= 0 && rr < ROWS &&
    cc >= 0 && cc < COLS &&
    board[rr][cc] === player
  ) {

    cnt++;

    rr += dr;
    cc += dc;
  }

  return cnt;
}

function highlightWinner(r, c, player) {

  const dirs = [[0,1],[1,0],[1,1],[1,-1]];

  for (const [dr, dc] of dirs) {

    let line = [[r, c]];

    let rr = r + dr;
    let cc = c + dc;

    while (rr>=0 && rr<ROWS && cc>=0 && cc<COLS && board[rr][cc]===player) {
      line.push([rr,cc]);
      rr+=dr;
      cc+=dc;
    }

    rr = r - dr;
    cc = c - dc;

    while (rr>=0 && rr<ROWS && cc>=0 && cc<COLS && board[rr][cc]===player) {
      line.push([rr,cc]);
      rr-=dr;
      cc-=dc;
    }

    if (line.length >= 4) {

      for (const [ar, ac] of line) {

        const idx = ar * COLS + ac;

        const el = boardEl.children[idx];

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

resetBtn.addEventListener("click", init);

init();