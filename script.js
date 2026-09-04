const ROWS = 6, COLS = 7;

// ── i18n ─────────────────────────────────────────────────
// Every user-facing string lives here, chosen from the platform language
// (Usion.getLanguage() / config.language) — never hardcode UI text to one
// locale. Values may be a string or a function of runtime args. Keep both
// locales in sync.
const STR = {
  en: {
    appName: "Pocket Four",
    // topbar / seats
    tokensLabel: "Tokens",
    chooseTokenPairAria: "Choose a token pair",
    playersAria: "Players",
    you: "You",
    bot: "Bot",
    opponent: "Opponent",
    player: "Player",
    winsLabel: "Wins",
    seatYours: (color) => "Your token · " + color,
    seatOpponent: (color) => "Opponent · " + color,
    colorBlue: "Blue",
    colorCoral: "Coral",
    // ownership legend
    legendAria: "Token ownership guide",
    yourPieces: "Your pieces",
    yourPiecesHint: "Solid rim + dot",
    opponentHint: "Dashed rim + diamond",
    boardAria: "Four in a row game board",
    // token picker
    blueSide: "Blue side",
    coralSide: "Coral side",
    bluePlusCoral: "Blue + Coral",
    prepKicker: "Match preparation",
    pickWhileWaiting: "Pick a pair while we wait",
    chooseTokenPair: "Choose your token pair",
    prepSubReady: "Your opponent is here. Choose a set, then start the match.",
    prepSubDefault: "Choose one complete pair: Blue plays the left token and Coral the right.",
    prepSubSeat: "Pick a set now. Your seat decides which side you play.",
    startWithPair: "Start with this pair",
    useThisPair: "Use this pair",
    pairSaved: "Pair saved ✓",
    selectedLabel: "Selected",
    closePicker: "Close token picker",
    tokenPairsAria: "Token pairs",
    // waiting overlay
    waitingForOpponent: "Waiting for opponent…",
    waitingNote: "You can keep browsing while the room fills.",
    inviteFriend: "Invite a friend",
    playTheBot: "Play the bot",
    // bot level
    botLevel: "Bot level",
    levelEasy: "Easy", levelMedium: "Medium", levelHard: "Hard",
    // chat
    quickChat: "Quick chat",
    customMessage: "Custom message",
    customChatToggle: "Өөрийн мессеж",
    backToQuickChat: "Back to quick chat",
    typeMessage: "Type a message…",
    send: "Send",
    quickChatPhrases: [
      "юм авцаан",
      "чи болчихжээ",
      "би болчихжээ",
      "хурдлаад өгөөрэй",
      "муу юм бэ",
      "амтагдахгүй юм байна дөө",
      "EASY!",
      "GG!",
    ],
    // board / status
    dropInColumn: (n) => "Drop a token in column " + n,
    tokenInColumn: (owner, n) => (owner === "you" ? "Your" : "Opponent") + " token in column " + n,
    yourTurn: "Your turn",
    botsTurn: "Bot's turn",
    othersTurn: (name) => name + "'s turn",
    tie: "TIE",
    winStatus: (name, mine) => "🎉 " + name + (mine ? " win!" : " wins!"),
    winsTheShelf: " wins the shelf!",
    winTheShelf: " win the shelf!",
    // connection / forfeit
    connectionLost: "Connection lost…",
    oppLeftRejoin: (s) => "Opponent left — waiting to rejoin… (" + s + "s)",
    oppLeftGame: "Opponent left the game",
    youWinOppLeft: "🎉 You win! (opponent left)",
    // rematch
    rematch: "Rematch",
    restartGame: "Restart Game",
    acceptRematch: "Accept Rematch",
    waitingForRematch: "Waiting for rematch...",
    waitingForRestart: "Waiting for restart...",
    playAgain: "Play Again",
    // token set names
    "set_prism-pals": "Prism Pals",
    "set_orbit-buddies": "Orbit Buddies",
    "set_snack-spirits": "Snack Spirits",
    "set_garden-charms": "Garden Charms",
    "set_royal-blooms": "Royal Blooms",
    "set_cozy-capybaras": "Cozy Capybaras",
    "set_sky-friends": "Sky Friends",
    "set_forest-sprites": "Forest Sprites",
    "set_ocean-minis": "Ocean Minis",
    "set_tiny-dragons": "Tiny Dragons",
  },
  mn: {
    appName: "Дөрвөн эгнээ",
    tokensLabel: "Хүүхэлдэй",
    chooseTokenPairAria: "Хүүхэлдэйн хосоо сонго",
    playersAria: "Тоглогчид",
    you: "Та",
    bot: "Бот",
    opponent: "Өрсөлдөгч",
    player: "Тоглогч",
    winsLabel: "Ялалт",
    seatYours: (color) => "Таны хүүхэлдэй · " + color,
    seatOpponent: (color) => "Өрсөлдөгч · " + color,
    colorBlue: "Цэнхэр",
    colorCoral: "Шүрэн",
    legendAria: "Хэний хүүхэлдэй вэ гэдгийн заавар",
    yourPieces: "Таных",
    yourPiecesHint: "Бүтэн хүрээ + цэг",
    opponentHint: "Тасархай хүрээ + ромб",
    boardAria: "Дөрвөн эгнээ тоглоомын самбар",
    blueSide: "Цэнхэр тал",
    coralSide: "Шүрэн тал",
    bluePlusCoral: "Цэнхэр + Шүрэн",
    prepKicker: "Тулаанд бэлтгэх",
    pickWhileWaiting: "Хүлээж байхдаа хосоо сонго",
    chooseTokenPair: "Хүүхэлдэйн хосоо сонго",
    prepSubReady: "Өрсөлдөгч чинь ирлээ. Багцаа сонгоод тулаанаа эхлүүл.",
    prepSubDefault: "Бүтэн нэг хос сонго: Цэнхэр зүүн хүүхэлдэйгээр, Шүрэн баруунаар тоглоно.",
    prepSubSeat: "Одоо багцаа сонго. Аль талд тоглох нь суудлаас чинь шалтгаална.",
    startWithPair: "Энэ хосоор эхлэх",
    useThisPair: "Энэ хосыг сонгох",
    pairSaved: "Хос хадгалагдлаа ✓",
    selectedLabel: "Сонгосон",
    closePicker: "Хүүхэлдэйн сонголтыг хаах",
    tokenPairsAria: "Хүүхэлдэйн хосууд",
    waitingForOpponent: "Өрсөлдөгчөө хүлээж байна…",
    waitingNote: "Өрөө дүүртэл чөлөөтэй үзэж байж болно.",
    inviteFriend: "Найзаа урих",
    playTheBot: "Боттой тоглох",
    botLevel: "Ботын түвшин",
    levelEasy: "Амархан", levelMedium: "Дунд", levelHard: "Хэцүү",
    quickChat: "Түргэн чат",
    customMessage: "Өөрийн мессеж",
    customChatToggle: "Өөрийн мессеж",
    backToQuickChat: "Түргэн чат руу буцах",
    typeMessage: "Мессежээ бичнэ үү…",
    send: "Илгээх",
    quickChatPhrases: [
      "юм авцаан",
      "чи болчихжээ",
      "би болчихжээ",
      "хурдлаад өгөөрэй",
      "муу юм бэ",
      "амтагдахгүй юм байна дөө",
      "EASY!",
      "GG!",
    ],
    dropInColumn: (n) => n + "-р баганад хүүхэлдэй хийх",
    tokenInColumn: (owner, n) => (owner === "you" ? "Таны" : "Өрсөлдөгчийн") + " хүүхэлдэй " + n + "-р баганад",
    yourTurn: "Таны ээлж",
    botsTurn: "Ботын ээлж",
    othersTurn: (name) => name + "-ийн ээлж",
    tie: "ТЭНЦЛЭЭ",
    winStatus: (name, mine) => "🎉 " + name + (mine ? " яллаа!" : " яллаа!"),
    winsTheShelf: " тавцанг эзэллээ!",
    winTheShelf: " тавцанг эзэллээ!",
    connectionLost: "Холболт тасарлаа…",
    oppLeftRejoin: (s) => "Өрсөлдөгч гарлаа — эргэж ортол хүлээж байна… (" + s + "с)",
    oppLeftGame: "Өрсөлдөгч тоглоомоос гарлаа",
    youWinOppLeft: "🎉 Та яллаа! (өрсөлдөгч гарлаа)",
    rematch: "Дахин тулах",
    restartGame: "Дахин эхлүүлэх",
    acceptRematch: "Дахин тулахыг зөвшөөрөх",
    waitingForRematch: "Дахин тулахыг хүлээж байна...",
    waitingForRestart: "Дахин эхлүүлэхийг хүлээж байна...",
    playAgain: "Дахин тоглох",
    "set_prism-pals": "Призмэн нөхөд",
    "set_orbit-buddies": "Сансрын нөхөд",
    "set_snack-spirits": "Амттаны сахиус",
    "set_garden-charms": "Цэцэрлэгийн чимэг",
    "set_royal-blooms": "Хааны цэцэгс",
    "set_cozy-capybaras": "Тухтай капибара",
    "set_sky-friends": "Тэнгэрийн нөхөд",
    "set_forest-sprites": "Ойн сахиус",
    "set_ocean-minis": "Далайн бяцханууд",
    "set_tiny-dragons": "Бяцхан луунууд",
  },
};
let LANG = "en";
function t(key) {
  let v = STR[LANG] ? STR[LANG][key] : undefined;
  if (v === undefined) v = STR.en[key];
  if (typeof v === "function") return v.apply(null, Array.prototype.slice.call(arguments, 1));
  return v !== undefined ? v : key;
}
// Platform language first (config.language, then Usion.getLanguage()); the
// browser hint is only a fallback before the host has booted.
function detectLang(cfgLang) {
  let src = cfgLang;
  if (!src) {
    try { src = window.Usion && window.Usion.getLanguage && window.Usion.getLanguage(); } catch (_) {}
  }
  if (!src && typeof navigator !== "undefined") {
    src = (navigator.languages && navigator.languages[0]) || navigator.language;
  }
  if (!src) src = "en";
  return String(src).toLowerCase().indexOf("mn") === 0 ? "mn" : "en";
}
function tokenSetName(set) { return set ? t("set_" + set.id) : ""; }
// Set the active locale and fill every static (index.html) string. Safe to call
// again once the platform language arrives after the first paint.
function applyLang(lang) {
  LANG = lang === "mn" ? "mn" : "en";
  try { document.documentElement.lang = LANG; } catch (_) {}
  try { document.title = t("appName"); } catch (_) {}
  const byId = (id, key) => { const el = document.getElementById(id); if (el) el.textContent = t(key); };
  const byQ = (sel, key) => { const el = document.querySelector(sel); if (el) el.textContent = t(key); };
  const ariaQ = (sel, key) => { const el = document.querySelector(sel); if (el) el.setAttribute("aria-label", t(key)); };

  ariaQ("#tokenEditBtn", "chooseTokenPairAria");
  byQ("#tokenEditBtn > span:not(.token-edit-stack)", "tokensLabel");
  ariaQ(".topbar", "playersAria");
  // Wins counters keep their <span> count child — only the leading label moves.
  document.querySelectorAll(".wins").forEach(el => {
    if (el.firstChild && el.firstChild.nodeType === 3) el.firstChild.nodeValue = t("winsLabel") + " ";
  });
  ariaQ("#ownershipLegend", "legendAria");
  const ownerKeys = document.querySelectorAll(".owner-key-copy");
  if (ownerKeys[0]) {
    const s = ownerKeys[0].querySelector("strong"), h = ownerKeys[0].querySelector("small");
    if (s) s.textContent = t("yourPieces");
    if (h) h.textContent = t("yourPiecesHint");
  }
  if (ownerKeys[1]) {
    const s = ownerKeys[1].querySelector("strong"), h = ownerKeys[1].querySelector("small");
    if (s) s.textContent = t("opponent");
    if (h) h.textContent = t("opponentHint");
  }
  ariaQ(".board-stage", "boardAria");
  byQ(".prep-kicker", "prepKicker");
  byId("prepTitle", "chooseTokenPair");
  byId("prepSubtitle", "prepSubSeat");
  ariaQ("#tokenPickerClose", "closePicker");
  ariaQ("#tokenSetGrid", "tokenPairsAria");
  byQ(".selected-pair-label", "selectedLabel");
  byQ(".waiting-text", "waitingForOpponent");
  byQ(".waiting-note", "waitingNote");
  byId("inviteBtn", "inviteFriend");
  byId("playBotBtn", "playTheBot");
  byQ("#difficultyControl > span", "botLevel");
  const lvl = document.getElementById("difficulty");
  if (lvl && lvl.options) {
    const names = ["levelEasy", "levelMedium", "levelHard"];
    Array.prototype.forEach.call(lvl.options, (opt, i) => { if (names[i]) opt.textContent = t(names[i]); });
  }
  ariaQ("#chatToggle", "quickChat");
  byQ(".chat-picker-title", "quickChat");
  ariaQ("#customChatBack", "backToQuickChat");
  const chatInput = document.getElementById("customChatInput");
  if (chatInput) { chatInput.placeholder = t("typeMessage"); chatInput.setAttribute("aria-label", t("customMessage")); }
  byQ(".custom-chat-send", "send");

  // Anything already built re-renders with the new strings.
  try { if (chatPhrases) buildQuickChatPicker(); } catch (_) {}
  try { if (tokenSetGrid && tokenSetGrid.children.length) buildTokenSetPicker(); } catch (_) {}
  try { updateOwnershipCues(); } catch (_) {}
  // Name plates carry "You"/"Bot"/"Opponent" — re-render whichever mode is live.
  try { if (isMultiplayer) updatePlayerDisplay(); else setPlayerDisplayBot(); } catch (_) {}
  try { if (typeof updateStatus === "function" && !gameOver) updateStatus(); } catch (_) {}
}

