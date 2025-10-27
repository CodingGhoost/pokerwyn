"use strict";

class Snapshot {
    constructor(table) {
        this.players = table.players.map(p => ({
            name: p.name,
            stack: p.stack,
            currentBet: p.currentBet,
            state: p.state,
            cards: p.getCards(),
        }));

        this.communityCards = [...table.communityCards];
        this.pots = table.pot.map(p => ({
            total: p.total,
            contributions: Array.from(p.contributions.entries()),
        }));

        this.buttonIndex = table.buttonIndex;
        this.currentBet = table.currentBet;
        this.handInProgress = table.handInProgress;
        this.timestamp = Date.now();
    }

    toJSON() {
        return JSON.stringify(this, null, 2);
    }

    static create(table) {
        return new Snapshot(table);
    }
}

module.exports = Snapshot;
