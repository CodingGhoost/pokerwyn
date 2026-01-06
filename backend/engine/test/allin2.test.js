const Table = require('../table');
const { Player } = require('../player');
const RiggedDeck = require('./RiggedDeck');

describe('All-In Validation Logic', () => {
    let table;

    const setupTable = (stacks) => {
        const deck = new RiggedDeck([
            'Ah', 'Ad',
            'Kh', 'Kd',
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

    test('P2 should be able to go ALL_IN even after P1 is already ALL_IN', () => {
        setupTable([100, 1000]);
        table.startHand(); 

        console.log("Action: P1 goes ALL_IN");
        table.playerAction('P1', 'ALL_IN');
        
        expect(table.players[0].isAllIn).toBe(true);
        expect(table.players[0].currentBet).toBe(100);

        console.log("Action: P2 tries ALL_IN button");
        const p2Result = table.playerAction('P2', 'ALL_IN');
        
        expect(p2Result).toBe(true);

        console.log("Verifying End State...");
        
        expect(table.players[1].stack).toBe(900);
        
        expect(table.pot[0].total).toBe(200);

        console.log("Validation passed: P2 All-In was processed and uncalled chips returned.");
    });
});