const MAX_CHAT_LENGTH = 80;

// Every collectible is a coordinated two-sided set. The selected set always
// styles the whole board: slot 1 gets the first token and slot 2 its paired rival.
const TOKEN_SETS = [
  { id: "prism-pals", sides: ["assets/tokens/prism-pals-1.png", "assets/tokens/prism-pals-2.png"] },
  { id: "orbit-buddies", sides: ["assets/tokens/orbit-buddies-1.png", "assets/tokens/orbit-buddies-2.png"] },
  { id: "snack-spirits", sides: ["assets/tokens/snack-spirits-1.png", "assets/tokens/snack-spirits-2.png"] },
  { id: "garden-charms", sides: ["assets/tokens/garden-charms-1.png", "assets/tokens/garden-charms-2.png"] },
  { id: "royal-blooms", sides: ["assets/tokens/royal-blooms-1.png", "assets/tokens/royal-blooms-2.png"] },
  { id: "cozy-capybaras", sides: ["assets/tokens/cozy-capybaras-1.png", "assets/tokens/cozy-capybaras-2.png"] },
  { id: "sky-friends", sides: ["assets/tokens/sky-friends-1.png", "assets/tokens/sky-friends-2.png"] },
  { id: "forest-sprites", sides: ["assets/tokens/forest-sprites-1.png", "assets/tokens/forest-sprites-2.png"] },
  { id: "ocean-minis", sides: ["assets/tokens/ocean-minis-1.png", "assets/tokens/ocean-minis-2.png"] },
  { id: "tiny-dragons", sides: ["assets/tokens/tiny-dragons-1.png", "assets/tokens/tiny-dragons-2.png"] },
];
const DEFAULT_TOKEN_SET_ID = TOKEN_SETS[0].id;
const TOKEN_STORAGE_KEY = "c4:token-set";

