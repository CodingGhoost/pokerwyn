"use strict";

const PlayerState = {
  READY: "READY", // 准备就绪
  IN_GAME: "IN_GAME", // 在游戏中
  FOLDED: "FOLDED", // 已弃牌
  AWAY: "AWAY", // 离开座位
  LEFT: "LEFT", // 已离开游戏
  OFFLINE: "OFFLINE",
};

const HandRank = Object.freeze({
  HIGH_CARD: { name: "High Card", value: 1 },
  ONE_PAIR: { name: "One Pair", value: 2 },
  TWO_PAIR: { name: "Two Pair", value: 3 },
  THREE_OF_A_KIND: { name: "Three of a Kind", value: 4 },
  STRAIGHT: { name: "Straight", value: 5 },
  FLUSH: { name: "Flush", value: 6 },
  FULL_HOUSE: { name: "Full House", value: 7 },
  FOUR_OF_A_KIND: { name: "Four of a Kind", value: 8 },
  STRAIGHT_FLUSH: { name: "Straight Flush", value: 9 },
  ROYAL_FLUSH: { name: "Royal Flush", value: 10 }, // Highest possible straight flush (10-Ace)
});

class Player {
  constructor(seatIndex, name) {
    this.seatIndex = parseInt(seatIndex);
    this.name = name;
    this.hand = [];
    this.stack = 0;
    this.currentBet = 0;
    this.state = PlayerState.READY;
    this.isAllIn = false;
    this.isButton = false;
    this.handDesc = null; /*wait for showdonw logic*/
    this.socketId = null; // store socket id when they join
    this.actedThisRound = false; // optional: mark whether player acted in current betting round
  }

  getSeat() {
    return this.seatIndex;
  }

  getHand() {
    return this.handDesc;
  }

  getStack() {
    return this.stack;
  }

  getBet() {
    return this.currentBet;
  }

  getState() {
    return this.state;
  }

  getAllIn() {
    return this.isAllIn;
  }

  getButton() {
    return this.isButton;
  }

  bet(amount) {
    /*check if the chips enough*/
    if (amount <= 0 || amount > this.stack) {
      return false;
    }
    this.currentBet += amount;
    this.stack -= amount;
    return true;
  }

  allIn() {
    if (this.stack > 0) {
      this.currentBet += this.stack;
      this.isAllIn = true;
      this.stack = 0;
    }
  }

  resetBet() {
    this.currentBet = 0;
    this.isAllIn = false;
  }

  addCards(cards) {
    // 确保手牌不超过2张
    if (this.hand.length + cards.length <= 2) {
      this.hand.push(...cards);
    }
  }

  clearCards() {
    this.hand = [];
    this.handDesc = null;
  }

  getCards() {
    return this.hand;
  }

  Back() {
    /*someone come back to the game*/
    this.state = PlayerState.READY;
  }

  updateHandDescription() {
    this.handDesc = HandRank.HIGH_CARD;
  }

  setName(NewName) {
    this.name = NewName;
  }

  setStack(NewStack) {
    /*player set his/her chips*/
    this.stack = NewStack;
  }

  resetStage() {
    /*after every showdown*/
    if (this.state === PlayerState.FOLDED || this.state === Player.READY) {
      this.state = PlayerState.IN_GAME;
    }
  }

  left() {
    this.state = PlayerState.LEFT;
  }

  away() {
    this.state = PlayerState.AWAY;
  }

  fold() {
    this.state = PlayerState.FOLDED;
  }

  get isActive() {
    return this.state === PlayerState.IN_GAME && this.stack > 0 && !this.isAllIn;
  }
}

module.exports = { Player, PlayerState };
