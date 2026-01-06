const Table = require('../table');
const { Player } = require('../player');
const RiggedDeck = require('./RiggedDeck');

describe('Dynamic Join/Leave Logic', () => {
    let table;

    const setupTable = () => {
        const deck = new RiggedDeck([
            'Ah', 'Kd',
            'Qh', 'Jd',
            'Th', '9d',
            
            '2s', '2d',
            '3s', '3d',
            '4s', '4d',

            '2c', '3c', '4c', '5c', '6c',
            '7c', '8c', '9c', 'Tc', 'Jc'
        ]);
        
        table = new Table(9, deck);
        
        [1000, 1000, 1000].forEach((stack, i) => {
            const p = new Player(i, `P${i+1}`);
            p.stack = stack;
            table.addPlayer(p);
        });
        
        table.setEventHandler(() => {});
        return table;
    };

    test('Scenario: Join Mid-Game + Leave During Turn', () => {
        setupTable();

        console.log("--- HAND 1 START ---");
        table.startHand();

        expect(table.players.length).toBe(3);
        expect(table.players[0].state).toBe('IN_GAME');
        expect(table.players[1].state).toBe('IN_GAME');
        expect(table.players[2].state).toBe('IN_GAME');

        console.log("Action: P4 Joins Mid-Game");
        const p4 = new Player(3, 'P4');
        p4.stack = 1000;
        table.addPlayer(p4);

        expect(table.players.length).toBe(4);
        expect(table.players[3].name).toBe('P4');
        expect(table.players[3].state).toBe('WAITING'); 
        
        console.log("Action: P3 Bets 50");
        table.playerAction('P3', 'BET', 50);

        console.log("Action: P1 Leaves Table (While it is their turn)");
        table.removePlayer('P1');

        const p1Obj = table.players.find(p => p.name === 'P1');
        expect(p1Obj.state).toBe('LEFT'); 
        expect(p1Obj.stack).toBe(0);

        console.log("Action: P2 Calls");
        table.playerAction('P2', 'CALL');

        expect(table.stage).toBe('flop');
        expect(table.players[3].state).toBe('WAITING');

        table.playerAction('P2', 'CHECK');
        table.playerAction('P3', 'CHECK');
        table.playerAction('P2', 'CHECK');
        table.playerAction('P3', 'CHECK');
        table.playerAction('P2', 'CHECK');
        table.playerAction('P3', 'CHECK'); 

        console.log("--- HAND 1 END ---");

        console.log("--- HAND 2 START ---");
        table.startHand();

        const playerNames = table.players.map(p => p.name);
        console.log("Players in Hand 2:", playerNames);

        expect(playerNames).not.toContain('P1');
        expect(playerNames).toContain('P2');
        expect(playerNames).toContain('P3');
        expect(playerNames).toContain('P4');

        const p4Obj = table.players.find(p => p.name === 'P4');
        expect(p4Obj.state).toBe('IN_GAME');
        expect(p4Obj.hand.length).toBe(2);

        console.log("Validation Passed: Leavers removed, Joiners added.");
    });
});