function isTokenSetId(value) {
  return TOKEN_SETS.some((set) => set.id === value);
}

function loadSavedTokenSetId() {
  try {
    const saved = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (isTokenSetId(saved)) return saved;
  } catch (_) {}
  return DEFAULT_TOKEN_SET_ID;
}

// ── Game state ────────────────────────────────────────────
let board = [];
let current = 1;      // 1 = Red, 2 = Yellow
let gameOver = false;
let selectedTokenSetId = loadSavedTokenSetId();
let playerTokenSets = {};
let tokenChoiceConfirmed = false;

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
let pendingMoveId = null;
let lastAppliedSeq = 0; // Highest durable action sequence already reflected in `board`.
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
let restartPending = false;
let rematchSerial = 0;
let connectionPaused = false; // true while our socket is disconnected (block input)
let forfeitTimer = null;      // 20s grace countdown when the opponent leaves mid-game
const FORFEIT_GRACE_MS = 20000;
const STALE_SYNC_MS = 4000;
let lastNetworkProgressAt = Date.now();

// ── DOM refs ──────────────────────────────────────────────
const boardEl          = document.getElementById("board");
const statusEl         = document.getElementById("status");
const diffSelect       = document.getElementById("difficulty");
const difficultyControl= document.getElementById("difficultyControl");
const winnerBanner     = document.getElementById("winnerBanner");
const winnerNameDisplay= document.getElementById("winnerNameDisplay");
const winnerVerb       = document.getElementById("winnerVerb");
const winnerEmoji      = document.getElementById("winnerEmoji");
const winnerPlayAgain  = document.getElementById("winnerPlayAgain");

function showWinnerBanner() {
  if (winnerBanner) winnerBanner.hidden = false;
}

function hideWinnerBanner() {
  if (winnerBanner) {
    winnerBanner.hidden = true;
    winnerBanner.classList.remove("tie-result");
  }
}
const waitingOverlay   = document.getElementById("waitingOverlay");
const playBotBtn       = document.getElementById("playBotBtn");
const inviteBtn        = document.getElementById("inviteBtn");
const player1Avatar    = document.getElementById("player1Avatar");
const player2Avatar    = document.getElementById("player2Avatar");
const player1Panel     = document.getElementById("player1Panel");
const player2Panel     = document.getElementById("player2Panel");
const player1Name      = document.getElementById("player1Name");
const player2Name      = document.getElementById("player2Name");
const player1SeatLabel = document.getElementById("player1SeatLabel");
const player2SeatLabel = document.getElementById("player2SeatLabel");
const player1Token     = document.getElementById("player1Token");
const player2Token     = document.getElementById("player2Token");
const yourOwnerKey     = document.getElementById("yourOwnerKey");
const opponentOwnerKey = document.getElementById("opponentOwnerKey");
const yourLegendToken  = document.getElementById("yourLegendToken");
const opponentLegendToken = document.getElementById("opponentLegendToken");
const tokenEditBtn     = document.getElementById("tokenEditBtn");
const tokenEditPreview1= document.getElementById("tokenEditPreview1");
const tokenEditPreview2= document.getElementById("tokenEditPreview2");
const tokenSetGrid     = document.getElementById("tokenSetGrid");
const selectedTokenName= document.getElementById("selectedTokenName");
const tokenConfirmBtn  = document.getElementById("tokenConfirmBtn");
const tokenPickerClose = document.getElementById("tokenPickerClose");
const prepTitle        = document.getElementById("prepTitle");
const prepSubtitle     = document.getElementById("prepSubtitle");
const player1WinsEl    = document.querySelector("#player1Wins span");
const player2WinsEl    = document.querySelector("#player2Wins span");
const chatToggle       = document.getElementById("chatToggle");
const chatPicker       = document.getElementById("chatPicker");
const chatPhrases      = document.getElementById("chatPhrases");
const customChatForm   = document.getElementById("customChatForm");
const customChatBack   = document.getElementById("customChatBack");
const customChatInput  = document.getElementById("customChatInput");
const reactionLayer    = document.getElementById("reactionLayer");

function tokenSetById(id) {
  return TOKEN_SETS.find((set) => set.id === id) || TOKEN_SETS[0];
}

function tokenSetIdForSlot(slot) {
  // A catalog card is one complete versus set, never two mix-and-match skins.
  // Multiplayer players can keep their own cosmetic preference locally, while
  // both sides of that board always remain a coordinated pair.
  return selectedTokenSetId;
}

function tokenAssetForSlot(slot) {
  return tokenSetById(tokenSetIdForSlot(slot)).sides[slot === 2 ? 1 : 0];
}

function localPlayerSlot() {
  return isMultiplayer && myPlayer ? myPlayer : 1;
}

function ownershipForSlot(slot) {
  return slot === localPlayerSlot() ? "you" : "opponent";
}

function updateOwnershipCues() {
  const mine = localPlayerSlot();
  const opponent = mine === 1 ? 2 : 1;
  if (yourLegendToken) yourLegendToken.src = tokenAssetForSlot(mine);
  if (opponentLegendToken) opponentLegendToken.src = tokenAssetForSlot(opponent);
  if (yourOwnerKey) yourOwnerKey.dataset.player = mine;
  if (opponentOwnerKey) opponentOwnerKey.dataset.player = opponent;
  if (player1Panel) {
    player1Panel.classList.toggle("is-you", mine === 1);
    player1Panel.classList.toggle("is-opponent", mine !== 1);
  }
  if (player2Panel) {
    player2Panel.classList.toggle("is-you", mine === 2);
    player2Panel.classList.toggle("is-opponent", mine !== 2);
  }
  if (player1SeatLabel) player1SeatLabel.textContent = t(mine === 1 ? "seatYours" : "seatOpponent", t("colorBlue"));
  if (player2SeatLabel) player2SeatLabel.textContent = t(mine === 2 ? "seatYours" : "seatOpponent", t("colorCoral"));
}

function updateTokenSurfaces() {
  const sideOne = tokenAssetForSlot(1);
  const sideTwo = tokenAssetForSlot(2);
  if (player1Token) player1Token.src = sideOne;
  if (player2Token) player2Token.src = sideTwo;
  const ownSet = tokenSetById(selectedTokenSetId);
  if (tokenEditPreview1) tokenEditPreview1.src = ownSet.sides[0];
  if (tokenEditPreview2) tokenEditPreview2.src = ownSet.sides[1];
  updateOwnershipCues();
}

function refreshTokenPickerSelection() {
  const selected = tokenSetById(selectedTokenSetId);
  if (selectedTokenName) selectedTokenName.textContent = tokenSetName(selected);
  if (!tokenSetGrid) return;
  Array.from(tokenSetGrid.children || []).forEach((card) => {
    card.setAttribute("aria-checked", String(card.dataset.tokenSet === selectedTokenSetId));
  });
}

function announcePlayerProfile() {
  if (!myId || !window.Usion || !Usion.game || !Usion.game.realtime) return;
  try {
    Usion.game.realtime("player_info", {
      name: playerNames[myId],
      avatar: playerAvatars[myId] || null,
      tokenSet: selectedTokenSetId,
    });
  } catch (_) {}
}

function selectTokenSet(id, announce) {
  if (!isTokenSetId(id)) return false;
  selectedTokenSetId = id;
  if (myId) playerTokenSets[myId] = id;
  try { localStorage.setItem(TOKEN_STORAGE_KEY, id); } catch (_) {}
  refreshTokenPickerSelection();
  updateTokenSurfaces();
  if (board.length === ROWS) renderBoard();
  if (announce && isMultiplayer) {
    try { Usion.game.realtime("token_choice", { tokenSet: id }); } catch (_) {}
    announcePlayerProfile();
  }
  return true;
}

