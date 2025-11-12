"use strict";

const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const Table = require("../engine/table");
const Player = require("../engine/player");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const table = new Table(9);

io.on("connection", (socket) => {
  console.log(`🟢 Player connected: ${socket.id}`);

  socket.on("join", ({ name, stack }) => {
    const newPlayer = new Player(table.players.length, name);
    newPlayer.stack = stack;
    const success = table.addPlayer(newPlayer);

    if (!success) {
      socket.emit("error", "Table is full");
      return;
    }

    console.log(`👤 ${name} joined with ${stack} bb`);
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
    console.log(`🔴 Player disconnected: ${socket.id}`);
  });
});

server.listen(3000, () => {
  console.log("🚀 Poker server running on http://localhost:3000");
});
