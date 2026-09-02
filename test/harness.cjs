const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { Document } = require("../../13/test/lib/dom.cjs");
const { Clock, flush } = require("../../13/test/lib/clock.cjs");

const GAME_DIR = path.resolve(__dirname, "..");
const HTML = fs.readFileSync(path.join(GAME_DIR, "index.html"), "utf8");
const SCRIPT = fs.readFileSync(path.join(GAME_DIR, "script.js"), "utf8");
const BODY_HTML = /<body>([\s\S]*?)<\/body>/i.exec(HTML)[1]
  .replace(/<script[\s\S]*?<\/script>/gi, "");

class Room {
  constructor(id) {
    this.id = id;
    this.seq = 0;
    this.log = [];
    this.state = null;
    this.stateSeq = -1;
    this.roster = [];
    this.members = new Map();
  }

  connectedIds() {
    return this.roster.filter((id) => {
      const member = this.members.get(id);
      return member && member.connected;
    });
  }
}

class Server {
  constructor(clock, opts) {
    this.clock = clock;
    this.opts = Object.assign({ latency: 20, syncModel: "cpTailInclusive" }, opts || {});
    this.rooms = new Map();
    this.dropNext = [];
    this.trace = [];
  }

  room(id) {
    if (!this.rooms.has(id)) this.rooms.set(id, new Room(id));
    return this.rooms.get(id);
  }

  push(target, type, payload) {
    this.clock.setTimeout(null, () => {
      if (!target.connected || target.frozen) {
        this.trace.push({ drop: type, to: target.id, reason: target.frozen ? "frozen" : "offline" });
        return;
      }
      const index = this.dropNext.findIndex((rule) =>
        rule.to === target.id &&
        (!rule.type || rule.type === type) &&
        (!rule.actionType || (payload && payload.action_type === rule.actionType))
      );
      if (index >= 0) {
        this.dropNext.splice(index, 1);
        this.trace.push({ drop: type, to: target.id, reason: "forced" });
        return;
      }
      this.trace.push({ deliver: type, to: target.id });
      target.fire(type, clone(payload));
    }, this.opts.latency);
  }

  syncActions(room, lastSeq) {
    if (this.opts.syncModel === "full") return room.log.slice();
    if (this.opts.syncModel === "tail") {
      return room.log.filter((action) => action.sequence > lastSeq);
    }
    if (room.stateSeq < 0) return room.log.slice();
    return room.log.filter((action) => action.sequence >= room.stateSeq);
  }
}

class SDK {
  constructor(server, id, name, launch) {
    this.server = server;
    this.clock = server.clock;
    this.id = id;
    this.name = name;
    this.launch = launch;
    this.handlers = {};
    this.initCb = null;
    this.connected = false;
    this.frozen = false;
    this.room = null;
    this.errors = [];
    this.calls = { action: 0, sync: 0, setState: 0, staleState: 0 };
  }

  fire(type, payload) {
    const handler = this.handlers[type];
    if (handler) handler(payload);
  }

  later(fn) {
    return new Promise((resolve, reject) => {
      this.clock.setTimeout(this, () => {
        try { resolve(fn()); } catch (error) { reject(error); }
      }, this.server.opts.latency);
    });
  }

