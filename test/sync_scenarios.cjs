const { test, ok, eq, run } = require("../../13/test/lib/tap.cjs");
const { offlineClient, onlinePair, countDisks } = require("./harness.cjs");

function assertConsistent(host, guest, message) {
  const a = host.snap();
  const b = guest.snap();
  eq(b.board, a.board, (message || "") + " board");
  eq(b.current, a.current, (message || "") + " turn");
  eq(b.gameOver, a.gameOver, (message || "") + " gameOver");
  eq(b.winner, a.winner, (message || "") + " winner");
}

async function play(world, client, col) {
  client.move(col);
  await world.advance(300);
}

async function winForHost(world, host, guest) {
  await play(world, host, 0);
  await play(world, guest, 6);
  await play(world, host, 1);
  await play(world, guest, 6);
  await play(world, host, 2);
  await play(world, guest, 5);
  await play(world, host, 3);
  await world.advance(700);
}

test("direct local-file startup renders a complete solo board without the hosted SDK", () => {
  const local = offlineClient();
  eq(local.doc.getElementById("board").children.length, 42, "all board openings render");
  eq(local.read("board.length"), 6, "solo board state initializes");
  eq(local.doc.getElementById("status").textContent, "Your turn", "solo turn is clearly owned");
  local.run("board[5][0] = 1; board[5][1] = 2; renderBoard();");
  eq(local.doc.getElementById("board").children[35].dataset.owner, "you", "local token is marked as yours");
  eq(local.doc.getElementById("board").children[36].dataset.owner, "opponent", "bot token is marked as opponent");
  ok(local.doc.getElementById("player1Panel").classList.contains("is-you"), "your player card is emphasized");
  eq(local.errors.length, 0, "offline startup has no runtime errors");
});

test("normal alternating moves stay identical on both clients", async () => {
  const { world, host, guest } = await onlinePair();
  eq(host.snap().myPlayer, 1);
  eq(guest.snap().myPlayer, 2);
  await play(world, host, 3);
  await play(world, guest, 4);
  await play(world, host, 3);
  assertConsistent(host, guest, "alternating");
  eq(countDisks(host.snap().board), 3);
  eq(host.snap().current, 2);
});

test("quick chat uses the requested phrases and reaches the opponent without changing play", async () => {
  const { world, host, guest } = await onlinePair();
  const expected = [
    "юм авцаан",
    "чи болчихжээ",
    "би болчихжээ",
    "хурдлаад өгөөрэй",
    "муу юм бэ",
    "амтагдахгүй юм байна дөө",
    "EASY!",
    "GG!",
    "Өөрийн мессеж",
  ];
  const buttons = host.doc.querySelectorAll(".chat-phrase");
  eq(Array.from(buttons).map((button) => button.textContent), expected, "picker phrases");
  ok(host.doc.getElementById("chatToggle").classList.contains("show-btn"), "chat is available in game");

  const beforeHost = host.snap();
  const beforeGuest = guest.snap();
  buttons[3].dispatch("click");
  await world.advance(300);

  eq(host.doc.querySelectorAll(".reaction-bubble").length, 1, "sender sees their bubble");
  eq(guest.doc.querySelectorAll(".reaction-bubble").length, 1, "opponent receives the bubble");
  eq(host.snap().board, beforeHost.board, "sender board is unchanged");
  eq(guest.snap().board, beforeGuest.board, "opponent board is unchanged");
  eq(host.snap().current, beforeHost.current, "sender turn is unchanged");
  eq(guest.snap().current, beforeGuest.current, "opponent turn is unchanged");
});

test("custom quick chat opens the composer and synchronizes typed text", async () => {
  const { world, host, guest } = await onlinePair();
  host.doc.getElementById("chatToggle").dispatch("click");
  host.doc.querySelectorAll(".chat-custom-toggle")[0].dispatch("click");
  eq(host.doc.getElementById("customChatForm").hidden, false, "custom composer opens");
  host.doc.getElementById("customChatInput").value = "  Great   match!  ";
  host.doc.getElementById("customChatForm").dispatch("submit");
  await world.advance(300);

  eq(host.doc.querySelectorAll(".reaction-bubble")[0].textContent, "Great match!", "sender sees normalized custom text");
  eq(guest.doc.querySelectorAll(".reaction-bubble")[0].textContent, "Great match!", "opponent receives custom text");
});

