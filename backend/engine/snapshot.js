"use strict";

class Snapshot {
    constructor({ players, communityCards, pots, dealerIndex, bettingRound, playerIndex}) {
        this.players = players.map(p => ({
            id: p.id,
            name: p.name,
            stack: p.stack,
            currentBet: p.currentBet,
            status: p.status,
            cards: p.getCards ? p.getCards() : [],
        }));

        this.communityCards = [...communityCards];
        this.pots = pots.map(pot => ({
            amount: pot.amount,
            contributors: Array.from(pot.contributors.entries()),
        }));

        this.dealerIndex = dealerIndex;
        this.bettingRound = bettingRound;
        this.playerIndex = playerIndex;
        this.timestamp = Date.now();
    }

    toJSON() {
        return {
            players: this.players,
            communityCards: this.communityCards,
            pots: this.pots,
            dealerIndex: this.dealerIndex,
            bettingRound: this.bettingRound,
            playerIndex: this.playerIndex,
            timestamp: this.timestamp,
        };
    }
}

module.exports = Snapshot;
