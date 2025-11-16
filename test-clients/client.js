import { io } from "socket.io-client";

const socket = io("http://localhost:3000"); // defaults

socket.on("connect", () => {
  console.log("✅ Connected:", socket.id);
  socket.emit("join", { name: "Ivan", stack: 1000 });
});

socket.on("state", (state) => {
  console.log("🎲 Game state:", state);
});

socket.on("connect_error", (err) => {
  console.error("❌ CONNECT ERROR:", err.message);
});

socket.on("error", (err) => {
  console.error("❌ SERVER ERROR:", err);
});