test("a rejoining client hydrates a checkpoint even when join sequence is equal", async () => {
  const { world, host, guest, roster } = await onlinePair();
  await play(world, host, 2);
  await play(world, guest, 3);
  await play(world, host, 2);
  const expected = host.snap().board;

  guest.sdk.netDrop(true);
  await world.advance(100);
  const replacement = world.add("u2", "Bob");
  replacement.start(roster);
  await world.advance(700);

  eq(replacement.snap().board, expected, "join ack + equal-sequence sync must hydrate");
  eq(replacement.snap().current, host.snap().current);
  eq(countDisks(replacement.snap().board), 3);
});

test("lost opponent action self-heals instead of dead-ending both turns", async () => {
  const { world, host, guest } = await onlinePair();
  world.server.dropNext.push({ to: "u2", type: "action", actionType: "move" });
  await play(world, host, 0);
  eq(countDisks(guest.snap().board), 0, "forced loss reproduced");
  eq(host.snap().current, 2);
  eq(guest.snap().current, 1);

  await world.advance(5000);
  assertConsistent(host, guest, "watchdog recovery");
  eq(countDisks(guest.snap().board), 1);
  eq(guest.snap().current, 2);
});

test("lost self echo unlocks pending input through sync", async () => {
  const { world, host, guest } = await onlinePair();
  world.server.dropNext.push({ to: "u1", type: "action", actionType: "move" });
  await play(world, host, 1);
  ok(host.snap().pendingMove, "sender remains locked before recovery");
  eq(countDisks(guest.snap().board), 1);

  await world.advance(5000);
  assertConsistent(host, guest, "lost echo recovery");
  ok(!host.snap().pendingMove, "sync unlocks sender");
});

test("an older sync cannot unlock a move that is still in flight", async () => {
  const { world, host, guest } = await onlinePair();
  host.move(2);
  ok(host.snap().pendingMove);
  host.run(`onSync({ actions: [], game_state: null, sequence: 0 })`);
  ok(host.snap().pendingMove, "old sync must preserve the input lock");
  ok(host.snap().pendingMoveId, "pending move identity is retained");
  await world.advance(300);
  assertConsistent(host, guest, "in-flight move");
  ok(!host.snap().pendingMove);
  eq(countDisks(host.snap().board), 1);
});

test("duplicate durable delivery never inserts a phantom token", async () => {
  const { world, host, guest } = await onlinePair();
  await play(world, host, 5);
  const action = world.room.log[0];
  world.server.push(host.sdk, "action", action);
  world.server.push(guest.sdk, "action", action);
  await world.advance(300);
  assertConsistent(host, guest, "duplicate");
  eq(countDisks(host.snap().board), 1);
});

test("a delayed stale sync cannot roll the board backward", async () => {
  const { world, host, guest } = await onlinePair();
  await play(world, host, 0);
  const stale = {
    actions: [world.room.log[0]],
    game_state: JSON.parse(JSON.stringify(world.room.state)),
    sequence: 1,
  };
  await play(world, guest, 1);
  const expected = host.snap().board;
  host.run(`onSync(${JSON.stringify(stale)})`);
  eq(host.snap().board, expected);
  assertConsistent(host, guest, "stale sync");
});

test("foregrounding after a missed move restores the exact board", async () => {
  const { world, host, guest } = await onlinePair();
  guest.freeze();
  await play(world, host, 4);
  eq(countDisks(guest.snap().board), 0);
  guest.thaw();
  await world.advance(500);
  assertConsistent(host, guest, "foreground");
  eq(countDisks(guest.snap().board), 1);
});

test("out-of-turn actions are consumed but cannot place a token", async () => {
  const { world, host, guest } = await onlinePair();
  guest.run(`Usion.game.action("move", { col: 0, moveId: "invalid-guest" })`);
  await world.advance(300);
  assertConsistent(host, guest, "invalid action");
  eq(countDisks(host.snap().board), 0);
  eq(host.snap().current, 1);

  await play(world, host, 1);
  assertConsistent(host, guest, "valid action after invalid one");
  eq(countDisks(host.snap().board), 1);
  eq(host.snap().current, 2);
});

