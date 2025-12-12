const Table = require('../table');
const { Player } = require('../player');
const RiggedDeck = require('./RiggedDeck');

describe('Complex Betting & Side Pot Logic', () => {
    let table;

    const setupTable = (stacks) => {
        // SCENARIO CONFIGURATION:
        // We need P1 to win BOTH the Main Pot and the Side Pot to reach 2250 chips.
        // P1 needs a hand that beats P3's hand.
        
        const deck = new RiggedDeck([
            'As', 'Ks', // P1: Ace-King (Top Pair)
            'Qh', 'Jh', // P2: Queen-Jack
            '2c', '7d', // P3: 7-2 offsuit (Garbage)
            
            // BOARD CARDS
            'Ad', '5c', '9s', // Flop (Ace on board -> P1 has Top Pair)
            '3h',             // Turn
            '4d'              // River
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
        // P1: Deep Stack (2000)
        // P2: Mid Stack (1000)
        // P3: Short Stack (100)
        setupTable([2000, 1000, 100]);
        
        table.startHand();

        // --- PREFLOP ---
        // P1 RAISES to 50
        table.playerAction('P1', 'BET', 50); 

        // P2 RE-RAISES to 150
        table.playerAction('P2', 'BET', 150);

        // P3 GOES ALL-IN (100)
        table.playerAction('P3', 'ALL_IN');

        // P1 CALLS (150)
        table.playerAction('P1', 'CALL');

        // --- FLOP ---
        // P2 Checks
        table.playerAction('P2', 'CHECK');
        
        // P1 Bets 200
        table.playerAction('P1', 'BET', 200);
        
        // P2 Folds
        table.playerAction('P2', 'FOLD');

        // Note: Logic handles running out board automatically here 
        // because P1 is the only active player vs P3 (All-in)

        console.log(`End State Stacks -> P1: ${table.players[0].stack}, P2: ${table.players[1].stack}, P3: ${table.players[2].stack}`);
        
        // P1 Wins Everything (Main + Side + Returned)
        // 2000 - 150 - 200 + 200(returned) + 100(side) + 300(main) = 2250
        expect(table.players[0].stack).toBe(2250); 
        
        // P2 Lost 150
        expect(table.players[1].stack).toBe(850);
        
        // P3 Lost 100
        expect(table.players[2].stack).toBe(0);
    });
});