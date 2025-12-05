class Pot {
    constructor() {
        this.total = 0;
        this.contributions = new Map();
    }

    addContribution(name, amount) {
        if (amount <= 0) return;
        const prev = this.contributions.get(name) || 0;
        this.contributions.set(name, prev + amount);
        this.total += amount;
        console.log(`💵 ${name} contributed ${amount} to pot (pot now: ${this.total})`);
    }

    getPlayers() {
        return Array.from(this.contributions.keys());
    }

    distribute(winners) {
        if (!winners || winners.length === 0) {
            console.log("⚠️ No winners to distribute to");
            return [];
        }
        
        if (this.total === 0) {
            console.log("⚠️ Pot is empty, nothing to distribute");
            return winners.map(name => ({ name, amount: 0 }));
        }

        const numWinners = winners.length;
        const share = Math.floor(this.total / numWinners);
        const remainder = this.total % numWinners;

        console.log(`💰 Distributing pot of ${this.total} to ${numWinners} winner(s): ${share} each`);

        const payouts = winners.map((name, index) => ({
            name,
            amount: share + (index < remainder ? 1 : 0), // Give remainder to first winner(s)
        }));

        this.total = 0;
        this.contributions.clear();
        
        return payouts;
    }
}

module.exports = Pot;