test("a full column is rejected without consuming a turn", async () => {
  const { world, host, guest } = await onlinePair();
  for (let i = 0; i < 3; i++) {
    await play(world, host, 0);
    await play(world, guest, 0);
  }
  eq(countDisks(host.snap().board), 6);
  eq(host.snap().current, 1);
  const seq = world.room.seq;
  host.move(0);
  await world.advance(200);
  eq(world.room.seq, seq, "full-column tap is not sent");
  eq(host.snap().current, 1);
  ok(!host.snap().pendingMove);
  await play(world, host, 1);
  assertConsistent(host, guest, "move after full column");
  eq(countDisks(host.snap().board), 7);
});

test("a malformed checkpoint falls back to the durable action log", async () => {
  const { world, host, guest, roster } = await onlinePair({ syncModel: "cpTailInclusive" });
  await play(world, host, 3);
  world.room.state.board = [];
  guest.sdk.netDrop(true);
  await world.advance(100);
  const replacement = world.add("u2", "Bob");
  replacement.start(roster);
  await world.advance(700);
  eq(replacement.snap().board, host.snap().board);
  eq(countDisks(replacement.snap().board), 1);
  eq(replacement.snap().current, 2);
  ok(replacement.errors.length === 0, "malformed network state must not crash the game");
});

test("rematch offer, restart, and post-rematch rejoin are durable", async () => {
  const { world, host, guest, roster } = await onlinePair({ syncModel: "cpTailInclusive" });
  await winForHost(world, host, guest);
  assertConsistent(host, guest, "first match finish");
  ok(host.snap().gameOver);

  host.clickRematch();
  await world.advance(300);
  eq(guest.snap().rematchLabel, "Accept Rematch");
  guest.clickRematch();
  await world.advance(400);
  assertConsistent(host, guest, "restart");
  eq(countDisks(host.snap().board), 0);
  eq(host.snap().current, 1);
  ok(!host.snap().gameOver);

  await play(world, host, 4);
  guest.sdk.netDrop(true);
  await world.advance(100);
  const replacement = world.add("u2", "Bob");
  replacement.start(roster);
  await world.advance(700);
  eq(replacement.snap().board, host.snap().board, "rejoin must see new match, not old winner");
  eq(countDisks(replacement.snap().board), 1);
  eq(replacement.snap().current, 2);
});

test("simultaneous rematch requests deterministically restart once", async () => {
  const { world, host, guest } = await onlinePair();
  await winForHost(world, host, guest);
  host.clickRematch();
  guest.clickRematch();
  await world.advance(800);
  assertConsistent(host, guest, "simultaneous rematch");
  eq(countDisks(host.snap().board), 0);
  eq(host.snap().current, 1);
  ok(!host.snap().gameOver);
  ok(!host.snap().restartPending);
  eq(world.room.log.filter((action) => action.action_type === "restart").length, 1);
});

test("random complete games never diverge or reach an unplayable turn", async () => {
  for (let seed = 1; seed <= 12; seed++) {
    const { world, host, guest } = await onlinePair({ syncModel: seed % 2 ? "cpTailInclusive" : "full" });
    let state = seed >>> 0;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    let moves = 0;
    while (!host.snap().gameOver && moves < 42) {
      assertConsistent(host, guest, "seed " + seed + " move " + moves);
      const snap = host.snap();
      const valid = [];
      for (let col = 0; col < 7; col++) if (snap.board[0][col] === 0) valid.push(col);
      ok(valid.length > 0, "a non-ended game must have a legal column");
      const actor = snap.current === 1 ? host : guest;
      await play(world, actor, valid[Math.floor(random() * valid.length)]);
      moves++;
    }
    assertConsistent(host, guest, "seed " + seed + " final");
    ok(host.snap().gameOver, "game must terminate within 42 legal moves");
    ok(moves <= 42);
  }
});

run("Connect Four connection + sync scenarios").then((result) => {
  if (result.fails.length) process.exitCode = 1;
});
