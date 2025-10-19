"use strict";

const { Hand } = require("pokersolver");

class Showdown {
    static evaluate (players, communityCards, pots) {
        const activePlayers = players.filter(
            (p) => p.state !== "folded" && p.state !== "left"
        );

        if (activePlayers.length === 0) return [];

        const hands = activePlayers.map((player) => {
            const allCards = [...player.getCards(), ...communityCards];
            const solved = Hand.solve(allCards);
            return {
                player,
                hand: solved,
            };
        });

        const solvedHands = hands.map((h) => h.hand);
        const winningHands = Hand.winners(solvedHands);

        const winners = hands
            .filter((h) => winningHands.includes(h.hand))
            .map((h) => h.player);
        
        for (const { player, hand } of hands) {
            player.handDesc = {
                name: hand.name,
                descr: hand.descr,
                rank: hand.rank,
                cards: hand.cards.map((c) => c.value + c.suit),
            };
        }

        let payout = [];
        if (pots && pots.length > 0) {
            for (const pot of pots) {
                const eligibleWinners = winners.filter((w) =>
                    pot.contributors.has(w.seatIndex)
                );

                const potPayouts = pot.distribute(
                    eligibleWinners.map((w) => w.seatIndex)
                );

                for (const payout of potPayouts) {
                    const recipients = players.find(
                        (p) => p.seatIndex === payout.playerId
                    );
                    if (recipient) recipient.stack += payout.amount;
                }

                payouts.push(...potPayouts);
            }
        }

        return {
            winners: winners.map((w) => ({
                seatIndex: w.seatIndex,
                name: w.name,
                hand: w.handDesc,
            })),
            payouts,
        };
    }
}
