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

    socket.on("join", ({ name, stack }) => {
      const seatIndex = table.players.length;
      const newPlayer = new Player(seatIndex, name);
      newPlayer.stack = stack;
      newPlayer.socketId = socket.id; // <--- store socket id for later removal
      const success = table.addPlayer(newPlayer);

      if (!success) {
        socket.emit("error", "Table is full");
        return;
      }

      // return assigned seat to the joining client (useful)
      socket.emit("joined", { seatIndex, name, stack });

      console.log(`👤 ${name} (seat ${seatIndex}) joined with ${stack} bb`);
      table.broadcast(io);
    });


  socket.on("action", ({ name, action, amount }) => {
    table.playerAction(name, action, amount);
    table.broadcast(io);
  });

  socket.on("start-hand", () => {
    const ok = table.startHand();
    if (!ok) {
      socket.emit("error", "Not enough players");
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
