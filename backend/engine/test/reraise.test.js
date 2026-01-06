const Table = require('../table');
const { Player } = require('../player');
const RiggedDeck = require('./RiggedDeck');

describe('Preflop Betting War (Continuous Re-Raising)', () => {
    let table;

    const setupTable = () => {
        const deck = new RiggedDeck([
            'As', 'Ks',
            'Ad', 'Kd', 
            '2c', '3c', '4c', '5c', '6c' 
        ]);
        
        table = new Table(2, deck); 
        
        table.addPlayer(new Player(0, 'Hero'));
        table.players[0].stack = 10000;
        
        table.addPlayer(new Player(1, 'Villain'));
        table.players[1].stack = 10000;

        return table;
    };

    test('Scenario: Raise -> Re-Raise -> 4-Bet -> Call', () => {
        setupTable();
        table.startHand();
        
        expect(table.currentPlayerIndex).toBe(0);
        expect(table.currentBet).toBe(10);
        expect(table.minRaiseAmount).toBe(10);

        table.playerAction('Hero', 'BET', 40);

        expect(table.currentBet).toBe(40);
        expect(table.minRaiseAmount).toBe(30); 
        expect(table.currentPlayerIndex).toBe(1); 

        table.playerAction('Villain', 'BET', 120);

        expect(table.currentBet).toBe(120);
        expect(table.minRaiseAmount).toBe(80);
        expect(table.currentPlayerIndex).toBe(0); 

        table.playerAction('Hero', 'BET', 300);

        expect(table.currentBet).toBe(300);
        expect(table.minRaiseAmount).toBe(180);
        expect(table.currentPlayerIndex).toBe(1); 

        table.playerAction('Villain', 'CALL');
        
        console.log(`Stage: ${table.stage}, Pot: ${table.pot[0].total}`);

        expect(table.stage).toBe('flop'); 
        expect(table.pot[0].total).toBe(600);
        
        expect(table.players[0].stack).toBe(9700);
        expect(table.players[1].stack).toBe(9700);
    });
});