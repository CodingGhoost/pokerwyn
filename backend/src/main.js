"use strict";

const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const Table = require("../engine/table");
const { Player } = require("../engine/player"); // ✅ correct

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const table = new Table(9);

io.on("connection", (socket) => {
  console.log(`🟢 Player connected: ${socket.id}`);
  socket.emit("state", table.getState());

  let actionTimeout = null;

  socket.on("join", ({ name, stack }) => {
    const seatIndex = table.players.length;
    const newPlayer = new Player(seatIndex, name);
    newPlayer.stack = stack;
    newPlayer.socketId = socket.id;
    const success = table.addPlayer(newPlayer);

    if (!success) {
      socket.emit("error", "Table is full");
      return;
    }

    socket.emit("joined", { seatIndex, name, stack });
    console.log(`👤 ${name} (seat ${seatIndex}) joined with ${stack} bb`);
    table.broadcast(io);
  });

  socket.on("action", ({ name, action, amount }) => {
    if (actionTimeout) {
      clearTimeout(actionTimeout);
      actionTimeout = null;
    }

    const success = table.playerAction(name, action, amount);
    if (success) {
      table.broadcast(io);
      
      // Set timeout for next player (30 seconds)
      if (table.currentPlayerIndex !== -1) {
        actionTimeout = setTimeout(() => {
          const currentPlayer = table.players[table.currentPlayerIndex];
          if (currentPlayer) {
            console.log(`⏰ ${currentPlayer.name} timed out - auto-folding`);
            table.playerAction(currentPlayer.name, "FOLD", 0);
            table.broadcast(io);
          }
        }, 30000);
      }
    }
  });

  socket.on("start-hand", () => {
    const ok = table.startHand();
    if (!ok) {
        // Check if game is over
        const playersWithChips = table.players.filter(p => 
            p.state !== 'LEFT' && p.stack > 0
        );
        
        if (playersWithChips.length === 1) {
            io.emit("game-over", {
                winner: playersWithChips[0].name,
                chips: playersWithChips[0].stack
            });
            console.log("🎊🎊🎊 TOURNAMENT COMPLETE 🎊🎊🎊");
        } else {
            socket.emit("error", "Not enough players");
        }
        return;
    }

    table.broadcast(io);
  });

  socket.on("next-round", () => {
    table.nextBettingRound();
    table.broadcast(io);
  });

  socket.on("disconnect", () => {
    table.removePlayerBySocketId(socket.id);
    table.broadcast(io);
    console.log(`🔴 Player disconnected: ${socket.id}`);
  });
});

server.listen(3000, () => {
  console.log("🚀 Poker server running on http://localhost:3000");
});
