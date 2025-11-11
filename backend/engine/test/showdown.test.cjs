const { Showdown } = require("../showdown.js");

// Minimal mock Pot class for testing
class MockPot {
  constructor() {
    this.contributions = new Map();
    this.total = 0;
  }

  addContribution(name, amount) {
    this.contributions.set(name, amount);
    this.total += amount;
  }

  distribute(winners) {
    if (winners.length === 0 || this.total === 0) return [];
    const share = this.total / winners.length;
    this.total = 0;
    return winners.map((name) => ({ name, amount: share }));
  }
}

// Minimal mock player class
class MockPlayer {
  constructor(name, cards, state = "ready") {
    this.name = name;
    this._cards = cards;
    this.state = state;
    this.stack = 0;
  }

  getCards() {
    return this._cards;
  }
}

describe("Showdown.evaluate", () => {
  let players;
  let communityCards;
  let pot;

  beforeEach(() => {
    // Players with simple card strings for pokersolver
    players = [
      new MockPlayer("Alice", ["As", "Ks"]), // Ace & King of spades
      new MockPlayer("Bob", ["Ah", "Kh"]),   // Ace & King of hearts
      new MockPlayer("Charlie", ["2c", "3d"], "folded"), // folded, should be ignored
    ];

    communityCards = ["Qs", "Js", "Ts", "9s", "8s"]; // 5 community cards

    pot = new MockPot();
    pot.addContribution("Alice", 100);
    pot.addContribution("Bob", 100);
  });

  test("evaluates the winning player correctly", () => {
    const { winners } = Showdown.evaluate(players, communityCards, []);
    expect(winners.length).toBe(1);
    expect(["Alice", "Bob"]).toContain(winners[0].name); // Either Alice or Bob wins
  });

  test("ignores folded or left players", () => {
    players[0].state = "folded";
    const { winners } = Showdown.evaluate(players, communityCards, []);
    expect(winners.length).toBe(1);
    expect(winners[0].name).toBe("Bob");
});

  test("payouts are distributed correctly", () => {
    const { payouts } = Showdown.evaluate(players, communityCards, [pot]);
    expect(payouts.length).toBe(1);
    expect(payouts[0].name).toBe("Alice");
    expect(payouts[0].amount).toBe(200);;

    // Player stacks updated correctly
    const alice = players.find((p) => p.name === "Alice");
    expect(alice.stack).toBe(200);
  });

  test("returns empty winners array when all players folded or left", () => {
    players.forEach((p) => (p.state = "folded"));
    const { winners } = Showdown.evaluate(players, communityCards, [pot]);
    expect(winners).toEqual([]);
  });

  test("returns empty payouts if pot is empty or winners not eligible", () => {
    const emptyPot = new MockPot(); // no contributions
    const { payouts } = Showdown.evaluate(players, communityCards, [emptyPot]);
    expect(payouts).toEqual([]);
  });
});
