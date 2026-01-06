"use strict";

const Validator = require("../validator");
const { PlayerState } = require("../player");

describe("Validator class", () => {
  let table;
  let validator;
  let player;

  beforeEach(() => {
    player = {
      name: "Alice",
      state: PlayerState.IN_GAME,
      stack: 1000,
      currentBet: 0,
      folded: false,
      isAllIn: false,
    };

    table = {
      player: [player],
      players: [player],
      handInProgress: true,
      currentBet: 100,
      communityCards: [],
    };

    validator = new Validator(table);
  });

  test("validatePlayer returns valid player", () => {
    const result = validator.validatePlayer("Alice");
    expect(result).toBe(player);
  });

  test("validatePlayer throws if player not found", () => {
    expect(() => validator.validatePlayer("Bob")).toThrow(
      "Player 'Bob' not found at the table."
    );
  });

  test("validatePlayer throws if no active hand", () => {
    table.handInProgress = false;
    expect(() => validator.validatePlayer("Alice")).toThrow("No active hand in progress.");
  });

  test("validatePlayer throws if player cannot act", () => {
    player.state = PlayerState.FOLDED;
    expect(() => validator.validatePlayer("Alice")).toThrow(
      "Player 'Alice' cannot act in their current state."
    );
  });

  describe("validateAction", () => {
    test("validates FOLD correctly", () => {
      expect(validator.validateAction(player, "FOLD")).toBe(true);
    });

    test("throws if already folded", () => {
      player.folded = true;
      expect(() => validator.validateAction(player, "FOLD")).toThrow(
        "Alice has already folded."
      );
    });

    test("allows CHECK when no higher bet", () => {
      player.currentBet = 100;
      table.currentBet = 100;
      expect(validator.validateAction(player, "CHECK")).toBe(true);
    });

    test("throws CHECK when bet exists", () => {
      player.currentBet = 0;
      table.currentBet = 100;
      expect(() => validator.validateAction(player, "CHECK")).toThrow(
        "Alice cannot check when there is a bet"
      );
    });

    test("valid CALL", () => {
      player.currentBet = 50;
      table.currentBet = 100;
      expect(validator.validateAction(player, "CALL")).toBe(true);
    });

    test("throws CALL when nothing to call", () => {
      player.currentBet = 100;
      table.currentBet = 100;
      expect(() => validator.validateAction(player, "CALL")).toThrow(
        "Alice has nothing to call."
      );
    });

    test("throws CALL exceeding stack", () => {
      player.stack = 20;
      player.currentBet = 0;
      table.currentBet = 100;
      expect(() => validator.validateAction(player, "CALL")).toThrow(
        "Alice cannot call more than their stack."
      );
    });

    test("throws BET when amount <= 0", () => {
      expect(() => validator.validateAction(player, "BET", 0)).toThrow(
        "Bet amount must be positive."
      );
    });

    test("throws BET when amount > stack", () => {
      expect(() => validator.validateAction(player, "BET", 2000)).toThrow(
        "Alice cannot be more than their stack."
      );
    });

    test("throws on unknown action", () => {
      expect(() => validator.validateAction(player, "FLY")).toThrow("Unknown action: FLY");
    });

    test("ALL_IN passes when stack > 0", () => {
      expect(validator.validateAction(player, "ALL_IN")).toBe(true);
    });

    test("ALL_IN fails when no chips", () => {
      player.stack = 0;
      expect(() => validator.validateAction(player, "ALL_IN")).toThrow(
        "Alice has no chips to go all in."
      );
    });
  });

  describe("validateNextBettingRound", () => {
    test("returns true when valid", () => {
      table.communityCards = [1, 2, 3];
      expect(validator.validateNextBettingRound()).toBe(true);
    });

    test("throws when more than 5 cards", () => {
      table.communityCards = [1, 2, 3, 4, 5, 6];
      expect(() => validator.validateNextBettingRound()).toThrow(
        "Cannot deal more than 5 community cards."
      );
    });
  });

  describe("validateShowdown", () => {
    test("throws if less than 5 community cards", () => {
      table.communityCards = [1, 2, 3, 4];
      expect(() => validator.validateShowdown()).toThrow(
        "Cannot reach showdown before all 5 community cards are dealt."
      );
    });

    test("throws if no active players", () => {
      table.communityCards = [1, 2, 3, 4, 5];
      player.state = PlayerState.FOLDED;
      player.isAllIn = false;
      expect(() => validator.validateShowdown()).toThrow("No active players to evaluate showdown.");
    });

    test("returns true when showdown valid", () => {
      table.communityCards = [1, 2, 3, 4, 5];
      expect(validator.validateShowdown()).toBe(true);
    });
  });
});
