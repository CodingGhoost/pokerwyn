const Deck = require("./deck");
const Pot = require("./pot");
const Snapshot = require("./snapshot");
const { Showdown } = require("./showdown");
const { PlayerState } = require("./player");

class Table {
    constructor( maxPlayers = 9, deck = null ) {
        this.maxPlayers = maxPlayers;
        this.players = [];
        this.deck = deck ?? new Deck();
        this.pot = [new Pot()];
        this.communityCards = [];
        this.buttonIndex = 0;
        this.currentBet = 0;
        this.currentPlayerIndex = 0;
        this.handInProgress = false;
    }

    addPlayer(player) {
        if (this.players.length >= this.maxPlayers) {
            return false;
        }
        this.players.push(player);
        return true;
    }

    removePlayer(name) {
        this.players = this.players.filter(p => p.name !== name);
    }

    getActivePlayers() {
        return this.players.filter(
            p => 
                p.state === PlayerState.IN_GAME ||
                p.state === PlayerState.READY        );
    }

    getPlayerSeat(seatIndex) {
        return this.players.find(p => p.getSeat() === seatIndex);
    }

    getNextActivePlayer(startIndex) {
        const n = this.players.length;
        for (let i = 1; i <= n; i++) {
            const index = (startIndex + i) % n;
            const p = this.players[index];
            if (p.state === PlayerState.IN_GAME && p.stack > 0) {
                return index;
            }
        }
        return -1; // no active players
    }



    startHand() {
        if (this.players.length < 2) return false;

        this.buttonIndex = (this.buttonIndex + 1) % this.players.length;

        if (this.deck && typeof this.deck.reset === "function") this.deck.reset();
        if (this.deck && typeof this.deck.shuffle === "function") this.deck.shuffle();

        this.communityCards = [];
        this.pot = [new Pot()];
        this.handInProgress = true;
        this.currentBet = 0;
        this.stage = 'preflop';

        for (const p of this.players) {
            p.resetForNewHand(); // Use new method instead of individual calls
            if (p.state !== PlayerState.LEFT && p.stack > 0) {
                p.state = PlayerState.IN_GAME;
            }
        }

        // deal two cards
        for (let i = 0; i < 2; i++) {
            for (const p of this.players) {
                if (p.state === PlayerState.IN_GAME) {
                    p.addCards([this.deck.deal()]);
                }
            }
        }

        this.currentPlayerIndex = this.getNextActivePlayer(this.buttonIndex);
        return true;
    }



    nextBettingRound() {
        const len = this.communityCards.length;
        
        if (len === 0) {
            // Preflop -> Flop
            this.stage = 'flop';
            this.communityCards.push(this.deck.deal(), this.deck.deal(), this.deck.deal());
            console.log(`🃏 Flop dealt: ${this.communityCards.map(c => c.toString()).join(', ')}`);
        }
        else if (len === 3) {
            // Flop -> Turn
            this.stage = 'turn';
            this.communityCards.push(this.deck.deal());
            console.log(`🃏 Turn dealt: ${this.communityCards[3].toString()}`);
        }
        else if (len === 4) {
            // Turn -> River
            this.stage = 'river';
            this.communityCards.push(this.deck.deal());
            console.log(`🃏 River dealt: ${this.communityCards[4].toString()}`);
        } 
        else {
            // River is complete, go to showdown
            console.log("🏁 All betting rounds complete - going to showdown");
            this.resolveShowdown();
            this.currentPlayerIndex = -1; // Stop further actions
            return; // Important: don't continue
        }
    }