  api() {
    const sdk = this;
    return {
      init(cb) { sdk.initCb = cb; },
      log() {},
      getLaunchParams: () => Object.assign({}, sdk.launch),
      cloud: {
        get: () => Promise.resolve(null),
        set: () => Promise.resolve({ success: true }),
        shared: { incr: () => Promise.resolve({ success: true }) },
      },
      leaderboard: { submit: () => Promise.resolve({ success: true }) },
      game: {
        connect: () => sdk.later(() => ({ success: true })),
        join: (roomId) => sdk.later(() => {
          const room = sdk.server.room(roomId);
          sdk.room = room;
          sdk.connected = true;
          if (!room.roster.includes(sdk.id)) room.roster.push(sdk.id);
          room.members.set(sdk.id, sdk);
          const ack = {
            player_ids: room.roster.slice(),
            connected_count: room.connectedIds().length,
            sequence: room.seq,
            game_state: clone(room.state),
          };
          sdk.server.push(sdk, "joined", ack);
          for (const peer of room.members.values()) {
            if (peer.id === sdk.id) continue;
            sdk.server.push(peer, "playerJoined", {
              player_id: sdk.id,
              player_ids: room.roster.slice(),
              connected_count: room.connectedIds().length,
            });
          }
          return { success: true, sequence: room.seq };
        }),
        isMultiplayer: () => sdk.launch.mode === "multiplayer",
        invite: () => Promise.resolve({ success: true }),
        action: (type, data) => sdk.later(() => {
          sdk.calls.action++;
          if (!sdk.connected || !sdk.room) throw new Error("offline");
          const action = {
            sequence: ++sdk.room.seq,
            player_id: sdk.id,
            action_type: type,
            action_data: clone(data || {}),
          };
          sdk.room.log.push(action);
          for (const member of sdk.room.members.values()) {
            sdk.server.push(member, "action", action);
          }
          return { success: true, sequence: action.sequence };
        }),
        realtime: (type, data) => {
          if (!sdk.connected || !sdk.room) return Promise.resolve({ success: false });
          const packet = {
            player_id: sdk.id,
            action_type: type,
            action_data: clone(data || {}),
          };
          for (const member of sdk.room.members.values()) {
            if (member.id !== sdk.id) sdk.server.push(member, "realtime", packet);
          }
          return Promise.resolve({ success: true });
        },
        setState: (state) => sdk.later(() => {
          sdk.calls.setState++;
          if (!sdk.connected || !sdk.room) return { success: false, code: "OFFLINE" };
          const seq = Number(state && state.seq) || 0;
          if (seq < sdk.room.stateSeq) {
            sdk.calls.staleState++;
            return { success: false, code: "STALE_STATE" };
          }
          sdk.room.state = clone(state);
          sdk.room.stateSeq = seq;
          return { success: true };
        }),
        requestSync: (lastSeq) => {
          sdk.calls.sync++;
          if (!sdk.connected || !sdk.room) return Promise.resolve({ success: false });
          const actions = sdk.server.syncActions(sdk.room, Number(lastSeq) || 0);
          sdk.server.push(sdk, "sync", {
            actions: clone(actions),
            game_state: clone(sdk.room.state),
            sequence: sdk.room.seq,
          });
          return Promise.resolve({ success: true });
        },
        requestRematch: () => Promise.resolve({ success: true }),
        reportResult: () => Promise.resolve({ success: true }),
        getLastSequence: () => sdk.room ? sdk.room.seq : 0,
        onJoined: (cb) => { sdk.handlers.joined = cb; },
        onPlayerJoined: (cb) => { sdk.handlers.playerJoined = cb; },
        onPlayerLeft: (cb) => { sdk.handlers.playerLeft = cb; },
        onAction: (cb) => { sdk.handlers.action = cb; },
        onSync: (cb) => { sdk.handlers.sync = cb; },
        onRealtime: (cb) => { sdk.handlers.realtime = cb; },
        onRematchRequest: (cb) => { sdk.handlers.rematch = cb; },
        onGameRestarted: (cb) => { sdk.handlers.restarted = cb; },
        onRoomAssigned: (cb) => { sdk.handlers.roomAssigned = cb; },
        onDisconnect: (cb) => { sdk.handlers.disconnect = cb; },
        onReconnect: (cb) => { sdk.handlers.reconnect = cb; },
        onError: (cb) => { sdk.handlers.error = cb; },
      },
    };
  }

  netDrop(notifyPeers) {
    if (!this.connected) return;
    this.connected = false;
    this.fire("disconnect", "test");
    if (notifyPeers && this.room) {
      for (const peer of this.room.members.values()) {
        if (peer.id === this.id) continue;
        this.server.push(peer, "playerLeft", {
          player_id: this.id,
          player_ids: this.room.roster.slice(),
          connected_count: this.room.connectedIds().length,
        });
      }
    }
  }

  netRestore(notifyPeers) {
    if (this.connected || !this.room) return;
    this.connected = true;
    this.fire("reconnect", 1);
    if (notifyPeers) {
      for (const peer of this.room.members.values()) {
        if (peer.id === this.id) continue;
        this.server.push(peer, "playerJoined", {
          player_id: this.id,
          player_ids: this.room.roster.slice(),
          connected_count: this.room.connectedIds().length,
        });
      }
    }
  }
}

