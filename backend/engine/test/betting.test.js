const Table = require('../table');
const { Player } = require('../player');
const RiggedDeck = require('./RiggedDeck');

describe('Complex Betting & Side Pot Logic', () => {
    let table;

    const setupTable = (stacks) => {
        
        const deck = new RiggedDeck([
            'As', 'Ks',
            'Qh', 'Jh', 
            '2c', '7d',
            
            'Ad', '5c', '9s',
            '3h',             
            '4d'              
        ]);
        
        table = new Table(9, deck);
        
        stacks.forEach((stack, i) => {
            const p = new Player(i, `P${i+1}`);
            p.stack = stack;
            table.addPlayer(p);
        });

        return table;
    };

    test('Scenario: Bet -> Raise -> Re-Raise -> All-In Side Pot Creation', () => {

        setupTable([2000, 1000, 100]);
        
        table.startHand();

        table.playerAction('P1', 'BET', 50); 

        table.playerAction('P2', 'BET', 150);

        table.playerAction('P3', 'ALL_IN');

        table.playerAction('P1', 'CALL');

        table.playerAction('P2', 'CHECK');
        
        table.playerAction('P1', 'BET', 200);
        
        table.playerAction('P2', 'FOLD');

        console.log(`End State Stacks -> P1: ${table.players[0].stack}, P2: ${table.players[1].stack}, P3: ${table.players[2].stack}`);
        
        expect(table.players[0].stack).toBe(2250); 
        
        expect(table.players[1].stack).toBe(850);
        
        expect(table.players[2].stack).toBe(0);
    });
});