    playerAction(name, action, amount = 0) {
        const player = this.players.find(p => p.name === name);
        if (!player) return false;

        const playerIndex = this.players.findIndex(p => p.name === name);
        if (playerIndex !== this.currentPlayerIndex) {
            console.log(`❌ ${name} tried to act but it's not their turn (current: ${this.currentPlayerIndex})`);
            return false;
        }

        if (player.state !== PlayerState.IN_GAME) {
            console.log(`❌ ${name} cannot act - state is ${player.state}`);
            return false;
        }

        const act = String(action).toUpperCase();

        // Apply action
        switch (act) {
            case "BET":
                if (player.bet(amount)) {
                    this.currentBet = Math.max(this.currentBet, player.currentBet);
                    this.pot[0].addContribution(name, amount);
                    player.actedThisRound = true;
                } else {
                    return false;
                }
                break;

            case "CALL": {
                const callAmount = Math.max(0, this.currentBet - player.currentBet);
                if (callAmount > 0 && player.bet(callAmount)) {
                    this.pot[0].addContribution(name, callAmount);
                }
                player.actedThisRound = true;
                break;
            }

            case "FOLD":
                player.fold();
                player.actedThisRound = true;
                break;

            case "ALL_IN":
                const allInAmount = player.stack;
                player.allIn();
                if (allInAmount > 0) {
                    this.pot[0].addContribution(name, allInAmount);
                    this.currentBet = Math.max(this.currentBet, player.currentBet);
                }
                player.actedThisRound = true;
                break;

            default:
                return false;
        }

        // Check if hand is over (only one player left)
        if (this.isHandOver()) {
            console.log("🏁 Hand is over - resolving showdown");
            this.resolveShowdown();
            this.handInProgress = false;
            this.currentPlayerIndex = -1;
            this.logGameState();
            return true;
        }

        // Check if betting round is complete
        if (this.isBettingRoundComplete()) {
            console.log("✅ Betting round complete - moving to next round");
            
            // Reset for next round
            for (const p of this.players) {
                p.actedThisRound = false;
                if (p.state === PlayerState.IN_GAME) {
                    p.currentBet = 0; // ✅ Reset bets for new round
                }
            }
            this.currentBet = 0;

            // Check if all remaining players are all-in
            const activePlayers = this.players.filter(p => 
                p.state === PlayerState.IN_GAME && !p.isAllIn
            );
            
            if (activePlayers.length === 0) {
                // Everyone is all-in, run out the board
                console.log("🎰 All players all-in - running out the board");
                this.runOutBoard();
                return true;
            }
            
            // Move to next betting round (or showdown if river is complete)
            this.nextBettingRound();
            
            // Check if hand ended during nextBettingRound
            if (!this.handInProgress) {
                console.log("🏁 Hand completed via showdown");
                return true;
            }
            
            // Set first player for new betting round
            this.currentPlayerIndex = this.getNextActivePlayer(this.buttonIndex);
            console.log(`🎯 New round - first to act: ${this.currentPlayerIndex}`);
        } else {
            // Advance to next active player
            this.currentPlayerIndex = this.getNextActivePlayer(this.currentPlayerIndex);
        }

        this.logGameState();
        return true;
    }

    runOutBoard() {
        // Deal remaining community cards without betting
        const cardsNeeded = 5 - this.communityCards.length;
        
        for (let i = 0; i < cardsNeeded; i++) {
            this.nextBettingRound(); // This deals the cards
            if (!this.handInProgress) break; // Showdown was called
        }
        
        console.log(`🃏 Final board: ${this.communityCards.map(c => c.toString()).join(', ')}`);
    }

    // Add this helper method
    isBettingRoundComplete() {
        const activePlayers = this.players.filter(p => 
            p.state === PlayerState.IN_GAME && !p.isAllIn
        );
        
        // If no active players left (all folded or all-in), round is complete
        if (activePlayers.length === 0) {
            console.log("⚠️ No active players left");
            return true;
        }
        
        // Check if all active players have acted
        const allActed = activePlayers.every(p => p.actedThisRound);
        if (!allActed) {
            return false;
        }
        
        // Check if all active players have matching bets
        const allBetsEqual = activePlayers.every(p => p.currentBet === this.currentBet);
        
        console.log(`Betting check: allActed=${allActed}, allBetsEqual=${allBetsEqual}, currentBet=${this.currentBet}`);
        
        return allBetsEqual;
    }

    // Add this helper method
    isBettingRoundComplete() {
        const activePlayers = this.players.filter(p => 
            p.state === PlayerState.IN_GAME && !p.isAllIn
        );
        
        // If no active players left (all folded or all-in), round is complete
        if (activePlayers.length === 0) {
            console.log("⚠️ No active players left (all all-in or folded)");
            return true;
        }
        
        // If only one active player and all others are folded/all-in, hand is over
        // (this check should happen in isHandOver, but let's be safe)
        if (activePlayers.length === 1) {
            const nonFoldedPlayers = this.players.filter(p => 
                p.state === PlayerState.IN_GAME || p.isAllIn
            );
            if (nonFoldedPlayers.length === 1) {
                console.log("⚠️ Only one player left, hand should end");
                return true;
            }
        }
        
        // Check if all active players have acted
        const allActed = activePlayers.every(p => p.actedThisRound);
        if (!allActed) {
            return false;
        }
        
        // Check if all active players have matching bets
        const allBetsEqual = activePlayers.every(p => p.currentBet === this.currentBet);
        
        console.log(`Betting check: allActed=${allActed}, allBetsEqual=${allBetsEqual}, currentBet=${this.currentBet}`);
        
        return allBetsEqual;
    }


