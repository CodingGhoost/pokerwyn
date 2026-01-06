const Pot = require("../pot.js");

describe("Pot class", () => {
  let pot;

  beforeEach(() => {
    pot = new Pot();
  });

  test("initializes with zero total and empty contributions", () => {
    expect(pot.total).toBe(0);
    expect(pot.contributions.size).toBe(0);
  });

  describe("addContribution()", () => {
    test("adds a new contribution", () => {
      pot.addContribution("Alice", 100);
      expect(pot.total).toBe(100);
      expect(pot.contributions.get("Alice")).toBe(100);
    });

    test("adds multiple contributions from same player", () => {
      pot.addContribution("Alice", 50);
      pot.addContribution("Alice", 70);
      expect(pot.contributions.get("Alice")).toBe(120);
      expect(pot.total).toBe(120);
    });

    test("handles multiple players correctly", () => {
      pot.addContribution("Alice", 50);
      pot.addContribution("Bob", 30);
      expect(pot.contributions.get("Alice")).toBe(50);
      expect(pot.contributions.get("Bob")).toBe(30);
      expect(pot.total).toBe(80);
    });

    test("ignores zero or negative contributions", () => {
      pot.addContribution("Alice", 0);
      pot.addContribution("Bob", -20);
      expect(pot.total).toBe(0);
      expect(pot.contributions.size).toBe(0);
    });
  });

  describe("getPlayers()", () => {
    test("returns an array of player names", () => {
      pot.addContribution("Alice", 10);
      pot.addContribution("Bob", 20);
      const players = pot.getPlayers();
      expect(players).toContain("Alice");
      expect(players).toContain("Bob");
      expect(players.length).toBe(2);
    });

    test("returns empty array when no contributions", () => {
      expect(pot.getPlayers()).toEqual([]);
    });
  });

  describe("distribute()", () => {
    test("returns empty array when there are no winners", () => {
      pot.addContribution("Alice", 50);
      const result = pot.distribute([]);
      expect(result).toEqual([]);
      expect(pot.total).toBe(50); // unchanged
    });

    test("returns empty array when pot total is 0", () => {
      const result = pot.distribute(["Alice"]);
      expect(result).toEqual([]);
    });

    test("divides pot equally among winners", () => {
      pot.addContribution("Alice", 100);
      pot.addContribution("Bob", 100);
      const payouts = pot.distribute(["Alice", "Bob"]);
      expect(payouts).toEqual([
        { name: "Alice", amount: 100 },
        { name: "Bob", amount: 100 },
      ]);
      expect(pot.total).toBe(0);
    });

    test("handles uneven split correctly (floating division)", () => {
      pot.addContribution("Alice", 100);
      const payouts = pot.distribute(["Alice", "Bob", "Charlie"]);
      const share = 100 / 3;
      payouts.forEach((p) => {
        expect(p.amount).toBeCloseTo(share);
      });
      expect(pot.total).toBe(0);
    });
  });
});
