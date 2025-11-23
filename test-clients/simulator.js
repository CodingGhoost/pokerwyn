// simulator.js (CommonJS)
import { io } from "socket.io-client";

/**
 * Configuration
 */
const SERVER_URL = "http://localhost:3000";
const N_BOTS = 4; // how many simulated players
const START_STACK = 1000;
const MIN_PLAYERS_TO_START = 2;
const AUTO_START_DELAY_MS = 1200; // after everyone joined, wait then start

// simple bot policy weights
const ACTION_WEIGHTS = [
  { name: "CALL", weight: 60 },
  { name: "BET",  weight: 20 },
  { name: "FOLD", weight: 15 },
  { name: "ALL_IN", weight: 5 }
];

/**
 * Helpers
 */
function pickWeightedAction() {
  const total = ACTION_WEIGHTS.reduce((s, a) => s + a.weight, 0);
  let r = Math.random() * total;
  for (const a of ACTION_WEIGHTS) {
    if (r < a.weight) return a.name;
    r -= a.weight;
  }
  return "CALL";
}

/**
 * Simulator state
 */
const bots = [];
let globalStateCounter = 0; // increments each time any client receives a server state

/**
 * Create a simulated client/bot
 * - name: player's display name to send in join payload
 * - seatIndex: index we expect server to store in table.players (order of join)
 */
function createBot(name, seatIndex) {
  const socket = io(SERVER_URL, { /* defaults (allow polling fallback) */ });

  const bot = {
    name,
    seatIndex,
    socket,
    lastActedStateCounter: -1, // prevents multiple actions per same state snapshot
    connected: false,
  };

  socket.on("connect", () => {
    bot.connected = true;
    console.log(`[${name}] connected -> socketId=${socket.id}`);
    // join using your server's expected payload shape
    socket.emit("join", { name, stack: START_STACK });
  });

  socket.on("state", (state) => {
    // increment a global monotonic counter for each new state snapshot seen by this client
    globalStateCounter += 1;
    const stateCounter = globalStateCounter;

    // find our index in the state.players array (server returns players in join order)
    const players = state.players || [];
    const myIndex = players.findIndex(p => p.name === name);

    // log (compact)
    // only log occasionally to avoid spamming
    console.log(`[${name}] state received. players=${players.map(p => p.name).join(",")}; currentPlayer=${state.currentPlayer}`);

    // if it's our turn (server sets currentPlayer as index), attempt to act
    if (myIndex !== -1 && state.currentPlayer === myIndex) {
      // ensure we only act once per state snapshot
      if (bot.lastActedStateCounter === stateCounter) return;
      bot.lastActedStateCounter = stateCounter;

      // basic decision
      const chosen = pickWeightedAction();

      switch (chosen) {
        case "CALL":
          // amount not needed for CALL (server calculates), but send 0
          console.log(`[${name}] -> CALL`);
          socket.emit("action", { name, action: "CALL", amount: 0 });
          break;

        case "BET":
          // bet a simple amount: currentBet + 10 or a small fixed amount
          // state.currentBet is the table's current bet
          {
            const currentBet = state.currentBet || 0;
            const betAmount = Math.max(10, Math.floor(currentBet + 10));
            console.log(`[${name}] -> BET ${betAmount}`);
            socket.emit("action", { name, action: "BET", amount: betAmount });
          }
          break;

        case "FOLD":
          console.log(`[${name}] -> FOLD`);
          socket.emit("action", { name, action: "FOLD", amount: 0 });
          break;

        case "ALL_IN":
          console.log(`[${name}] -> ALL_IN`);
          socket.emit("action", { name, action: "ALL_IN", amount: 0 });
          break;

        default:
          console.log(`[${name}] -> default CALL`);
          socket.emit("action", { name, action: "CALL", amount: 0 });
      }
    }
  });

  socket.on("connect_error", (err) => {
    console.error(`[${name}] connect_error:`, err.message);
  });

  socket.on("error", (err) => {
    console.error(`[${name}] server error:`, err);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[${name}] disconnected: ${reason}`);
    bot.connected = false;
  });

  bots.push(bot);
  return bot;
}

/**
 * Kick off simulation
 */
async function runSimulation() {
  // create N_BOTS bots
  for (let i = 0; i < N_BOTS; i++) {
    createBot(`Bot${i+1}`, i);
    await new Promise(r => setTimeout(r, 120)); // slight stagger to make join order predictable
  }

  // wait until at least MIN_PLAYERS_TO_START connected and joined
  console.log("Waiting for bots to connect and join...");
  await waitForConnectedBots(MIN_PLAYERS_TO_START);

  // After a short delay, have the first connected bot request start-hand
  setTimeout(() => {
    const starter = bots.find(b => b.connected);
    if (starter) {
      console.log(`[SIM] Requesting start-hand from ${starter.name}`);
      starter.socket.emit("start-hand");
    }
  }, AUTO_START_DELAY_MS);

  // keep process alive while simulator runs
  // we'll automatically exit if all bots disconnect
  monitorBotsForExit();
}

/**
 * Wait until at least count bots are connected (with a timeout)
 */
function waitForConnectedBots(count, timeoutMs = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const t = setInterval(() => {
      const connectedCount = bots.filter(b => b.connected).length;
      if (connectedCount >= count) {
        clearInterval(t);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        reject(new Error("Timeout waiting for bots to connect"));
      }
    }, 100);
  });
}

/**
 * Simple monitor that exits the process when all bots disconnected
 */
function monitorBotsForExit() {
  const t = setInterval(() => {
    const anyConnected = bots.some(b => b.connected);
    if (!anyConnected) {
      console.log("[SIM] All bots disconnected — exiting.");
      clearInterval(t);
      process.exit(0);
    }
  }, 1500);
}

/**
 * Start
 */
runSimulation().catch(err => {
  console.error("[SIM] error:", err);
  process.exit(1);
});