    resolveShowdown() {
        const activePlayers = this.players.filter(
            p => p.state === PlayerState.IN_GAME || p.isAllIn
        );
        
        console.log(`🎰 Showdown with ${activePlayers.length} players:`);
        activePlayers.forEach(p => {
            console.log(`  - ${p.name}: ${p.hand.map(c => c.toString()).join(', ')}`);
        });
        console.log(`  Community: ${this.communityCards.map(c => c.toString()).join(', ')}`);

        const result = Showdown.evaluate(activePlayers, this.communityCards, this.pot);
        console.log(`💰 Winner(s):`);
        result.winners.forEach(w => {
            console.log(`  - ${w.name} wins ${result.payouts.find(p => p.name === w.name)?.amount || 0} chips`);
        });    
        this.endHand(); // Properly end the hand
        return result;
    }




    snapshot() {
        const SnapshotModule = require("./snapshot"); // ✅ reload mock reference
        return SnapshotModule.create(this);
    }


    // inside Table.js
    broadcast(io) {
        io.emit("state", this.getState());
    }

    getState() {
        return {
            players: this.players.map((p, i) => ({
                seatIndex: i,
                name: p.name,
                stack: p.stack,
                hand: p.hand,
                state: p.state,
                isActive: p.isActive,
                currentBet: p.currentBet,
                socketId: p.socketId || null,
                isAllIn: p.isAllIn || false,
            })),
            communityCards: [...this.communityCards],
            pot: this.pot.map(p => ({ 
                total: p.total ?? 0, 
                contributions: p.contributions ? Object.fromEntries(p.contributions) : {} 
            })),
            currentBet: this.currentBet,
            currentPlayer: typeof this.currentPlayerIndex === 'number' ? this.currentPlayerIndex : -1,
            buttonIndex: this.buttonIndex,
            stage: this.stage || 'waiting',
            handInProgress: this.handInProgress,
        };
    }


    removePlayerBySocketId(id) {
        const index = this.players.findIndex(p => p.socketId === id);
        if (index !== -1) this.players.splice(index, 1);
    }

    isHandOver() {
        const nonFoldedPlayers = this.players.filter(p => 
            p.state === PlayerState.IN_GAME || p.isAllIn
        );
        
        // Hand is over if only 0 or 1 players remain (including all-in players)
        return nonFoldedPlayers.length <= 1;
    }

    resetForNextHand() {
        this.communityCards = [];
        this.pot = [new Pot()];
        this.currentBet = 0;
        this.handInProgress = false;
        for (const p of this.players) {
            p.resetBet();
            if (p.state !== PlayerState.LEFT) {
                p.state = PlayerState.READY;
            }
        }
    }

    endHand() {
        console.log("🎉 Hand ended! Final stacks:");
        this.players.forEach(p => {
            console.log(`  ${p.name}: ${p.stack} chips`);
        });
        this.handInProgress = false;
        this.currentPlayerIndex = -1;
        this.communityCards = [];
        this.currentBet = 0;
        
        // Reset all players for next hand
        for (const p of this.players) {
            if (p.state === PlayerState.FOLDED) {
                p.state = PlayerState.READY;
            } else if (p.state === PlayerState.IN_GAME) {
                p.state = PlayerState.READY;
            }
            p.resetForNewHand();
        }
    }

    logGameState() {
        const activePlayers = this.players
            .filter(p => p.state === PlayerState.IN_GAME)
            .map(p => `${p.name}(${p.state}, bet:${p.currentBet}, stack:${p.stack})`)
            .join(', ');
        console.log(`📊 Stage: ${this.stage}, CurrentBet: ${this.currentBet}, Active: [${activePlayers}]`);
    }
}

module.exports = Table;