"use strict";

const { Hand } = require("pokersolver");
const { PlayerState } = require("./player");

class Showdown {
    static evaluate(players, communityCards, pots) {
        // Include IN_GAME and all-in players, exclude folded and left players
        const activePlayers = players.filter(
            (p) => (p.state === PlayerState.IN_GAME || p.isAllIn) && 
                   p.state !== PlayerState.FOLDED && 
                   p.state !== PlayerState.LEFT
        );

        console.log(`🎲 Evaluating showdown with ${activePlayers.length} active players`);

        if (activePlayers.length === 0) {
            console.log("⚠️ No active players in showdown");
            return { winners: [], payouts: [] };
        }

        // If only one player, they win by default
        if (activePlayers.length === 1) {
            const winner = activePlayers[0];
            console.log(`🏆 ${winner.name} wins by default (everyone else folded)`);
            
            let payouts = [];
            if (pots && pots.length > 0) {
                for (const pot of pots) {
                    const potPayouts = pot.distribute([winner.name]);
                    for (const pay of potPayouts) {
                        winner.stack += pay.amount;
                    }
                    payouts.push(...potPayouts);
                }
            }
            
            return { winners: [winner], payouts };
        }

        // Evaluate hands for showdown
        const hands = activePlayers.map((p) => {
            const allCards = [...p.getCards(), ...communityCards];
            const solved = Hand.solve(allCards);
            console.log(`  ${p.name}: ${solved.descr}`);
            return {
                player: p,
                hand: solved,
            };
        });

        const solvedHands = hands.map((h) => h.hand);
        const winningHands = Hand.winners(solvedHands);

        const winners = hands
            .filter((h) => winningHands.includes(h.hand))
            .map((h) => h.player);

        console.log(`🏆 Winner(s): ${winners.map(w => w.name).join(', ')}`);

        // Distribute pot(s)
        let payouts = [];
        if (pots && pots.length > 0) {
            for (const pot of pots) {
                const eligibleWinners = winners.filter((w) =>
                    pot.contributions.has(w.name)
                );

                if (eligibleWinners.length === 0) {
                    console.log("⚠️ No eligible winners for this pot");
                    continue;
                }

                const potPayouts = pot.distribute(
                    eligibleWinners.map((w) => w.name)
                );

                for (const pay of potPayouts) {
                    const player = players.find((p) => p.name === pay.name);
                    if (player) {
                        player.stack += pay.amount;
                        console.log(`💰 ${player.name} receives ${pay.amount} chips (new stack: ${player.stack})`);
                    }
                }

                payouts.push(...potPayouts);
            }
        }

        return { winners, payouts };
    }
}

module.exports = { Showdown };