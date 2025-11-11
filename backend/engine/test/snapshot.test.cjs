"use strict";

const Snapshot = require("../snapshot.js");

// Minimal mock player class
class MockPlayer {
  constructor(name, stack, currentBet, state, cards) {
    this.name = name;
    this.stack = stack;
    this.currentBet = currentBet;
    this.state = state;
    this._cards = cards;
  }

  getCards() {
    return this._cards;
  }
}

// Minimal mock pot class
class MockPot {
  constructor(total, contributions = {}) {
    this.total = total;
    this.contributions = new Map(Object.entries(contributions));
  }
}

// Minimal mock table
class MockTable {
  constructor() {
    this.players = [
      new MockPlayer("Alice", 1000, 50, "active", ["As", "Kd"]),
      new MockPlayer("Bob", 800, 50, "folded", ["Qc", "Jh"]),
    ];

    this.communityCards = ["2d", "5h", "9c"];
    this.pot = [
      new MockPot(200, { Alice: 100, Bob: 100 }),
      new MockPot(50, { Alice: 50 }),
    ];
    this.buttonIndex = 1;
    this.currentBet = 50;
    this.handInProgress = true;
  }
}

describe("Snapshot", () => {
  let table;
  let snapshot;

  beforeEach(() => {
    table = new MockTable();
    snapshot = new Snapshot(table);
  });

  test("creates a snapshot with correct structure", () => {
    expect(snapshot).toHaveProperty("players");
    expect(snapshot).toHaveProperty("communityCards");
    expect(snapshot).toHaveProperty("pots");
    expect(snapshot).toHaveProperty("buttonIndex", table.buttonIndex);
    expect(snapshot).toHaveProperty("currentBet", table.currentBet);
    expect(snapshot).toHaveProperty("handInProgress", table.handInProgress);
    expect(snapshot).toHaveProperty("timestamp");
  });

  test("copies player data correctly", () => {
    expect(snapshot.players.length).toBe(2);

    const alice = snapshot.players.find(p => p.name === "Alice");
    expect(alice).toMatchObject({
      name: "Alice",
      stack: 1000,
      currentBet: 50,
      state: "active",
      cards: ["As", "Kd"],
    });

    const bob = snapshot.players.find(p => p.name === "Bob");
    expect(bob).toMatchObject({
      name: "Bob",
      stack: 800,
      currentBet: 50,
      state: "folded",
      cards: ["Qc", "Jh"],
    });
  });

  test("copies community cards and pots correctly", () => {
    expect(snapshot.communityCards).toEqual(["2d", "5h", "9c"]);
    expect(snapshot.pots.length).toBe(2);

    expect(snapshot.pots[0]).toEqual({
      total: 200,
      contributions: [["Alice", 100], ["Bob", 100]],
    });

    expect(snapshot.pots[1]).toEqual({
      total: 50,
      contributions: [["Alice", 50]],
    });
  });

  test("timestamp is a valid number", () => {
    expect(typeof snapshot.timestamp).toBe("number");
    expect(snapshot.timestamp).toBeLessThanOrEqual(Date.now());
  });

  test("toJSON() returns a formatted JSON string", () => {
    const jsonObj = snapshot.toJSON();
    expect(typeof jsonObj).toBe("object");
    expect(jsonObj.players).toBeDefined();

    // Ensure toJSONString() produces a string
    const jsonStr = snapshot.toJSONString();
    expect(typeof jsonStr).toBe("string");
    const parsed = JSON.parse(jsonStr);
    expect(parsed.players).toBeDefined();

    expect(parsed.communityCards).toEqual(snapshot.communityCards);
  });

  test("create() static method returns a Snapshot instance", () => {
    const snap = Snapshot.create(table);
    expect(snap).toBeInstanceOf(Snapshot);
    expect(snap.players.length).toBe(table.players.length);
  });
});
