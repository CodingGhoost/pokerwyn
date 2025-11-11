jest.mock("../deck", () => {
  return jest.fn().mockImplementation(() => ({
    reset: jest.fn(),
    shuffle: jest.fn(),
    deal: jest.fn()
      .mockReturnValueOnce("C1")
      .mockReturnValueOnce("C2")
      .mockReturnValueOnce("C3")
      .mockReturnValueOnce("C4")
      .mockReturnValueOnce("C5"),
  }));
});

jest.mock("../pot", () => {
  return jest.fn().mockImplementation(() => ({
    addContribution: jest.fn(),
    amount: 0,
  }));
});

jest.mock("../snapshot", () => ({
  create: jest.fn(),
}));

jest.mock("../showdown", () => ({
  Showdown: { evaluate: jest.fn().mockReturnValue("showdown_result") },
}));

jest.mock("../player", () => ({
  PlayerState: {
    IN_GAME: "IN_GAME",
    READY: "READY",
    LEFT: "LEFT",
    FOLDED: "FOLDED",
  },
}));

const Table = require("../table");
const Deck = require("../deck");
const Pot = require("../pot");
const Snapshot = require("../snapshot");
const { Showdown } = require("../showdown");
const { PlayerState } = require("../player");

function makePlayer(name, overrides = {}) {
  return {
    name,
    stack: overrides.stack ?? 1000,
    state: overrides.state ?? PlayerState.READY,
    isAllIn: overrides.isAllIn ?? false,
    currentBet: overrides.currentBet ?? 0,
    seat: overrides.seat ?? 0,
    bet: jest.fn((amt) => {
      if (amt > 0) {
        overrides.currentBet = amt;
        return true;
      }
      return false;
    }),
    fold: jest.fn(),
    allIn: jest.fn(),
    addCards: jest.fn(),
    clearCards: jest.fn(),
    getCards: jest.fn().mockReturnValue([]),
    getSeat: jest.fn().mockReturnValue(overrides.seat ?? 0),
    resetBet: jest.fn(),
  };
}

describe("Table class", () => {
  let table;
  let p1, p2, p3;

  beforeEach(() => {
    jest.clearAllMocks();
    table = new Table();
    p1 = makePlayer("Alice", { seat: 0 });
    p2 = makePlayer("Bob", { seat: 1 });
    p3 = makePlayer("Charlie", { seat: 2 });
  });

  test("constructor initializes correctly", () => {
    expect(table.maxPlayers).toBe(9);
    expect(Array.isArray(table.players)).toBe(true);
    expect(table.deck).toBeDefined();
    expect(table.pot[0]).toBeDefined();
    expect(table.communityCards).toEqual([]);
    expect(table.handInProgress).toBe(false);
  });

  test("addPlayer and removePlayer", () => {
    expect(table.addPlayer(p1)).toBe(true);
    expect(table.players.length).toBe(1);
    table.removePlayer("Alice");
    expect(table.players.length).toBe(0);
  });

  test("getActivePlayers filters correctly", () => {
    p1.state = PlayerState.IN_GAME;
    p2.state = PlayerState.READY;
    p3.state = PlayerState.LEFT;
    table.players = [p1, p2, p3];
    expect(table.getActivePlayers()).toEqual([p1, p2]);
  });

  test("startHand initializes deck and deals", () => {
    table.players = [p1, p2];
    jest.spyOn(table.deck, "reset");
    jest.spyOn(table.deck, "shuffle");
    const ok = table.startHand();
    expect(ok).toBe(true);
    expect(table.deck.reset).toHaveBeenCalled();
    expect(table.deck.shuffle).toHaveBeenCalled();
    expect(p1.addCards).toHaveBeenCalled();
    expect(table.handInProgress).toBe(true);
  });

  test("playerAction BET updates pot and bet", () => {
    table.players = [p1];
    table.pot = [new Pot()];
    p1.state = PlayerState.IN_GAME;

    table.playerAction("Alice", "BET", 100);
    expect(p1.bet).toHaveBeenCalledWith(100);
    expect(table.currentBet).toBe(100);
  });

  test("playerAction CALL", () => {
    table.players = [p1];
    table.pot = [new Pot()];
    p1.state = PlayerState.IN_GAME;
    p1.currentBet = 50;
    table.currentBet = 100;
    table.playerAction("Alice", "CALL");
    expect(p1.bet).toHaveBeenCalledWith(50);
  });

  test("playerAction FOLD", () => {
    table.players = [p1];
    p1.state = PlayerState.IN_GAME;
    table.playerAction("Alice", "FOLD");
    expect(p1.fold).toHaveBeenCalled();
  });

  test("resolveShowdown delegates to Showdown.evaluate", () => {
    table.players = [p1, p2];
    p1.state = PlayerState.IN_GAME;
    p2.isAllIn = true;

    p1.getCards.mockReturnValue(["As", "Kd"]);
    p2.getCards.mockReturnValue(["Qc", "Jh"]);
    table.communityCards = ["2c", "7d", "9h", "Ts", "3s"];

    const res = table.resolveShowdown();
    expect(Showdown.evaluate).toHaveBeenCalled();
    expect(res).toBe("showdown_result");
  });

  test("snapshot calls Snapshot.create", () => {
    Snapshot.create.mockReturnValue("snap");
    const res = table.snapshot();
    expect(Snapshot.create).toHaveBeenCalledWith(table);
    expect(res).toBe("snap");
  });

  test("resetForNextHand resets states", () => {
    table.players = [p1];
    table.handInProgress = true;
    table.currentBet = 200;
    table.resetForNextHand();
    expect(p1.resetBet).toHaveBeenCalled();
    expect(p1.state).toBe(PlayerState.READY);
    expect(table.handInProgress).toBe(false);
  });
});