function buildTokenSetPicker() {
  if (!tokenSetGrid) return;
  tokenSetGrid.innerHTML = "";
  TOKEN_SETS.forEach((set) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "token-set-card";
    button.dataset.tokenSet = set.id;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(set.id === selectedTokenSetId));
    button.setAttribute("aria-label", tokenSetName(set));

    const pair = document.createElement("span");
    pair.className = "token-card-pair";
    set.sides.forEach((src, index) => {
      const image = document.createElement("img");
      image.src = src;
      image.alt = t(index === 0 ? "blueSide" : "coralSide");
      pair.appendChild(image);
    });

    const name = document.createElement("span");
    name.className = "token-set-name";
    name.textContent = tokenSetName(set);
    const sides = document.createElement("span");
    sides.className = "token-set-sides";
    sides.textContent = t("bluePlusCoral");
    button.appendChild(pair);
    button.appendChild(name);
    button.appendChild(sides);
    button.addEventListener("click", () => selectTokenSet(set.id, true));
    tokenSetGrid.appendChild(button);
  });
  refreshTokenPickerSelection();
  updateTokenSurfaces();
}

function showTokenPicker(phase) {
  if (!waitingOverlay) return;
  const nextPhase = phase || "picker";
  waitingOverlay.classList.add("show");
  waitingOverlay.setAttribute("aria-hidden", "false");
  waitingOverlay.dataset.phase = nextPhase;
  if (prepTitle) prepTitle.textContent = t(nextPhase === "waiting" ? "pickWhileWaiting" : "chooseTokenPair");
  if (prepSubtitle) prepSubtitle.textContent = t(nextPhase === "ready" ? "prepSubReady" : "prepSubDefault");
  if (tokenConfirmBtn) tokenConfirmBtn.textContent = t(nextPhase === "ready" ? "startWithPair" : "useThisPair");
  refreshTokenPickerSelection();
  updateChatButton();
}

function confirmTokenChoice() {
  tokenChoiceConfirmed = true;
  if (myId) playerTokenSets[myId] = selectedTokenSetId;
  selectTokenSet(selectedTokenSetId, true);
  if (waitingForOpponent) {
    if (tokenConfirmBtn) tokenConfirmBtn.textContent = t("pairSaved");
    return;
  }
  hideWaiting();
}

if (tokenConfirmBtn) tokenConfirmBtn.addEventListener("click", confirmTokenChoice);
if (tokenEditBtn) tokenEditBtn.addEventListener("click", () => showTokenPicker("picker"));
if (tokenPickerClose) tokenPickerClose.addEventListener("click", () => {
  if (!waitingForOpponent) hideWaiting();
});
buildTokenSetPicker();

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
// setState is actor-writable and CAS-versioned by the SDK: both clients deterministically
// apply the same sequenced action, so either may keep the checkpoint fresh. If an older
// write loses the CAS race, pull the winner instead of retrying stale state.
function writeCheckpoint() {
  if (!isMultiplayer) return;
  try {
    if (window.Usion && Usion.game && Usion.game.setState) {
      Promise.resolve(Usion.game.setState(getBoardSnapshot())).then((result) => {
        if (result && result.code === "STALE_STATE") requestAuthoritativeSync();
      }).catch(() => {});
    }
  } catch (_) {}
}

// ── Usion Init ────────────────────────────────────────────

