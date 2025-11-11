"use strict";

const { Hand } = require("pokersolver");

class Showdown {
    static evaluate (players, communityCards, pots) {
        const activePlayers = players.filter(
            (p) => p.state !== "folded" && p.state !== "left"
        );

        if (activePlayers.length === 0) return { winners: [], payouts: [] };

        const hands = activePlayers.map((p) => {
            const allCards = [...p.getCards(), ...communityCards];
            const solved = Hand.solve(allCards);
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
        
        // for (const { player, hand } of hands) {
        //     player.handDesc = {
        //         name: hand.name,
        //         descr: hand.descr,
        //         rank: hand.rank,
        //         cards: hand.cards.map((c) => c.value + c.suit),
        //     };
        // }

        let payouts = [];
        if (pots && pots.length > 0) {
            for (const pot of pots) {
                const eligibleWinners = winners.filter((w) =>
                    pot.contributions.has(w.name)
                );

                const potPayouts = pot.distribute(
                    eligibleWinners.map((w) => w.name)
                );

                for (const pay of potPayouts) {
                    const player = players.find(
                        (p) => p.name === pay.name
                    );
                    if (player) player.stack += pay.amount;
                }

                payouts.push(...potPayouts);
            }
        }

        return { winners, payouts };
    }
}

module.exports = { Showdown };
