const Deck = require("./deck");
const Pot = require("./pot");
const Snapshot = require("./snapshot");
const { Showdown } = require("./showdown");
const { PlayerState } = require("./player");

class Table {
    constructor(maxPlayers = 9, deck = null, smallBlind = 5, bigBlind = 10) {
        this.maxPlayers = maxPlayers;
        this.players = [];
        this.deck = deck ?? new Deck();
        this.pot = [new Pot()];
        this.communityCards = [];
        this.buttonIndex = 0;
        this.currentBet = 0;
        this.currentPlayerIndex = 0;
        this.handInProgress = false;
        this.smallBlind = smallBlind;
        this.bigBlind = bigBlind;
    }

    startHand() {
        if (this.players.length < 2) return false;

        this.buttonIndex = (this.buttonIndex + 1) % this.players.length;

        if (this.deck && typeof this.deck.reset === "function") this.deck.reset();
        if (this.deck && typeof this.deck.shuffle === "function") this.deck.shuffle();

        this.communityCards = [];
        this.pot = [new Pot()];
        this.handInProgress = true;
        this.currentBet = this.bigBlind; // Start with big blind as current bet
        this.stage = 'preflop';

        for (const p of this.players) {
            p.resetForNewHand();
            if (p.state !== PlayerState.LEFT && p.stack > 0) {
                p.state = PlayerState.IN_GAME;
            }
        }

        // Post blinds
        const sbIndex = (this.buttonIndex + 1) % this.players.length;
        const bbIndex = (this.buttonIndex + 2) % this.players.length;
        
        const sbPlayer = this.players[sbIndex];
        const bbPlayer = this.players[bbIndex];
        
        if (sbPlayer && sbPlayer.state === PlayerState.IN_GAME) {
            const sbAmount = Math.min(this.smallBlind, sbPlayer.stack);
            sbPlayer.bet(sbAmount);
            this.pot[0].addContribution(sbPlayer.name, sbAmount);
            console.log(`🎲 ${sbPlayer.name} posts small blind: ${sbAmount}`);
        }
        
        if (bbPlayer && bbPlayer.state === PlayerState.IN_GAME) {
            const bbAmount = Math.min(this.bigBlind, bbPlayer.stack);
            bbPlayer.bet(bbAmount);
            this.pot[0].addContribution(bbPlayer.name, bbAmount);
            console.log(`🎲 ${bbPlayer.name} posts big blind: ${bbAmount}`);
        }

        // Deal cards
        for (let i = 0; i < 2; i++) {
            for (const p of this.players) {
                if (p.state === PlayerState.IN_GAME) {
                    p.addCards([this.deck.deal()]);
                }
            }
        }

        // First to act is after big blind
        this.currentPlayerIndex = this.getNextActivePlayer(bbIndex);
        console.log(`🎯 Action starts with ${this.players[this.currentPlayerIndex]?.name}`);
        
        return true;
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
            
            // Player must be IN_GAME, have chips, and not be all-in
            if (p.state === PlayerState.IN_GAME && p.stack > 0 && !p.isAllIn) {
                return index;
            }
        }
        return -1; // no active players
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

    logDetailedState() {
        console.log("\n" + "=".repeat(60));
        console.log("DETAILED STATE:");
        console.log(`  Stage: ${this.stage}, CurrentBet: ${this.currentBet}`);
        console.log(`  CurrentPlayerIndex: ${this.currentPlayerIndex}`);
        console.log("  Players:");
        this.players.forEach((p, i) => {
            console.log(`    [${i}] ${p.name}: state=${p.state}, bet=${p.currentBet}, stack=${p.stack}, allIn=${p.isAllIn}, acted=${p.actedThisRound}`);
        });
        console.log("=".repeat(60) + "\n");
    }

    playerAction(name, action, amount = 0) {
        const player = this.players.find(p => p.name === name);
        if (!player) {
            console.log(`❌ Player ${name} not found`);
            return false;
        }

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
                if (callAmount > 0) {
                    // If player can't afford full call, go all-in with what they have
                    const actualAmount = Math.min(callAmount, player.stack);
                    if (actualAmount > 0) {
                        player.bet(actualAmount);
                        this.pot[0].addContribution(name, actualAmount);
                        
                        // If they bet everything, mark as all-in
                        if (player.stack === 0) {
                            player.isAllIn = true;
                            console.log(`💰 ${name} calls all-in for ${actualAmount} (needed ${callAmount})`);
                        }
                    }
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
                    p.currentBet = 0;
                }
            }
            this.currentBet = 0;
            
            // Check if all remaining players are all-in (no one can act)
            const activePlayers = this.players.filter(p => 
                (p.state === PlayerState.IN_GAME || p.isAllIn)
            );
            const canActPlayers = this.players.filter(p => 
                p.state === PlayerState.IN_GAME && !p.isAllIn && p.stack > 0
            );
            