const usionSdkAvailable = Boolean(window.Usion && typeof Usion.init === "function");
if (usionSdkAvailable) {
Usion.init(async function(config) {
  applyLang(detectLang(config.language)); // platform locale — before any UI is built
  myId = config.userId;
  playerNames[myId] = config.userName || t("you");
  if (config.userAvatar) playerAvatars[myId] = config.userAvatar;
  playerTokenSets[myId] = selectedTokenSetId;
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
}

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
function requestAuthoritativeSync() {
  if (!isMultiplayer || !window.Usion || !Usion.game || !Usion.game.requestSync) return;
  try {
    Promise.resolve(Usion.game.requestSync(0)).catch(() => {});
  } catch (_) {}
}

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
    if (!gameOver) updateStatus(t("connectionLost"));
  });
  Usion.game.onReconnect(() => {
    connectionPaused = false;
    // Re-sync on reconnect to catch missed actions / the host checkpoint.
    requestAuthoritativeSync();
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
  pendingMoveId = null;
  init();                 // reset to a clean board for the online match
  showWaiting();
  registerGameHandlers();
  requestAuthoritativeSync();
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
  requestAuthoritativeSync();
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

// A durable action should normally arrive exactly once, but a suspended WebView or
// a simulated-loss test can miss the push without producing a socket disconnect.
// While a match is idle, periodically ask for the sequenced log/checkpoint. This
// turns a lost opponent move (or a lost echo of our own move) into a short pause
// instead of a permanent "both players are waiting" dead end.
setInterval(function staleTurnWatchdog() {
  if (!isMultiplayer || gameOver || connectionPaused || forfeitTimer) return;
  if (Date.now() - lastNetworkProgressAt < STALE_SYNC_MS) return;
  lastNetworkProgressAt = Date.now();
  requestAuthoritativeSync();
}, 1000);

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
  if (data.sequence !== undefined) lastSequence = Number(data.sequence) || 0;
  lastNetworkProgressAt = Date.now();

  // Announce identity and the selected two-sided token set to the room.
  announcePlayerProfile();

  if (connectedCount >= 2 && waitingForOpponent) {
    startOnlineGame(data.game_state);
  } else if (waitingForOpponent && data.game_state && Array.isArray(data.game_state.board)) {
    // A host checkpoint in the join ack means a match is already underway — rejoin
    // it even if the live connected_count momentarily reads 1 (opponent not yet
    // counted). startOnlineGame → requestSync(0) → onSync rebuilds from it.
    startOnlineGame(data.game_state);
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
  lastNetworkProgressAt = Date.now();
  // Re-broadcast our identity and cosmetics to the new joiner.
  announcePlayerProfile();
  // Opponent came back during the forfeit grace window → cancel and resync.
  if (connectedCount >= 2 && forfeitTimer) {
    clearForfeitGrace();
    if (!gameOver) { updateStatus(); requestAuthoritativeSync(); }
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
  updateStatus(t("oppLeftRejoin", secs));
  forfeitTimer = setInterval(() => {
    if (gameOver || connectedCount > 1) { // resolved or opponent returned
      clearForfeitGrace();
      if (!gameOver) updateStatus();
      return;
    }
    secs -= 1;
    if (secs > 0) {
      updateStatus(t("oppLeftRejoin", secs));
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
  updateStatus(t("youWinOppLeft"));
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
    updateStatus(t("oppLeftGame"));
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
  if (!isMultiplayer) return;
  if (moveId && appliedMoveIds.has(moveId)) {
    if (seq) lastAppliedSeq = Math.max(lastAppliedSeq, seq);
    if (mine && (!pendingMoveId || pendingMoveId === moveId)) {
      pendingMove = false;
      pendingMoveId = null;
    }
    return;
  }
  if (seq && seq <= lastAppliedSeq) {
    if (mine && (!pendingMoveId || pendingMoveId === moveId)) {
      pendingMove = false;
      pendingMoveId = null;
    }
    return;
  }
  if (seq && seq > lastAppliedSeq + 1) {
    // We missed at least one durable action. Applying this one against the wrong
    // turn would manufacture a disk, so hydrate the gap first.
    requestAuthoritativeSync();
    return;
  }

  const expectedPlayerId = players[current - 1];
  const validTurn = !gameOver && expectedPlayerId && playerId === expectedPlayerId;
  const validColumn = Number.isInteger(col) && col >= 0 && col < COLS && board[0][col] === 0;
  if (!validTurn || !validColumn) {
    // Invalid/out-of-turn actions are still consumed in the durable sequence so
    // they cannot permanently wedge the next legitimate move behind a gap.
    if (moveId) appliedMoveIds.add(moveId);
    if (seq) lastAppliedSeq = Math.max(lastAppliedSeq, seq);
    if (mine && (!pendingMoveId || pendingMoveId === moveId)) {
      pendingMove = false;
      pendingMoveId = null;
    }
    return;
  }
  if (moveId) appliedMoveIds.add(moveId);
  if (seq) lastAppliedSeq = Math.max(lastAppliedSeq, seq);
  handleMove(col, false);                   // animate, advance turn, detect win/draw
  if (mine && (!pendingMoveId || pendingMoveId === moveId)) {
    pendingMove = false;
    pendingMoveId = null;
  }
  // Every client deterministically reaches this state, so either actor can refresh
  // the CAS-versioned checkpoint and keep the recovery tail minimal.
  writeCheckpoint();
}

function applyDurableRematchOffer(playerId, seq, offerId) {
  if (!isMultiplayer) return;
  if (offerId && appliedMoveIds.has(offerId)) return;
  if (seq && seq <= lastAppliedSeq) return;
  if (seq && seq > lastAppliedSeq + 1) { requestAuthoritativeSync(); return; }
  if (offerId) appliedMoveIds.add(offerId);
  if (seq) lastAppliedSeq = Math.max(lastAppliedSeq, seq);
  if (!gameOver) return;

  const bothRequested = rematchRequested && playerId !== myId;
  rematchRequested = playerId === myId || rematchRequested;
  rematchState = "requested";
  syncRematchUi();
  writeCheckpoint();
  if (bothRequested && isHostPlayer()) commitRematchRestart();
}

function applyDurableRestart(seq, restartId) {
  if (!isMultiplayer) return;
  if (restartId && appliedMoveIds.has(restartId)) return;
  if (seq && seq <= lastAppliedSeq) return;
  if (seq && seq > lastAppliedSeq + 1) { requestAuthoritativeSync(); return; }
  resetForRematch(seq, restartId);
  writeCheckpoint();
}

function onAction(data) {
  Usion.log("onAction: type=" + data.action_type + " player=" + data.player_id + " myId=" + myId + " seq=" + data.sequence);
  lastNetworkProgressAt = Date.now();
  if (data.sequence !== undefined) lastSequence = Math.max(lastSequence, Number(data.sequence) || 0);
  const payload = data.action_data || {};
  const seq = Number(data.sequence) || 0;
  if (data.action_type === "move") {
    applyDurableMove(data.player_id, payload.col, seq, payload.moveId);
  } else if (data.action_type === "rematch_offer") {
    applyDurableRematchOffer(data.player_id, seq, payload.offerId);
  } else if (data.action_type === "restart") {
    applyDurableRestart(seq, payload.restartId);
  }
}

function discCount(b) {
  let n = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (b[r][c]) n++;
  return n;
}

function isValidBoardState(candidate) {
  return Array.isArray(candidate) &&
    candidate.length === ROWS &&
    candidate.every((row) =>
      Array.isArray(row) &&
      row.length === COLS &&
      row.every((cell) => cell === 0 || cell === 1 || cell === 2)
    );
}

function resetBoardForReplay(baseSeq, actionId, beginNewMatch) {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  current = 1;
  gameOver = false;
  lastWinnerPlayer = 0;
  lastInsertedPos = null;
  rematchState = "idle";
  rematchRequested = false;
  restartPending = false;
  if (beginNewMatch) {
    winRecordedThisGame = false;
    statsRecordedThisGame = false;
    resultReportedThisGame = false;
  }
  appliedMoveIds = new Set();
  if (actionId) appliedMoveIds.add(actionId);
  lastAppliedSeq = Number(baseSeq) || 0;
  hideWinnerBanner();
}

// Drop a validated player's disc into `col` on the GLOBAL board, advancing the
// turn and detecting win/draw exactly like a live move but without animation.
function replayMoveSilent(playerId, col) {
  if (gameOver) return false;
  if (players[current - 1] !== playerId) return false;
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return false;
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

function storedActionId(action) {
  const payload = action.action_data || {};
  return payload.moveId || payload.offerId || payload.restartId || null;
}

function reconcilePendingMove() {
  if (!pendingMoveId) {
    pendingMove = false;
    return;
  }
  if (appliedMoveIds.has(pendingMoveId)) {
    pendingMove = false;
    pendingMoveId = null;
  }
}

// Deterministically fold one stored action into the board. Invalid actions still
// advance the sequence watermark but never alter a token or the turn.
function replayStoredAction(action) {
  const seq = Number(action.sequence) || 0;
  const actionId = storedActionId(action);
  if (actionId && appliedMoveIds.has(actionId)) {
    if (seq) lastAppliedSeq = Math.max(lastAppliedSeq, seq);
    return;
  }
  if (seq && seq <= lastAppliedSeq) return;

  if (action.action_type === "restart") {
    resetBoardForReplay(seq, actionId, true);
    return;
  }

  if (actionId) appliedMoveIds.add(actionId);
  if (seq) lastAppliedSeq = Math.max(lastAppliedSeq, seq);
  const payload = action.action_data || {};

  if (action.action_type === "rematch_offer") {
    if (gameOver) {
      rematchState = "requested";
      rematchRequested = rematchRequested || action.player_id === myId;
    }
    return;
  }

  if (action.action_type === "move") replayMoveSilent(action.player_id, payload.col);
}

function finalizeSyncRender() {
  renderBoard();
  if (gameOver && lastWinnerPlayer) {
    const cells = findWinningCells(lastWinnerPlayer);
    for (const [row, col] of cells) {
      const el = boardEl.children[row * COLS + col];
      if (el) el.classList.add("winner");
    }
    updateStatus(winnerStatusText(lastWinnerPlayer));
    showWinnerOverlay();
  } else if (gameOver) {
    updateStatus(t("tie"));
    showTieOverlay();
  } else {
    updateStatus();
  }
  // Do NOT write a checkpoint here: a rebuild from sync must not re-persist state (it
  // can race a fresher actor checkpoint backwards). Only the actor writes, on its move.
}

function onSync(data) {
  Usion.log("onSync: actions=" + (data.actions ? data.actions.length : 0) + " seq=" + data.sequence + " checkpoint=" + !!(data.game_state && data.game_state.board));
  lastNetworkProgressAt = Date.now();
  // Compare with the sequence actually reflected in the BOARD, not lastSequence:
  // onJoined reports the room's top sequence before this client has hydrated it.
  // The old `syncTop <= lastSequence` guard therefore discarded the very first
  // sync of a late/rejoining player, leaving opponent disks invisible forever.
  const syncTop = data.sequence !== undefined ? Number(data.sequence) : null;
  if (syncTop !== null && syncTop < lastAppliedSeq) return;
  if (syncTop !== null) {
    lastSnapshotVersion = Math.max(lastSnapshotVersion, syncTop);
    lastSequence = Math.max(lastSequence, syncTop);
  }

  const storedActions = (data.actions || []).filter(
    (a) => a && ["move", "rematch_offer", "restart"].includes(a.action_type)
  );
  const cp = (data.game_state && isValidBoardState(data.game_state.board)) ? data.game_state : null;
  if (!cp && storedActions.length === 0) {
    reconcilePendingMove();
    return;
  }

  if (cp) {
    // ALWAYS reconstruct as: latest CAS checkpoint (the authoritative base) +
    // only stored actions after it. The old code had two wrong paths for this:
    //   • "full replay from an empty board" dropped every PRE-checkpoint move → the
    //     board came back SHORT (under-count / desync), and
    //   • replaying an INCLUSIVE tail (the server re-sends the checkpoint's own last
    //     move) onto the checkpoint DOUBLED moves → the "too many disks" phantom that
    //     then got persisted into the next checkpoint and snowballed.
    // A checkpoint may still lag while its async write is in flight; those actions
    // live in the tail and are applied below.
    applyCheckpoint(cp);                 // base board + current + dedup watermarks
    // Legacy checkpoints did not carry seq. Disc count is a safe fallback only for
    // those old snapshots; modern checkpoints may include non-move rematch actions.
    if (!(Number(cp.seq) > 0)) lastAppliedSeq = Math.max(lastAppliedSeq, discCount(board));
    for (const action of storedActions) {
      const seq = Number(action.sequence) || 0;
      const id = storedActionId(action);
      if (!seq && !id) continue; // checkpoint already wins; unprovable inclusive item
      replayStoredAction(action);
    }
    finalizeSyncRender();
    reconcilePendingMove();
    return;
  }

  // No checkpoint yet: the stored log is the full history. Replaying restart
  // actions as well as moves makes every rematch recoverable.
  resetBoardForReplay(0);
  for (const action of storedActions) replayStoredAction(action);
  finalizeSyncRender();
  reconcilePendingMove();
}

function onRealtime(data) {
  if (data.player_id && data.player_id !== myId) lastNetworkProgressAt = Date.now();
  if (data.action_type === "quick_chat" && data.player_id !== myId) {
    const phrase = normalizeChatMessage(data.action_data && data.action_data.phrase);
    const player = players.indexOf(data.player_id) + 1;
    if (player > 0 && phrase) showQuickChatBubble(player, phrase);
    return;
  }

  if (data.action_type === "player_info" && data.player_id !== myId) {
    if (data.action_data.name)   playerNames[data.player_id]   = data.action_data.name;
    if (data.action_data.avatar) playerAvatars[data.player_id] = data.action_data.avatar;
    if (isTokenSetId(data.action_data.tokenSet)) playerTokenSets[data.player_id] = data.action_data.tokenSet;
    updatePlayerDisplay();
    renderBoard();
    return;
  }

  if (data.action_type === "token_choice" && data.player_id !== myId) {
    const tokenSet = data.action_data && data.action_data.tokenSet;
    if (isTokenSetId(tokenSet)) {
      playerTokenSets[data.player_id] = tokenSet;
      updateTokenSurfaces();
      renderBoard();
    }
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
    if (isHostPlayer()) commitRematchRestart();
    return;
  }
  rematchState = "requested";
  syncRematchUi();
}


function onGameRestarted() {
  // Direct/older hosts may use the platform restart event, which resets its
  // action sequence. The normal relay path uses our stored `restart` action.
  lastSequence = 0;
  resetForRematch(0);
}

function startOnlineGame(initialState) {
  isMultiplayer = true;
  waitingForOpponent = false;

  myPlayer = players.indexOf(myId) + 1; // 1 or 2

  updatePlayerDisplay();
  setWinsVisibility(true);
  syncPlayerWinsFromStorage();
  syncControlVisibility();
  init();
  if (initialState && Array.isArray(initialState.board)) applyCheckpoint(initialState);
  if (tokenChoiceConfirmed) hideWaiting();
  else showTokenPicker("ready");

  // Always sync once at game start so a move sent during the join race is replayed.
  requestAuthoritativeSync();
}

function updatePlayerDisplay() {
  const p1id = players[0];
  const p2id = players[1];

  if (p1id) {
    const isMe = p1id === myId;
    player1Name.textContent = isMe ? t("you") : (playerNames[p1id] || t("opponent"));
    if (playerAvatars[p1id]) player1Avatar.src = playerAvatars[p1id];
  }
  if (p2id) {
    const isMe = p2id === myId;
    player2Name.textContent = isMe ? t("you") : (playerNames[p2id] || t("opponent"));
    if (playerAvatars[p2id]) player2Avatar.src = playerAvatars[p2id];
  }
  updateTokenSurfaces();
}

function setPlayerDisplayBot() {
  player1Name.textContent = playerNames[myId] || t("you");
  player2Name.textContent = t("bot");
  if (playerAvatars[myId]) player1Avatar.src = playerAvatars[myId];
  player2Avatar.src = tokenAssetForSlot(2);
  setWinsVisibility(false);
  updateTokenSurfaces();
}

// ── Waiting overlay ───────────────────────────────────────

function showWaiting() {
  waitingForOpponent = true;
  tokenChoiceConfirmed = false;
  showTokenPicker("waiting");
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
  waitingOverlay.setAttribute("aria-hidden", "true");
  updateChatButton();
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
  tokenChoiceConfirmed = true;
  pendingMove = false;
  pendingMoveId = null;
  hideWaiting();
  syncControlVisibility();
  setPlayerDisplayBot();
  init();
});

// ── Controls ──────────────────────────────────────────────

function syncControlVisibility() {
  if (difficultyControl) difficultyControl.style.display = isMultiplayer ? "none" : "";
  else diffSelect.style.display = isMultiplayer ? "none" : "";
}

// ── Rematch ───────────────────────────────────────────────

function requestRematch() {
  if (restartPending || rematchRequested) return;
  rematchRequested = true;
  rematchState = "requested";
  syncRematchUi();
  const offerId = myId + ":" + sessionNonce + ":offer:" + (++rematchSerial);
  Usion.game.action("rematch_offer", { offerId }).catch(() => {
    rematchRequested = false;
    rematchState = "idle";
    syncRematchUi();
    requestAuthoritativeSync();
  });
}

function acceptRematch() {
  rematchRequested = true;
  rematchState = "requested";
  syncRematchUi();
  commitRematchRestart();
}

function commitRematchRestart() {
  if (restartPending) return;
  restartPending = true;
  const restartId = myId + ":" + sessionNonce + ":restart:" + (++rematchSerial);
  Usion.game.action("restart", { restartId }).catch(() => {
    restartPending = false;
    requestAuthoritativeSync();
  });
}

function resetForRematch(baseSeq, restartId) {
  rematchRequested = false;
  rematchState = "idle";
  restartPending = false;
  pendingMove = false;
  pendingMoveId = null;
  lastSnapshotVersion = 0;
  hideWinnerBanner();
  winnerPlayAgain.textContent = t("rematch");
  winnerPlayAgain.disabled = false;
  winnerPlayAgain.onclick = requestRematch;
  init();
  if (restartId) appliedMoveIds.add(restartId);
  lastAppliedSeq = Number(baseSeq) || 0;
  if (lastAppliedSeq) lastSequence = Math.max(lastSequence, lastAppliedSeq);
}


// ── Game Core ─────────────────────────────────────────────

function init() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  current = 1;
  gameOver = false;
  pendingMove = false;
  pendingMoveId = null;
  lastAppliedSeq = 0;
  appliedMoveIds = new Set();
  lastWinnerPlayer = 0;
  lastSnapshotVersion = 0;
  lastSnapshotVersionByPlayer = {};
  rematchState = "idle";
  restartPending = false;
  lastInsertedPos = null;
  winRecordedThisGame = false;
  statsRecordedThisGame = false;
  resultReportedThisGame = false;
  lastNetworkProgressAt = Date.now();
  clearForfeitGrace();
  hideWinnerBanner();
  updateTokenSurfaces();
  renderBoard();
  updateStatus();
  updateWinCounts();
  updateChatButton();
}

// ── Quick chat ───────────────────────────────────────────
// Realtime-only and cosmetic: messages never enter the durable action log or
// alter the board/turn state.
let chatOpen = false;
let customChatOpen = false;
let lastQuickChatAt = 0;

function normalizeChatMessage(value) {
  if (typeof value !== "string") return "";
  const message = value.trim().replace(/\s+/g, " ");
  return message && message.length <= MAX_CHAT_LENGTH ? message : "";
}

function buildQuickChatPicker() {
  if (!chatPhrases) return;
  chatPhrases.innerHTML = "";
  t("quickChatPhrases").forEach((phrase) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chat-phrase";
    button.textContent = phrase;
    button.addEventListener("click", () => sendQuickChat(phrase));
    chatPhrases.appendChild(button);
  });
  const customButton = document.createElement("button");
  customButton.type = "button";
  customButton.id = "customChatToggle";
  customButton.className = "chat-phrase chat-custom-toggle";
  customButton.textContent = t("customChatToggle");
  customButton.setAttribute("aria-controls", "customChatForm");
  customButton.setAttribute("aria-expanded", String(customChatOpen));
  customButton.addEventListener("click", () => setCustomChatOpen(true, true));
  chatPhrases.appendChild(customButton);
}

function updateChatKeyboardInset() {
  if (!chatPicker || !customChatOpen || !window.visualViewport) return;
  const visualBottom = window.visualViewport.height + window.visualViewport.offsetTop;
  const covered = Math.max(0, Math.min(window.innerHeight * 0.7, window.innerHeight - visualBottom));
  setChatKeyboardInset(Math.round(covered) + "px");
}

function setChatKeyboardInset(value) {
  if (!chatPicker) return;
  if (typeof chatPicker.style.setProperty === "function") chatPicker.style.setProperty("--chat-keyboard-inset", value);
  else chatPicker.style["--chat-keyboard-inset"] = value;
}

function setCustomChatOpen(open, focusInput) {
  customChatOpen = Boolean(open);
  if (chatPicker) chatPicker.classList.toggle("custom-mode", customChatOpen);
  if (chatToggle) chatToggle.classList.toggle("custom-mode", customChatOpen);
  if (customChatForm) customChatForm.hidden = !customChatOpen;
  const customButton = document.getElementById("customChatToggle");
  if (customButton) customButton.setAttribute("aria-expanded", String(customChatOpen));
  if (!customChatOpen && customChatInput && document.activeElement === customChatInput) customChatInput.blur();
  if (customChatOpen && focusInput && customChatInput) {
    try { customChatInput.focus({ preventScroll: true }); } catch (_) { customChatInput.focus(); }
    updateChatKeyboardInset();
  }
  if (!customChatOpen) setChatKeyboardInset("0px");
}

function setChatPickerOpen(open) {
  chatOpen = Boolean(open);
  if (!chatOpen) setCustomChatOpen(false, false);
  if (chatPicker) {
    chatPicker.classList.toggle("show", chatOpen);
    chatPicker.setAttribute("aria-hidden", String(!chatOpen));
  }
  if (chatToggle) chatToggle.setAttribute("aria-expanded", String(chatOpen));
}

function updateChatButton() {
  if (!chatToggle) return;
  const show = board.length === ROWS && (!waitingOverlay.classList.contains("show") || !waitingForOpponent);
  chatToggle.classList.toggle("show-btn", show);
  if (!show && chatOpen) setChatPickerOpen(false);
}

function sendQuickChat(value) {
  const phrase = normalizeChatMessage(value);
  if (!phrase) return false;
  const now = Date.now();
  if (now - lastQuickChatAt < 700) return false;
  lastQuickChatAt = now;
  setChatPickerOpen(false);

  const player = myPlayer || 1;
  showQuickChatBubble(player, phrase);
  if (isMultiplayer && window.Usion && Usion.game && Usion.game.realtime) {
    try { Usion.game.realtime("quick_chat", { phrase }); } catch (_) {}
  }
  return true;
}

function showQuickChatBubble(player, value) {
  const phrase = normalizeChatMessage(value);
  if (!reactionLayer || !phrase) return;
  const anchor = document.getElementById(player === 2 ? "player2Panel" : "player1Panel");
  if (!anchor) return;

  const rect = anchor.getBoundingClientRect();
  const bubble = document.createElement("div");
  bubble.className = "reaction-bubble player-" + player;
  bubble.textContent = phrase;
  reactionLayer.appendChild(bubble);

  const width = bubble.offsetWidth;
  const height = bubble.offsetHeight;
  const centeredLeft = rect.left + rect.width / 2 - width / 2;
  bubble.style.left = Math.max(8, Math.min(centeredLeft, window.innerWidth - width - 8)) + "px";
  bubble.style.top = (rect.top > height + 14 ? rect.top - height - 8 : rect.bottom + 8) + "px";

  requestAnimationFrame(() => bubble.classList.add("pop"));
  setTimeout(() => bubble.classList.add("out"), 1900);
  setTimeout(() => bubble.remove(), 2350);
}

if (chatToggle) {
  chatToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setChatPickerOpen(!chatOpen);
  });
}
if (chatPicker) chatPicker.addEventListener("click", (event) => event.stopPropagation());
if (customChatBack) customChatBack.addEventListener("click", () => setCustomChatOpen(false, false));
if (customChatForm) customChatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (customChatInput && sendQuickChat(customChatInput.value)) customChatInput.value = "";
});
document.addEventListener("click", () => {
  if (chatOpen) setChatPickerOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && chatOpen) setChatPickerOpen(false);
});
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", updateChatKeyboardInset);
  window.visualViewport.addEventListener("scroll", updateChatKeyboardInset);
}
buildQuickChatPicker();


