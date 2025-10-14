export class Pot {
    constructor() {
        this.total = 0; // Total pot size
        this.players = new Map(); // Map<playerName, currentBet>
    }

    addPlayer(name, amount) {
        if (amount <= 0) return;
        const prevBet = this.players.get(name) || 0; // Previous bet if any, otherwise 0
        this.players.set(name, prevBet + amount);
        this.total += amount;
    }

    getCurrentBet(name) {
        return this.players.get(name) || 0;
    }

    getPlayers() {
        return Array.from(this.players.keys());
    }

    distribute(winners) {
        if (winners.length === 0 || this.amount === 0) return [];

        const numWinners = winners.length;
        const share = Math.floor(this.amount / numWinners);
        const remainder = this.total % numWinners;

        const payouts = winners.map((name) => ({
            name,
            total: share
        }));

        this.total = remainder;
        return payouts
    }
}
