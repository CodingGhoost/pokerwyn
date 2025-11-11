class Pot {
    constructor() {
        this.total = 0; // Total pot size
        this.contributions = new Map(); // Map<playerName, currentBet>
    }

    addContribution(name, amount) {
        if (amount <= 0) return;
        const prev = this.contributions.get(name) || 0; // Previous bet if any, otherwise 0
        this.contributions.set(name, prev + amount);
        this.total += amount;
    }

    // getCurrentBet(name) {
    //     return this.players.get(name) || 0;
    // }

    getPlayers() {
        return Array.from(this.contributions.keys());
    }

    distribute(winners) {
        if (!winners || winners.length === 0 || this.total === 0) return [];

        const numWinners = winners.length;
        const share = this.total /numWinners;

        const payouts = winners.map((name) => ({
            name,
            amount: share,
        }));

        this.total = 0;
        return payouts;
    }
}

module.exports = Pot;