let lastInsertedPos = null; // {r, c} of the most recently placed disk

function renderBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.setAttribute("role", "button");
      cell.setAttribute("aria-label", t("dropInColumn", c + 1));
      cell.tabIndex = 0;
      if (board[r][c]) {
        const slot = board[r][c];
        const owner = ownershipForSlot(slot);
        cell.dataset.player = slot;
        cell.dataset.owner = owner;
        cell.setAttribute("aria-label", t("tokenInColumn", owner, c + 1));
        const token = document.createElement("img");
        token.className = "token-art";
        token.src = tokenAssetForSlot(slot);
        token.alt = "";
        cell.appendChild(token);
        if (lastInsertedPos && lastInsertedPos.r === r && lastInsertedPos.c === c) {
          cell.classList.add("last-inserted");
        }
      }
      boardEl.appendChild(cell);
    }
  }
}

function playerLabelForStatus(playerId, fallback) {
  if (!playerId) return fallback || t("player");
  return playerNames[playerId] || fallback || t("player");
}

function roleNameForSlot(slot) {
  if (slot === localPlayerSlot()) return t("you");
  if (!isMultiplayer) return t("bot");
  return playerLabelForStatus(players[slot - 1], t("opponent"));
}

function winnerStatusText(slot) {
  return t("winStatus", roleNameForSlot(slot), slot === localPlayerSlot());
}

