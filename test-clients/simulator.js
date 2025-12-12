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
  { name: "CALL", weight: 50 }, // Lower call weight slightly
  { name: "BET",  weight: 20 },
  { name: "FOLD", weight: 15 },
  { name: "ALL_IN", weight: 5 },
  { name: "CHECK", weight: 10 } // Add CHECK option
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
  const socket = io(SERVER_URL);

  const bot = {
    name,
    seatIndex,
    socket,
    lastSeenState: null, // Track the actual state object
    connected: false,
  };

  socket.on("connect", () => {
    bot.connected = true;
    console.log(`[${name}] connected -> socketId=${socket.id}`);
    socket.emit("join", { name, stack: START_STACK });
  });

  socket.on("state", (state) => {
    const players = state.players || [];
    const myIndex = players.findIndex(p => p.name === name);

    // Check if hand ended and we should start a new one
    if (state.currentPlayer === -1 && state.stage !== 'waiting' && state.handInProgress === false) {
      if (name === 'Bot1') {
        setTimeout(() => {
          console.log(`[${name}] Starting new hand...`);
          socket.emit("start-hand");
        }, 2000);
      }
      return;
    }

    // If it's my turn, ALWAYS act (don't deduplicate)
    if (myIndex !== -1 && state.currentPlayer === myIndex) {
      const myPlayer = players[myIndex];
      
      // // Create a detailed signature that includes MY current state
      // const stateSignature = `${state.currentPlayer}-${state.currentBet}-${state.stage}-${myPlayer.currentBet}-${myPlayer.stack}`;
      
      // // Only skip if EVERYTHING is identical (including my bet and stack)
      // if (bot.lastSeenState === stateSignature) {
      //   console.log(`[${name}] Skipping duplicate state (already acted)`);
      //   return;
      // }
      // bot.lastSeenState = stateSignature;

      console.log(`[${name}] My turn! currentPlayer=${state.currentPlayer}, stage=${state.stage}, currentBet=${state.currentBet}, myBet=${myPlayer.currentBet}`);

      // INSIDE simulator.js, in socket.on("state") - Replace the existing action logic

      const requiredToCall = state.currentBet - myPlayer.currentBet;
      const myStack = myPlayer.stack;
      const chosen = pickWeightedAction();

      const isCheckingRound = requiredToCall === 0;

      const actionIsAggressive = (chosen === "BET" || chosen === "RAISE" || chosen === "ALL_IN");

      if (myPlayer.state !== 'IN_GAME' || myStack === 0) {
          // Failsafe for players who cannot act.
          socket.emit("action", { name, action: "CALL", amount: 0 }); 
          return;
      }

      if (isCheckingRound) {
          if (actionIsAggressive) {
              // Fall through to the aggressive logic below (by doing nothing here)
          } else if (chosen === "FOLD") {
              console.log(`[${name}] -> FOLD`);
              socket.emit("action", { name, action: "FOLD", amount: 0 });
              return; // Exit after action
          } else { // CHECK/CALL
              console.log(`[${name}] -> CHECK`);
              socket.emit("action", { name, action: "CHECK", amount: 0 });
              return; // Exit after action
          }
      } else {
          // If a bet exists (requiredToCall > 0)
          if (chosen === "FOLD") {
              console.log(`[${name}] -> FOLD`);
              socket.emit("action", { name, action: "FOLD", amount: 0 });
              return; // Exit after action
          } else if (myStack <= requiredToCall || chosen === "CALL" || chosen === "CHECK") {
              // Force ALL_IN if low stack, otherwise CALL
              if (myStack <= requiredToCall && myStack > 0) {
                  console.log(`[${name}] -> STACK LOW, FORCING ALL_IN (${myStack})`);
                  socket.emit("action", { name, action: "ALL_IN", amount: 0 });
              } else {
                  console.log(`[${name}] -> CALL`);
                  socket.emit("action", { name, action: "CALL", amount: 0 });
              }
              return; // Exit after action
          }
          // If chosen is AGGRESSIVE, fall through to the aggressive block below
      }


      // --- AGGRESSIVE ACTION BLOCK (Handles both checking-round bets and betting-round raises) ---
      if (actionIsAggressive) {

          const minRaiseSize = state.minRaiseAmount || state.bigBlind || 10; 
          const amountForMinRaiseTotalBet = requiredToCall + minRaiseSize + myPlayer.currentBet;
          
          let targetTotalBet = 0; // The total bet the player will have after the action

          if (chosen === "ALL_IN") {
              targetTotalBet = myPlayer.currentBet + myStack; // Max possible bet
          } else { // BET/RAISE
              // Target a bet amount between min raise total and half stack total, capped at stack total
              
              // We want to raise by some amount X such that X >= minRaiseSize.
              // Target Total Bet = Current Table Bet + minRaiseSize + (Some random extra amount)
              
              // Simple: just target the minimum legal total bet
              targetTotalBet = amountForMinRaiseTotalBet;
              
              // If you want it random:
              const maxTargetTotalBet = myPlayer.currentBet + myStack;
              // Ensure targetTotalBet is at least amountForMinRaiseTotalBet (500)
              targetTotalBet = Math.min(maxTargetTotalBet, Math.max(amountForMinRaiseTotalBet, Math.floor(maxTargetTotalBet / 2)));
          }

          // The amount to send to the server is the *additional contribution* needed to reach the targetTotalBet
          const amountToContribute = targetTotalBet - myPlayer.currentBet;
          
          // The amount must not exceed the player's stack
          const finalAmount = Math.min(amountToContribute, myStack);


          // Final Check and Emit
          if (finalAmount > requiredToCall && finalAmount < myStack) {
              // This is a raise that is NOT all-in.
              console.log(`[${name}] -> RAISE (TargetTotal: ${targetTotalBet}, Contribution: ${finalAmount})`);
              // Use "BET" for both Bet and Raise, as per your server logic
              socket.emit("action", { name, action: "BET", amount: finalAmount }); 
          } else if (finalAmount === myStack && myStack > 0) {
              // ALL-IN
              console.log(`[${name}] -> ALL_IN (Contribution: ${finalAmount})`);
              socket.emit("action", { name, action: "ALL_IN", amount: 0 }); // Use ALL_IN action, amount is ignored by server
          } else {
              // If the calculated amount wasn't a raise (e.g., if finalAmount <= requiredToCall), revert to CALL/CHECK
              if (requiredToCall > 0) {
                  console.log(`[${name}] -> Calculated action illegal/insufficient, defaulting to CALL`);
                  socket.emit("action", { name, action: "CALL", amount: 0 });
              } else {
                  console.log(`[${name}] -> Calculated action illegal/insufficient, defaulting to CHECK`);
                  socket.emit("action", { name, action: "CHECK", amount: 0 });
              }
          }
          return; // Exit after action
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

  socket.on("game-over", (data) => {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🎊🎊🎊 GAME OVER 🎊🎊🎊`);
    console.log(`🏆 Winner: ${data.winner} with ${data.chips} chips!`);
    console.log(`${"=".repeat(60)}\n`);
    
    // Disconnect after game over
    setTimeout(() => {
        socket.disconnect();
    }, 2000);
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
