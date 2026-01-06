const Table = require('../table');
const { Player } = require('../player');
const RiggedDeck = require('./RiggedDeck');

describe('Sequential All-In Logic (Short Stack then Deep Stack)', () => {
    let table;

    const setupTable = (stacks) => {
        const deck = new RiggedDeck([
            'Ah', 'Kh', 
            'Qh', 'Jh', 
            'Th', '9h', 
            '2c', '3c', '4c', '5c', '6c'
        ]);
        
        table = new Table(9, deck);
        
        stacks.forEach((stack, i) => {
            const p = new Player(i, `P${i+1}`);
            p.stack = stack;
            table.addPlayer(p);
        });

        table.setEventHandler(() => {});

        return table;
    };

    test('Scenario: Short Stack All-In -> Deep Stack All-In -> Raise Validation', () => {
        setupTable([100, 1000, 500]);
        
        table.startHand();

        console.log("--- PREFLOP START ---");

        console.log("Action: P1 goes ALL-IN (100)");
        const p1Action = table.playerAction('P1', 'ALL_IN');
        expect(p1Action).toBe(true);
        expect(table.players[0].currentBet).toBe(100);
        expect(table.players[0].isAllIn).toBe(true);
        expect(table.players[0].stack).toBe(0);

        console.log("Action: P2 goes ALL-IN (1000)");
        const p2Action = table.playerAction('P2', 'ALL_IN');
        expect(p2Action).toBe(true);
        expect(table.players[1].currentBet).toBe(1000);
        expect(table.players[1].isAllIn).toBe(true);
        expect(table.players[1].stack).toBe(0);

        console.log("Action: P3 Folds");
        table.playerAction('P3', 'FOLD');

        console.log("--- VERIFYING POTS ---");
        
        expect(table.pot[0].total).toBe(210);

        expect(table.players[1].stack).toBe(900);
        
        console.log(`P2 Stack (Should be 900): ${table.players[1].stack}`);
    });

    test('Scenario: Short Stack All-In -> Deep Stack All-In -> Medium Stack Call', () => {
        
        setupTable([100, 1000, 500]);
        table.startHand();

        table.playerAction('P1', 'ALL_IN');

        table.playerAction('P2', 'ALL_IN');

        table.playerAction('P3', 'CALL');

        expect(table.pot[0].total).toBe(300);

        expect(table.pot[1].total).toBe(800);

        expect(table.players[1].stack).toBe(500);

        console.log("Pot distribution verified successfully");
    });
});
