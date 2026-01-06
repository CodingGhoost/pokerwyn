const Table = require('../table');
const { Player } = require('../player');

class RiggedDeck {
    constructor(cards) {
        this.cards = cards.reverse(); 
    }
    reset() {}
    shuffle() {} 
    deal() {
        if (this.cards.length === 0) throw new Error("RiggedDeck empty - Add more cards!");
        return this.cards.pop();
    }
}

describe('Poker Math Engine: Equity & Pot Odds', () => {
    let table;

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    test('Equity Sanity Check: Aces vs 7-2 Offsuit (Pre-flop)', () => {
        const deck = new RiggedDeck([
            'As', '7d', 'Ah', '2c', 
            'Kd', 'Qd', 'Jd', 'Td', '9d'
        ]);
        table = new Table(2, deck);
        
        table.addPlayer(new Player(0, 'Hero'));
        table.addPlayer(new Player(1, 'Villain'));
        table.players[0].stack = 1000;
        table.players[1].stack = 1000;
        
        table.startHand(); 
        
        const state = table.getState();
        const heroData = state.players[0];
        
        console.log(`🃏 Hand: Aces vs 7-2 | 🤖 Calculated Equity: ${heroData.equity}%`);
        
        expect(heroData.equity).toBeGreaterThan(80);
    });

    test('Pot Odds: Calling a Half-Pot Bet (25% Odds)', () => {
        const deck = new RiggedDeck([
            'Ks', 'Jd', 'Qh', 'Ts',
            '2d', '3d', '4d',       
            '5d', '6d'              
        ]); 
        
        table = new Table(2, deck);
        
        table.addPlayer(new Player(0, 'Hero'));
        table.addPlayer(new Player(1, 'Villain'));
        table.players[0].stack = 1000;
        table.players[1].stack = 1000;
        
        table.startHand(); 
        
        table.playerAction('Hero', 'CALL'); 
        table.playerAction('Villain', 'CHECK'); 
        
        jest.advanceTimersByTime(2500);

        table.playerAction('Hero', 'BET', 40); 
        table.playerAction('Villain', 'CALL'); 
        
        jest.advanceTimersByTime(2500);
        
        table.playerAction('Hero', 'CHECK'); 
        table.playerAction('Villain', 'BET', 50);
        
        const state = table.getState();
        const heroData = state.players[0];
        
        console.log(`💰 Pot: ${state.pot[0].total}, Bet: 50 | Hero Calls: 50 | Odds: ${heroData.potOdds}%`);

        expect(heroData.potOdds).toBe(25);
    });

    test('Decision: 0% Equity vs Pot Odds', () => {
        const deck = new RiggedDeck([
            '2c', 'As', '3d', 'Ah', 
            'Ad', 'Ac', 'Ks', 
            '2h', '3h'
        ]);

        table = new Table(2, deck);
        table.addPlayer(new Player(0, 'Hero'));
        table.addPlayer(new Player(1, 'Villain'));
        table.players[0].stack = 1000;
        table.players[1].stack = 1000;
        
        table.startHand(); 
        
        table.playerAction('Hero', 'CALL');
        table.playerAction('Villain', 'CHECK');
        
        jest.advanceTimersByTime(2500);
        
        const state = table.getState();
        const heroData = state.players[0];
        
        console.log(`💀 Hero Drawing Dead | Equity: ${heroData.equity}%`);
        
        expect(heroData.equity).toBeLessThan(1);
    });
});