            if (canActPlayers.length === 0 && activePlayers.length > 1) {
                // Everyone is all-in or folded, run out the board
                console.log("🎰 All remaining players all-in - running out the board");
                this.runOutBoard();
                return true;
            }
            
            // Move to next betting round
            this.nextBettingRound();
            
            // Check if hand ended
            if (!this.handInProgress) {
                console.log("🏁 Hand completed via showdown");
                return true;
            }
            
            // Set first player for new betting round
            this.currentPlayerIndex = this.getNextActivePlayer(this.buttonIndex);
            console.log(`🎯 New round - first to act: ${this.currentPlayerIndex}`);
            
            // Safety check
            if (this.currentPlayerIndex === -1) {
                console.log("⚠️ No active player found for new round - ending hand");
                this.resolveShowdown();
                this.handInProgress = false;
                return true;
            }
        } else {
            // Betting round not complete - advance to next active player
            const nextIndex = this.getNextActivePlayer(this.currentPlayerIndex);
            
            console.log(`🔄 Advancing from player ${this.currentPlayerIndex} (${this.players[this.currentPlayerIndex].name}) to ${nextIndex} (${nextIndex >= 0 ? this.players[nextIndex].name : 'NONE'})`);
            
            this.currentPlayerIndex = nextIndex;
            
            // Safety check: if no valid next player found
            if (this.currentPlayerIndex === -1) {
                console.log(`⚠️ No next active player found after ${name}'s action`);
                
                const canActPlayers = this.players.filter(p => 
                    p.state === PlayerState.IN_GAME && !p.isAllIn && p.stack > 0
                );
                
                console.log(`   Can act players: ${canActPlayers.map(p => p.name).join(', ')}`);
                
                if (canActPlayers.length === 0) {
                    // No one can act - should have been caught by isBettingRoundComplete
                    console.log(`⚠️ Forcing betting round to complete`);
                    // Re-check betting round completion
                    if (this.isBettingRoundComplete()) {
                        // Trigger the completion logic by recursing
                        return this.playerAction(name, "CHECK", 0);
                    }
                }
                
                // Hand is over
                this.resolveShowdown();
                this.handInProgress = false;
                this.currentPlayerIndex = -1;
            }
        }

        this.logDetailedState();
        return true;
    }

    runOutBoard() {
        console.log("🎰 Running out the board (all players all-in)...");
        
        // Deal remaining community cards without betting
        while (this.communityCards.length < 5) {
            const len = this.communityCards.length;
            
            if (len === 0) {
                this.stage = 'flop';
                this.communityCards.push(this.deck.deal(), this.deck.deal(), this.deck.deal());
                console.log(`🃏 Flop: ${this.communityCards.map(c => c.toString()).join(', ')}`);
            }
            else if (len === 3) {
                this.stage = 'turn';
                this.communityCards.push(this.deck.deal());
                console.log(`🃏 Turn: ${this.communityCards[3].toString()}`);
            }
            else if (len === 4) {
                this.stage = 'river';
                this.communityCards.push(this.deck.deal());
                console.log(`🃏 River: ${this.communityCards[4].toString()}`);
            }
        }
        
        console.log(`🃏 Final board: ${this.communityCards.map(c => c.toString()).join(', ')}`);
        
        // Now go to showdown
        this.resolveShowdown();
    }

    isBettingRoundComplete() {
        const activePlayers = this.players.filter(p => 
            p.state === PlayerState.IN_GAME && !p.isAllIn
        );
        
        // Also get all-in players for complete picture
        const allInPlayers = this.players.filter(p => 
            p.state === PlayerState.IN_GAME && p.isAllIn
        );
        
        // If no active players left (all folded or all-in), round is complete
        if (activePlayers.length === 0) {
            console.log("⚠️ No active players left (all all-in or folded)");
            return true;
        }
        
        // Check if all active players have acted
        const allActed = activePlayers.every(p => p.actedThisRound);
        if (!allActed) {
            console.log(`⏳ Not all players acted yet`);
            return false;
        }
        
        // Check if all active players have matching bets
        // Note: all-in players don't need to match if they're already all-in
        const allBetsEqual = activePlayers.every(p => p.currentBet === this.currentBet);
        
        const allPlayersForLog = [...activePlayers, ...allInPlayers];
        console.log(`Betting check: allActed=${allActed}, allBetsEqual=${allBetsEqual}, currentBet=${this.currentBet}, activePlayers=${activePlayers.map(p => `${p.name}:${p.currentBet}`).join(',')}, allIn=${allInPlayers.map(p => `${p.name}:${p.currentBet}`).join(',')}`);
        
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
            if (p.stack === 0) {
            console.log(`  ⚠️ ${p.name} is out of chips!`);
            p.state = PlayerState.LEFT;
        }
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