function updateStatus(text) {
  if (text) {
    statusEl.removeAttribute("data-player");
    statusEl.removeAttribute("data-owner");
    statusEl.textContent = text;
    return;
  }
  // While the opponent is gone, the grace countdown owns the status line — don't
  // let a stray resync overwrite the "paused / waiting to rejoin" message.
  if (forfeitTimer && !gameOver) return;

  if (isMultiplayer) {
    if (gameOver) {
      if (lastWinnerPlayer) {
        updateStatus(winnerStatusText(lastWinnerPlayer));
      } else {
        updateStatus(t("tie"));
      }
      return;
    }

    const color = current === 1 ? "#25bfe4" : "#ff6966";
    const isMine = current === localPlayerSlot();
    const turnLabel = isMine ? t("yourTurn") : t("othersTurn", roleNameForSlot(current));
    statusEl.dataset.player = current;
    statusEl.dataset.owner = isMine ? "you" : "opponent";
    statusEl.innerHTML = '<span style="color:' + color + ';font-weight:900;">' + turnLabel + '</span>';
    return;
  }

  if (gameOver) return;
  const color = current === 1 ? "#25bfe4" : "#ff6966";
  const isMine = current === 1;
  statusEl.dataset.player = current;
  statusEl.dataset.owner = isMine ? "you" : "opponent";
  statusEl.innerHTML = '<span style="color:' + color + ';font-weight:900;">' + (isMine ? t("yourTurn") : t("botsTurn")) + '</span>';
}


