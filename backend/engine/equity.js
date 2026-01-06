const Hand = require('pokersolver').Hand;
const { getPreflopEquity } = require('./preflopEquity');

const SIMULATION_CYCLES = 5000;

/**
 * Calculates the Win Equity for a specific hand against N random opponents.
 * @param {Array<string>} playerHand - e.g. ['As', 'Kd']
 * @param {Array<string>} communityCards - e.g. ['2h', '5d', '9s'] or []
 * @param {number} totalActivePlayers - Total players in hand
 * @returns {number} - Equity percentage (0 to 100)
 */

function calculateEquity(playerHand, communityCards, totalActivePlayers) {
    // input validation
    if (!playerHand || playerHand.length !== 2) return 0;
    const opponentCount = Math.max(1, totalActivePlayers - 1);

    if (!communityCards || communityCards.length === 0) {
        return getPreflopEquity(playerHand, totalActivePlayers);
    }

    const suits = ['c', 'd', 'h', 's'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    const fullDeck = [];
    for (const s of suits) {
        for (const r of ranks) {
            fullDeck.push(`${r}${s}`);
        }
    }

    // Normalize input cards
    const fmt = (c) => {
        if (!c) return null;
        let r = c.slice(0, -1);
        let s = c.slice(-1);
        if (r === '10') r = 'T';
        return `${r}${s}`;
    };

    const heroCards = playerHand.map(fmt);
    const boardCards = communityCards.map(fmt);
    
    // Create the dead cards list
    const knownCards = new Set([...heroCards, ...boardCards]);
    
    // Create the remaining Deck
    const deck = fullDeck.filter(c => !knownCards.has(c));

    // Monte Carlo Simulation
    let wins = 0;
    let ties = 0;

    for (let i = 0; i < SIMULATION_CYCLES; i++) {
        const shuffledDeck = [...deck]; 
        for (let j = shuffledDeck.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [shuffledDeck[j], shuffledDeck[k]] = [shuffledDeck[k], shuffledDeck[j]];
        }

        let deckIndex = 0;

        const simBoard = [...boardCards];
        while (simBoard.length < 5) {
            simBoard.push(shuffledDeck[deckIndex++]);
        }

        const opponentHands = [];
        for (let op = 0; op < opponentCount; op++) {
            const opCard1 = shuffledDeck[deckIndex++];
            const opCard2 = shuffledDeck[deckIndex++];
            opponentHands.push([opCard1, opCard2]);
        }

        const heroSolved = Hand.solve([...heroCards, ...simBoard]);
        const opponentSolved = opponentHands.map(h => Hand.solve([...h, ...simBoard]));

        const allHands = [heroSolved, ...opponentSolved];
        const winners = Hand.winners(allHands);

        const isHeroWinner = winners.some(w => w.toString() === heroSolved.toString());

        if (isHeroWinner) {
            if (winners.length > 1) {
                // Split pot
                ties++; 
            } else {
                // Clean win
                wins++;
            }
        }
    }

    // Calculate equity
    const rawEquity = (wins + (ties / 2)) / SIMULATION_CYCLES;
    
    return Math.round(rawEquity * 1000) / 10;
}

module.exports = { calculateEquity };