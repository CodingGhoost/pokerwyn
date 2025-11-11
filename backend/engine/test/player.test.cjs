"use strict";

const { Player, PlayerState } = require("../player");

describe("Player Class", () => {
  let player;

  beforeEach(() => {
    player = new Player(1, "Alice");
    player.setStack(100);
  });

  test("constructor initializes correctly", () => {
    expect(player.seatIndex).toBe(1);
    expect(player.name).toBe("Alice");
    expect(player.hand).toEqual([]);
    expect(player.stack).toBe(100);
    expect(player.currentBet).toBe(0);
    expect(player.state).toBe(PlayerState.READY);
    expect(player.isAllIn).toBe(false);
    expect(player.isButton).toBe(false);
    expect(player.handDesc).toBeNull();
  });

  test("getters return correct values", () => {
    expect(player.getSeat()).toBe(1);
    expect(player.getStack()).toBe(100);
    expect(player.getBet()).toBe(0);
    expect(player.getState()).toBe(PlayerState.READY);
    expect(player.getAllIn()).toBe(false);
    expect(player.getButton()).toBe(false);
  });

  test("setName updates player name", () => {
    player.setName("Bob");
    expect(player.name).toBe("Bob");
  });

  test("setStack updates player stack", () => {
    player.setStack(250);
    expect(player.stack).toBe(250);
  });

  describe("bet()", () => {
    test("returns false if bet amount <= 0", () => {
      expect(player.bet(0)).toBe(false);
      expect(player.bet(-10)).toBe(false);
    });

    test("returns false if bet amount > stack", () => {
      expect(player.bet(200)).toBe(false);
      expect(player.currentBet).toBe(0);
    });

    test("updates currentBet and stack when valid bet", () => {
      const result = player.bet(50);
      expect(result).toBe(true);
      expect(player.currentBet).toBe(50);
      expect(player.stack).toBe(50);
    });
  });

  describe("allIn()", () => {
    test("moves all stack to bet and sets isAllIn", () => {
      player.allIn();
      expect(player.currentBet).toBe(100);
      expect(player.stack).toBe(0);
      expect(player.isAllIn).toBe(true);
    });

    test("does nothing if stack is already 0", () => {
      player.stack = 0;
      player.allIn();
      expect(player.currentBet).toBe(0);
      expect(player.isAllIn).toBe(false);
    });
  });

  test("resetBet() resets bet and all-in status", () => {
    player.bet(20);
    player.isAllIn = true;
    player.resetBet();
    expect(player.currentBet).toBe(0);
    expect(player.isAllIn).toBe(false);
  });

  describe("addCards()", () => {
    test("adds cards when less than 2 total", () => {
      player.addCards(["A♠", "K♦"]);
      expect(player.getCards()).toEqual(["A♠", "K♦"]);
    });

    test("ignores extra cards beyond 2", () => {
      player.addCards(["A♠", "K♦"]);
      player.addCards(["Q♥"]); // should be ignored
      expect(player.getCards()).toEqual(["A♠", "K♦"]);
    });
  });

  test("clearCards() removes all cards and resets handDesc", () => {
    player.addCards(["A♠", "K♦"]);
    player.handDesc = { name: "Pair" };
    player.clearCards();
    expect(player.getCards()).toEqual([]);
    expect(player.handDesc).toBeNull();
  });

  test("updateHandDescription() sets handDesc to HIGH_CARD", () => {
    player.updateHandDescription();
    expect(player.handDesc).toEqual({ name: "High Card", value: 1 });
  });

  describe("state transitions", () => {
    test("Back() sets state to READY", () => {
      player.state = PlayerState.AWAY;
      player.Back();
      expect(player.state).toBe(PlayerState.READY);
    });

    test("fold() sets state to FOLDED", () => {
      player.fold();
      expect(player.state).toBe(PlayerState.FOLDED);
    });

    test("away() sets state to AWAY", () => {
      player.away();
      expect(player.state).toBe(PlayerState.AWAY);
    });

    test("left() sets state to LEFT", () => {
      player.left();
      expect(player.state).toBe(PlayerState.LEFT);
    });
  });

  test("resetStage() changes FOLDED player to IN_GAME", () => {
    player.state = PlayerState.FOLDED;
    player.resetStage();
    expect(player.state).toBe(PlayerState.IN_GAME);
  });
});