class Client {
  constructor(world, id, name) {
    this.world = world;
    this.id = id;
    this.name = name;
    this.errors = [];
    this.doc = new Document(BODY_HTML);
    this.sdk = new SDK(world.server, id, name, {
      mode: "multiplayer",
      roomId: world.roomId,
    });
    const self = this;
    const store = new Map();
    class VirtualDate extends Date {
      constructor(...args) { args.length ? super(...args) : super(world.clock.now); }
      static now() { return world.clock.now; }
    }
    const sandbox = {
      document: this.doc,
      localStorage: {
        getItem: (key) => store.has(key) ? store.get(key) : null,
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
      },
      Date: VirtualDate,
      performance: { now: () => world.clock.now },
      console: {
        log() {},
        warn() {},
        error(...args) { self.errors.push(new Error(args.join(" "))); },
      },
      setTimeout: (fn, ms) => world.clock.setTimeout(self.sdk, fn, ms),
      setInterval: (fn, ms) => world.clock.setInterval(self.sdk, fn, ms),
      clearTimeout: (id) => world.clock.clear(id),
      clearInterval: (id) => world.clock.clear(id),
      requestAnimationFrame: (fn) => world.clock.setTimeout(self.sdk, fn, 16),
      Usion: this.sdk.api(),
      JSON, Promise, Object, Array, String, Number, Boolean, Set, Map, Error, RegExp, Symbol,
      isNaN, parseInt, parseFloat,
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    this.sandbox = sandbox;
    this.ctx = vm.createContext(sandbox);
    vm.runInContext(SCRIPT, this.ctx, { filename: "connect_four/script.js" });
  }

  start(roster) {
    const config = {
      userId: this.id,
      userName: this.name,
      roomId: this.world.roomId,
      playerIds: roster.slice(),
    };
    this.initPromise = Promise.resolve(this.sdk.initCb(config))
      .catch((error) => this.errors.push(error));
    return this.initPromise;
  }

  read(expression) {
    return vm.runInContext("(" + expression + ")", this.ctx);
  }

  run(code) {
    return vm.runInContext(code, this.ctx);
  }

  snap() {
    return this.read(`({
      board: board.map(function (row) { return row.slice(); }),
      current: current,
      gameOver: gameOver,
      winner: lastWinnerPlayer,
      myPlayer: myPlayer,
      players: players.slice(),
      pendingMove: pendingMove,
      pendingMoveId: pendingMoveId,
      lastAppliedSeq: lastAppliedSeq,
      lastSequence: lastSequence,
      appliedIds: Array.from(appliedMoveIds),
      waiting: waitingForOpponent,
      multiplayer: isMultiplayer,
      rematchState: rematchState,
      rematchRequested: rematchRequested,
      restartPending: restartPending,
      status: statusEl.textContent,
      winnerVisible: !winnerBanner.hidden,
      rematchLabel: winnerPlayAgain.textContent
    })`);
  }

  move(col) {
    const board = this.doc.getElementById("board");
    const cell = board.children[col];
    cell.closest = (selector) => selector === ".cell" ? cell : null;
    board.dispatch("click", { target: cell });
  }

  clickRematch() {
    const button = this.doc.getElementById("winnerPlayAgain");
    if (typeof button.onclick === "function") button.onclick();
    else button.dispatch("click");
  }

  freeze() {
    this.sdk.frozen = true;
    this.doc.visibilityState = "hidden";
  }

  thaw() {
    this.sdk.frozen = false;
    this.doc.visibilityState = "visible";
    this.doc.dispatch("visibilitychange");
  }
}

function offlineClient() {
  const clock = new Clock();
  const doc = new Document(BODY_HTML);
  const errors = [];
  const store = new Map();
  class VirtualDate extends Date {
    constructor(...args) { args.length ? super(...args) : super(clock.now); }
    static now() { return clock.now; }
  }
  const sandbox = {
    document: doc,
    localStorage: {
      getItem: (key) => store.has(key) ? store.get(key) : null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
    Date: VirtualDate,
    performance: { now: () => clock.now },
    console: {
      log() {},
      warn() {},
      error(...args) { errors.push(new Error(args.join(" "))); },
    },
    setTimeout: (fn, ms) => clock.setTimeout(null, fn, ms),
    setInterval: (fn, ms) => clock.setInterval(null, fn, ms),
    clearTimeout: (id) => clock.clear(id),
    clearInterval: (id) => clock.clear(id),
    requestAnimationFrame: (fn) => clock.setTimeout(null, fn, 16),
    JSON, Promise, Object, Array, String, Number, Boolean, Set, Map, Error, RegExp, Symbol,
    isNaN, parseInt, parseFloat,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(SCRIPT, ctx, { filename: "connect_four/script.js" });
  return {
    clock,
    doc,
    errors,
    read(expression) { return vm.runInContext("(" + expression + ")", ctx); },
    run(code) { return vm.runInContext(code, ctx); },
  };
}

class World {
  constructor(opts) {
    this.clock = new Clock();
    this.server = new Server(this.clock, opts);
    this.roomId = "connect-room";
    this.clients = [];
  }

  add(id, name) {
    const client = new Client(this, id, name);
    this.clients.push(client);
    return client;
  }

  async advance(ms) {
    await this.clock.advance(ms, flush);
  }

  get room() {
    return this.server.room(this.roomId);
  }
}

async function onlinePair(opts) {
  const world = new World(opts);
  const host = world.add("u1", "Alice");
  const guest = world.add("u2", "Bob");
  const roster = ["u1", "u2"];
  host.start(roster);
  await world.advance(100);
  guest.start(roster);
  await world.advance(500);
  return { world, host, guest, roster };
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function countDisks(board) {
  return board.reduce((total, row) => total + row.filter(Boolean).length, 0);
}

module.exports = { World, Client, offlineClient, onlinePair, countDisks, clone };