boardEl.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const cell = e.target.closest(".cell");
  if (!cell) return;
  e.preventDefault();
  if (typeof cell.click === "function") cell.click();
});

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
    pendingMoveId = moveId;
    Usion.game.action("move", { col, moveId }).catch((err) => {
      if (pendingMoveId === moveId) {
        pendingMove = false;
        pendingMoveId = null;
      }
      Usion.log("move send failed: " + (err && err.message ? err.message : err));
      requestAuthoritativeSync();
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
    tokenSets: Object.assign({}, playerTokenSets), // cosmetic choices survive reconnects without entering the move log
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
  const isTie = !lastWinnerPlayer;

  if (rematchState === "requested") {
    if (rematchRequested) {
      winnerPlayAgain.textContent = t(isTie ? "waitingForRestart" : "waitingForRematch");
      winnerPlayAgain.disabled = true;
      winnerPlayAgain.onclick = requestRematch;
    } else {
      winnerPlayAgain.textContent = t(isTie ? "restartGame" : "acceptRematch");
      winnerPlayAgain.disabled = false;
      winnerPlayAgain.onclick = acceptRematch;
    }
    return;
  }

  winnerPlayAgain.textContent = t(isTie ? "restartGame" : "rematch");
  winnerPlayAgain.disabled = false;
  winnerPlayAgain.onclick = requestRematch;
}

function showWinnerOverlay() {
  if (!gameOver || !lastWinnerPlayer) return;

  const winnerName = roleNameForSlot(lastWinnerPlayer);
  const color = lastWinnerPlayer === 1 ? "#167fb4" : "#cf4051";

  winnerBanner.classList.remove("tie-result");
  winnerNameDisplay.textContent = winnerName;
  if (winnerVerb) winnerVerb.textContent = t(lastWinnerPlayer === localPlayerSlot() ? "winTheShelf" : "winsTheShelf");
  winnerNameDisplay.style.color = color;
  winnerEmoji.textContent = "🏆";
  showWinnerBanner();
  syncRematchUi();
}

function showTieOverlay() {
  if (!gameOver || lastWinnerPlayer) return;
  winnerBanner.classList.add("tie-result");
  winnerNameDisplay.textContent = t("tie");
  winnerNameDisplay.style.color = "#b87908";
  if (winnerVerb) winnerVerb.textContent = "";
  winnerEmoji.textContent = "🤝";
  showWinnerBanner();

  if (isMultiplayer) {
    syncRematchUi();
  } else {
    winnerPlayAgain.textContent = t("restartGame");
    winnerPlayAgain.disabled = false;
    winnerPlayAgain.onclick = () => {
      hideWinnerBanner();
      init();
    };
  }
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
  if (!state || typeof state !== "object" || !isValidBoardState(state.board)) return false;
  isMultiplayer = true;
  // trusted=true: the onSync `game_state` is the SERVER's authoritative latest. Now
  // that BOTH players write checkpoints (actor-written), attributing every checkpoint
  // to the host id and applying the per-sender clock guard would let a skewed clock
  // drop a valid newer checkpoint. The server already resolved last-writer-wins, so
  // bypass the realtime ordering guard here.
  return applyBoardSnapshot(state, state.order && state.order[0] ? state.order[0] : (players[0] || "host"), true);
}

function applyBoardSnapshot(snapshot, senderId, trusted) {
  if (!snapshot || !isValidBoardState(snapshot.board)) return false;
  if (snapshot.seq !== undefined && Number(snapshot.seq) < lastAppliedSeq) return false;
  const version = Number(snapshot.version || 0);
  // Order snapshots per-sender: each sender's own clock is monotonic, so this
  // drops only genuinely out-of-order packets from THAT player. Comparing across
  // two devices' clocks (skew) used to drop valid moves and deadlock the game.
  // Skipped for `trusted` (server-authoritative checkpoint) snapshots.
  const prevFromSender = lastSnapshotVersionByPlayer[senderId] || 0;
  if (!trusted && version && version < prevFromSender) return false;
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
  if (snapshot.tokenSets && typeof snapshot.tokenSets === "object") {
    Object.keys(snapshot.tokenSets).forEach((playerId) => {
      const tokenSet = snapshot.tokenSets[playerId];
      if (isTokenSetId(tokenSet)) playerTokenSets[playerId] = tokenSet;
    });
  }
  board = snapshot.board.map((row) => row.slice());
  // Adopt the dedup watermarks the snapshot/checkpoint carries. This is THE fix for
  // the host-resume phantom: the checkpoint bakes its moves into `board`, and the
  // INCLUSIVE sync tail re-sends the checkpoint's own last move — so unless we know
  // those moves are "already applied", onSync replays them again and stacks a
  // duplicate disc (seen only on the device returning from background, since it is
  // the one that re-syncs). An empty rematch board still carries a non-zero
  // restart sequence; preserving it prevents old-match actions from leaking in.
  appliedMoveIds = new Set(Array.isArray(snapshot.moveIds) ? snapshot.moveIds : []);
  if (snapshot.seq !== undefined && snapshot.seq !== null) {
    lastAppliedSeq = Number(snapshot.seq) || 0;
  }
  current = snapshot.current === 2 ? 2 : 1;
  gameOver = !!snapshot.gameOver;
  lastWinnerPlayer = snapshot.lastWinnerPlayer === 2 ? 2 : (snapshot.lastWinnerPlayer === 1 ? 1 : 0);
  rematchState = ["idle", "requested"].includes(snapshot.rematchState) ? snapshot.rematchState : rematchState;
  reconcilePendingMove();
  if (snapshot.lastInsertedPos && typeof snapshot.lastInsertedPos.r === "number") {
    lastInsertedPos = snapshot.lastInsertedPos;
  } else {
    lastInsertedPos = null;
  }
  hideWinnerBanner();
  updateTokenSurfaces();
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
    updateStatus(winnerStatusText(lastWinnerPlayer));
    showWinnerOverlay();
  } else if (isFull()) {
    recordOutcome(0);
    updateStatus(t("tie"));
    showTieOverlay();
  } else {
    updateStatus();
  }
  return true;
}


function animateDrop(col, targetRow, player, onDone) {
  const targetCell = boardEl.children[targetRow * COLS + col];
  const boardRect = boardEl.getBoundingClientRect();
  const cellRect = targetCell.getBoundingClientRect();
  const cellSize = cellRect.width;

  const disk = document.createElement("div");
  disk.className = "drop-disk";
  disk.dataset.player = player;
  disk.dataset.owner = ownershipForSlot(player);
  const token = document.createElement("img");
  token.className = "token-art";
  token.src = tokenAssetForSlot(player);
  token.alt = "";
  disk.appendChild(token);

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

        const name = roleNameForSlot(player);
        const color = player === 1 ? "#167fb4" : "#cf4051";

        updateStatus(winnerStatusText(player));

        setTimeout(() => {
          winnerNameDisplay.textContent = name;
          if (winnerVerb) winnerVerb.textContent = t(player === localPlayerSlot() ? "winTheShelf" : "winsTheShelf");
          winnerNameDisplay.style.color = color;
          winnerEmoji.textContent = "🏆";
          showWinnerBanner();
          spawnConfetti();

          if (isMultiplayer) {
            rematchState = "idle";
            syncRematchUi();
          } else {
            winnerPlayAgain.textContent = t("playAgain");
            winnerPlayAgain.disabled = false;
            winnerPlayAgain.onclick = () => {
              hideWinnerBanner();
              init();
            };
          }
        }, 600);

      } else if (isDraw) {
        updateStatus(t("tie"));
        setTimeout(showTieOverlay, 320);
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
  const colors = ["#25bfe4","#ff6966","#ffd166","#64c98a","#fff0cf","#7d74df"];
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
applyLang(detectLang());   // best-effort locale before the host is known
setWinsVisibility(false);
syncControlVisibility();
if (!usionSdkAvailable) {
  // Direct local-file preview: the hosted Usion SDK can be unavailable when
  // index.html is opened from disk. Keep the complete solo game usable instead
  // of leaving an empty lacquer cabinet with no board cells.
  hideWaiting();
  setPlayerDisplayBot();
  init();
}
