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
        
        // FIX 1: Initialize to -1 so the first increment sets it to 0 (P1)
        this.buttonIndex = -1; 
        
        this.currentBet = 0;
        this.currentPlayerIndex = 0;
        this.handInProgress = false;
        this.smallBlind = smallBlind;
        this.bigBlind = bigBlind;
        this.minRaiseAmount = this.bigBlind;
        this.lastAggressorIndex = -1;
    }

    startHand() {
        // Check if enough players have chips to play
        const playersWithChips = this.players.filter(p => 
            p.state !== PlayerState.LEFT && p.stack > 0
        );
        
        if (playersWithChips.length < 2) {
            console.log("🏆 GAME OVER - Not enough players with chips to continue");
            if (playersWithChips.length === 1) {
                console.log(`🎊 ${playersWithChips[0].name} wins the game with ${playersWithChips[0].stack} chips!`);
            }
            this.handInProgress = false;
            return false;
        }

        // Move button
        this.buttonIndex = (this.buttonIndex + 1) % this.players.length;
        
        // Skip players with no chips for button position
        let attempts = 0;
        while (this.players[this.buttonIndex].stack === 0 && attempts < this.players.length) {
            this.buttonIndex = (this.buttonIndex + 1) % this.players.length;
            attempts++;
        }

        if (this.deck && typeof this.deck.reset === "function") this.deck.reset();
        if (this.deck && typeof this.deck.shuffle === "function") this.deck.shuffle();

        this.communityCards = [];
        this.pot = [new Pot()];
        this.handInProgress = true;
        this.currentBet = this.bigBlind;
        this.stage = 'preflop';
        this.minRaiseAmount = this.bigBlind;

        for (const p of this.players) {
            p.resetForNewHand();
            if (p.state !== PlayerState.LEFT && p.stack > 0) {
                p.state = PlayerState.IN_GAME;
            }
        }

        // HEADS-UP SPECIAL CASE: Only 2 players with chips
        if (playersWithChips.length === 2) {
            console.log("👥 Heads-up! Button posts small blind, other player posts big blind");
            
            const buttonPlayer = this.players[this.buttonIndex];
            const otherPlayerIndex = this.players.findIndex((p, i) => 
                i !== this.buttonIndex && p.state === PlayerState.IN_GAME && p.stack > 0
            );
            const otherPlayer = this.players[otherPlayerIndex];
            
            // Button posts small blind
            if (buttonPlayer && buttonPlayer.stack > 0) {
                const sbAmount = Math.min(this.smallBlind, buttonPlayer.stack);
                buttonPlayer.bet(sbAmount);
                // FIX 2a: Check if blind put player all-in
                if (buttonPlayer.stack === 0) buttonPlayer.isAllIn = true; 
                console.log(`🎲 ${buttonPlayer.name} (button) posts small blind: ${sbAmount}`);
            }
            
            // Other player posts big blind
            if (otherPlayer && otherPlayer.stack > 0) {
                const bbAmount = Math.min(this.bigBlind, otherPlayer.stack);
                otherPlayer.bet(bbAmount);
                // FIX 2b: Check if blind put player all-in
                if (otherPlayer.stack === 0) otherPlayer.isAllIn = true;
                console.log(`🎲 ${otherPlayer.name} posts big blind: ${bbAmount}`);
            }
            
            for (let i = 0; i < 2; i++) {
                for (const p of this.players) {
                    if (p.state === PlayerState.IN_GAME) {
                        p.addCards([this.deck.deal()]);
                    }
                }
            }
            
            this.currentPlayerIndex = this.buttonIndex;
            console.log(`🎯 Heads-up: Button (${buttonPlayer.name}) acts first`);
            
        } else {
            // NORMAL MULTI-WAY: Standard blind positions
            const sbIndex = (this.buttonIndex + 1) % this.players.length;
            const bbIndex = (this.buttonIndex + 2) % this.players.length;
            
            const sbPlayer = this.players[sbIndex];
            const bbPlayer = this.players[bbIndex];
            
            if (sbPlayer && sbPlayer.state === PlayerState.IN_GAME && sbPlayer.stack > 0) {
                const sbAmount = Math.min(this.smallBlind, sbPlayer.stack);
                sbPlayer.bet(sbAmount);
                // FIX 2c: Check if blind put player all-in
                if (sbPlayer.stack === 0) sbPlayer.isAllIn = true;
                console.log(`🎲 ${sbPlayer.name} posts small blind: ${sbAmount}`);
            }
            
            if (bbPlayer && bbPlayer.state === PlayerState.IN_GAME && bbPlayer.stack > 0) {
                const bbAmount = Math.min(this.bigBlind, bbPlayer.stack);
                bbPlayer.bet(bbAmount);
                // FIX 2d: Check if blind put player all-in
                if (bbPlayer.stack === 0) bbPlayer.isAllIn = true;
                console.log(`🎲 ${bbPlayer.name} posts big blind: ${bbAmount}`);
            }
            
            for (let i = 0; i < 2; i++) {
                for (const p of this.players) {
                    if (p.state === PlayerState.IN_GAME) {
                        p.addCards([this.deck.deal()]);
                    }
                }
            }
            
            this.currentPlayerIndex = this.getNextActivePlayer(bbIndex);
            console.log(`🎯 Action starts with ${this.players[this.currentPlayerIndex]?.name}`);
        }
        
        if (this.currentPlayerIndex === -1) {
            console.log("⚠️ No active player to start - ending hand");
            this.resolveShowdown();
            return false;
        }
        
        return true;
    }

    addPlayer(player) {
        if (this.players.length >= this.maxPlayers) return false;
        this.players.push(player);
        return true;
    }

    removePlayer(name) {
        this.players = this.players.filter(p => p.name !== name);
    }

    getActivePlayers() {
        return this.players.filter(p => p.state === PlayerState.IN_GAME || p.state === PlayerState.READY);
    }

    getPlayerSeat(seatIndex) {
        return this.players.find(p => p.getSeat() === seatIndex);
    }

    getNextActivePlayer(startIndex) {
        const n = this.players.length;
        for (let i = 1; i <= n; i++) {
            const index = (startIndex + i) % n;
            const p = this.players[index];
            if (p.state === PlayerState.IN_GAME && p.stack > 0 && !p.isAllIn) {
                console.log(`[SEARCH] Found Next Active: ${p.name}`);
                return index;
            }
        }
        return -1;
    }

    nextBettingRound() {
        const len = this.communityCards.length;
        if (len === 0) {
            this.stage = 'flop';
            this.communityCards.push(this.deck.deal(), this.deck.deal(), this.deck.deal());
            console.log(`🃏 Flop dealt: ${this.communityCards.map(c => c.toString()).join(', ')}`);
        } else if (len === 3) {
            this.stage = 'turn';
            this.communityCards.push(this.deck.deal());
            console.log(`🃏 Turn dealt: ${this.communityCards[3].toString()}`);
        } else if (len === 4) {
            this.stage = 'river';
            this.communityCards.push(this.deck.deal());
            console.log(`🃏 River dealt: ${this.communityCards[4].toString()}`);
        } else {
            console.log("🏁 All betting rounds complete - going to showdown");
            this.resolveShowdown();
            this.currentPlayerIndex = -1;
            return;
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
        const act = String(action).toUpperCase();
        const player = this.players.find(p => p.name === name);
        if (!player) { console.log(`❌ Player ${name} not found`); return false; }

        const playerIndex = this.players.findIndex(p => p.name === name);
        if (playerIndex !== this.currentPlayerIndex) { console.log(`❌ ${name} tried to act but it's not their turn`); return false; }
        if (player.state !== PlayerState.IN_GAME) { console.log(`❌ ${name} cannot act`); return false; }

        console.log(`[ACTION] ${name} attempts ${act} ${amount}. Stack: ${player.stack}`);

        switch (act) {
            case "BET":
            case "RAISE":
                // FIX: Interpret 'amount' as the "Target Total Bet" (Raise TO X), not "Add X"
                const targetTotalBet = amount;
                const amountToContribute = targetTotalBet - player.currentBet;
                
                // Sanity check: You can't bet less than you already have in the pot
                if (amountToContribute < 0) {
                     throw new Error(`Invalid bet: Cannot reduce bet from ${player.currentBet} to ${targetTotalBet}`);
                }

                const playerTotalBetIfActioned = targetTotalBet;
                const amountNeededToCall = this.currentBet - player.currentBet;
                
                // 1. Pre-validation: Ensure it's not an illegal under-call
                // We compare the *contribution* against what is needed
                if (amountNeededToCall > 0 && amountToContribute < amountNeededToCall && amountToContribute < player.stack) {
                    throw new Error(`Invalid bet: Must call ${amountNeededToCall} (Total: ${this.currentBet}) or go all-in.`);
                }

                // 2. Check for Illegal Under-Raise
                if (playerTotalBetIfActioned > this.currentBet) {
                    const raiseSize = playerTotalBetIfActioned - this.currentBet;
                    
                    if (raiseSize < this.minRaiseAmount && amountToContribute < player.stack) {
                        // Illegal under-raise and not all-in
                        throw new Error(`Invalid raise: Must be at least ${this.minRaiseAmount} (Total: ${this.currentBet + this.minRaiseAmount}).`);
                    }
                }

                // 3. Process the action
                if (player.bet(amountToContribute)) { // Player.js .bet() handles the stack deduction

                    const previousTotalBet = this.currentBet;
                    const playerNewTotalBet = player.currentBet; // Should now equal targetTotalBet

                    this.currentBet = Math.max(previousTotalBet, playerNewTotalBet);
                    player.actedThisRound = true;

                    if (playerNewTotalBet > previousTotalBet) {
                        // It was a raise
                        const raiseSize = playerNewTotalBet - previousTotalBet;
                        this.minRaiseAmount = raiseSize; 
                        
                        console.log(`🔥 ${name} raises to ${playerNewTotalBet}!`);
                        
                        for (const p of this.players) {
                            if (p.name !== name && p.state === PlayerState.IN_GAME && !p.isAllIn) {
                                p.actedThisRound = false;
                            }
                        }
                    } else {
                        console.log(`👍 ${name} calls/checks.`);
                    }
                } else {
                    return false;
                }
                break;

            case "CALL": {
                const callAmount = Math.max(0, this.currentBet - player.currentBet);
                if (callAmount > 0) {
                    const actualAmount = Math.min(callAmount, player.stack);
                    if (actualAmount > 0) {
                        player.bet(actualAmount);                        
                        if (player.stack === 0) {
                            player.isAllIn = true;
                            console.log(`💰 ${name} calls all-in for ${actualAmount}`);
                        }
                    }
                }
                player.actedThisRound = true;
                break;
            }

            case "CHECK":
                if (this.currentBet !== player.currentBet) throw new Error(`${player.name} cannot check when there is a bet`);
                console.log(`👍 ${name} checks.`);
                player.actedThisRound = true;
                break;

            case "FOLD":
                player.fold();
                player.actedThisRound = true;
                break;

            case "ALL_IN":
                const allInAmount = player.stack;
                const previousBet = this.currentBet;
                player.allIn();
                if (allInAmount > 0) {
                    this.currentBet = Math.max(this.currentBet, player.currentBet);
                    if (player.currentBet > previousBet) {
                        console.log(`🔥 ${name} raises all-in!`);
                        for (const p of this.players) {
                            if (p.name !== name && p.state === PlayerState.IN_GAME && !p.isAllIn) {
                                p.actedThisRound = false;
                            }
                        }
                    }
                }
                player.actedThisRound = true;
                break;

            default: return false;
        }

        if (this.isHandOver()) {
            console.log("🏁 Hand is over - resolving showdown");
            this.collectAndCreateSidePots();
            this.resolveShowdown();
            this.handInProgress = false;
            this.currentPlayerIndex = -1;
            this.logGameState();
            return true;
        }

        if (this.isBettingRoundComplete()) {
            console.log("✅ Betting round complete - moving to next round");
            this.collectAndCreateSidePots();

            for (const p of this.players) {
                p.actedThisRound = false;
                if (p.state === PlayerState.IN_GAME) p.currentBet = 0;
            }
            this.currentBet = 0;
            this.minRaiseAmount = this.bigBlind;
            
            const activePlayers = this.players.filter(p => (p.state === PlayerState.IN_GAME || p.isAllIn));
            const canActPlayers = this.players.filter(p => p.state === PlayerState.IN_GAME && !p.isAllIn && p.stack > 0);
            
            if (canActPlayers.length <= 1 && activePlayers.length > 1) {
                console.log("🎰 One active player vs All-Ins - running out the board");
                this.runOutBoard();
                return true;
            }
            
            this.nextBettingRound();
            if (!this.handInProgress) return true;
            
            this.currentPlayerIndex = this.getNextActivePlayer(this.buttonIndex);
            console.log(`🎯 New round - first to act: ${this.currentPlayerIndex}`);
            
            if (this.currentPlayerIndex === -1) {
                console.log("⚠️ No active player found for new round - ending hand");
                this.resolveShowdown();
                this.handInProgress = false;
                return true;
            }
        } else {
            const nextIndex = this.getNextActivePlayer(this.currentPlayerIndex);
            console.log(`🔄 Advancing to ${nextIndex}`);
            this.currentPlayerIndex = nextIndex;
            
            if (this.currentPlayerIndex === -1) {
                const canActPlayers = this.players.filter(p => p.state === PlayerState.IN_GAME && !p.isAllIn && p.stack > 0);
                if (canActPlayers.length === 0 && this.isBettingRoundComplete()) {
                    return this.playerAction(name, "CHECK", 0);
                }
                this.resolveShowdown();
                this.handInProgress = false;
                this.currentPlayerIndex = -1;
            }
        }

        this.logDetailedState();
        return true;
    }

    collectAndCreateSidePots() {
        console.log("💵 Collecting chips and creating side pots...");
        let contributors = this.players.filter(p => p.currentBet > 0 && p.state !== PlayerState.LEFT)
            .map(p => ({ name: p.name, contribution: p.currentBet, isAllIn: p.isAllIn, originalPlayer: p }));
        
        const totalStreetContribution = contributors.reduce((sum, p) => sum + p.contribution, 0);
        if (totalStreetContribution === 0) return;

        this.pot = this.pot.filter(p => p.total > 0);
        let remainingContributions = contributors;

        while (remainingContributions.length > 0) {
            const currentCap = remainingContributions.reduce((min, p) => Math.min(min, p.contribution), Infinity);
            if (currentCap === 0 || currentCap === Infinity) break;

            const newPot = new Pot();
            newPot.isSidePot = true;
            const playersToKeep = [];

            for (const playerContrib of remainingContributions) {
                const contributionToThisPot = currentCap;
                newPot.addContribution(playerContrib.name, contributionToThisPot);
                playerContrib.contribution -= contributionToThisPot;
                if (playerContrib.contribution > 0) playersToKeep.push(playerContrib);
            }

            const contributorsInPot = newPot.getPlayers();
            if (contributorsInPot.length === 1) {
                const lonePlayerName = contributorsInPot[0];
                const lonePlayerObj = this.players.find(p => p.name === lonePlayerName);
                if (lonePlayerObj) {
                    console.log(`↩️ Returning uncalled bet of ${newPot.total} to ${lonePlayerName}`);
                    lonePlayerObj.stack += newPot.total;
                }
            } else {
                console.log(`  Pot Segment added (Cap: ${currentCap}): Total ${newPot.total}`);
                this.pot.push(newPot);
            }
            remainingContributions = playersToKeep;
        }
        
        for (const p of this.players) p.resetBet();
    }

    runOutBoard() {
        console.log("🎰 Running out the board...");
        while (this.communityCards.length < 5) {
            this.communityCards.push(this.deck.deal());
        }
        console.log(`🃏 Final board: ${this.communityCards.map(c => c.toString()).join(', ')}`);
        this.resolveShowdown();
    }

    isBettingRoundComplete() {
        const activePlayers = this.players.filter(p => p.state === PlayerState.IN_GAME && !p.isAllIn);
        const allInPlayers = this.players.filter(p => p.state === PlayerState.IN_GAME && p.isAllIn);
        
        if (activePlayers.length === 0) return true;
        
        const allActed = activePlayers.every(p => p.actedThisRound);
        if (!allActed) return false;
        
        return activePlayers.every(p => p.currentBet === this.currentBet);
    }

    resolveShowdown() {
        // Filter out players who folded or left
        const activePlayers = this.players.filter(
            p => p.state === PlayerState.IN_GAME || p.isAllIn
        );
        
        console.log(`🎰 Showdown with ${activePlayers.length} players`);
        console.log(`  Community: ${this.communityCards.map(c => c.toString()).join(', ')}`);
        
        // Log hands for debugging
        activePlayers.forEach(p => {
            console.log(`  - ${p.name}: ${p.hand.map(c => c.toString()).join(', ')}`);
        });

        // FIX: Evaluate each pot independently to ensure Side Pots always find a winner
        // even if the global hand-strength winner isn't in them.
        for (const pot of this.pot) {
            if (pot.total === 0) continue;

            // 1. Identify who is competing for THIS specific pot
            const potContributorNames = pot.getPlayers();
            const contestants = activePlayers.filter(p => 
                potContributorNames.includes(p.name)
            );

            if (contestants.length === 0) {
                console.log(`⚠️ Pot of ${pot.total} has no active contestants (all folded?).`);
                continue;
            }

            // 2. Default Winner Logic (Walk) for this specific pot
            // If only one player is left in this pot (everyone else folded), they win automatically
            if (contestants.length === 1) {
                const winner = contestants[0];
                console.log(`🏆 Default Winner for Pot (${pot.total}): ${winner.name} (Others folded)`);
                winner.stack += pot.total;
                continue;
            }

            // 3. Evaluate ONLY these contestants for THIS pot
            // We pass [pot] as an array because the library likely expects an array of pots
            const result = Showdown.evaluate(contestants, this.communityCards, [pot]);
            
            // 4. Distribute Winnings for this pot
            if (result.payouts) {
                for (const payout of result.payouts) {
                    const winner = this.players.find(p => p.name === payout.name);
                    if (winner) {
                        // The Showdown library might log "Distributing...", but we ensure stack update happens
                        // If the library ALREADY updates stack (based on previous logs), 
                        // we rely on it. If not, uncomment the line below.
                        // Based on your logs: "P3 receives 300 chips (new stack: 300)" -> Library does update stack.
                        
                        console.log(`  => ${winner.name} takes ${payout.amount} from this pot.`);
                    }
                }
            }
        }

        this.endHand(); // Properly end the hand
    }

    snapshot() {
        const SnapshotModule = require("./snapshot");
        return SnapshotModule.create(this);
    }

    broadcast(io) { io.emit("state", this.getState()); }

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
                actedThisRound: p.actedThisRound
            })),
            communityCards: [...this.communityCards],
            pot: this.pot.map(p => ({ 
                total: p.total ?? 0, 
                contributions: p.contributions ? Object.fromEntries(p.contributions) : {} 
            })),
            currentBet: this.currentBet,
            minRaiseAmount: this.minRaiseAmount,
            currentPlayer: typeof this.currentPlayerIndex === 'number' ? this.currentPlayerIndex : -1,
            buttonIndex: this.buttonIndex,
            stage: this.stage || 'waiting',
            handInProgress: this.handInProgress,
            bigBlind: this.bigBlind,
            smallBlind: this.smallBlind
        };
    }

    removePlayerBySocketId(id) {
        const index = this.players.findIndex(p => p.socketId === id);
        if (index !== -1) this.players.splice(index, 1);
    }

    isHandOver() {
        const nonFoldedPlayers = this.players.filter(p => p.state === PlayerState.IN_GAME || p.isAllIn);
        return nonFoldedPlayers.length <= 1;
    }

    resetForNextHand() {
        this.communityCards = [];
        this.pot = [new Pot()];
        this.currentBet = 0;
        this.handInProgress = false;
        for (const p of this.players) {
            p.resetBet();
            if (p.state !== PlayerState.LEFT) p.state = PlayerState.READY;
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
        
        for (const p of this.players) {
            if (p.state === PlayerState.FOLDED || p.state === PlayerState.IN_GAME) {
                p.state = PlayerState.READY;
            }
            p.resetForNewHand();
        }
    }

    logGameState() {
        const activePlayers = this.players.filter(p => p.state === PlayerState.IN_GAME)
            .map(p => `${p.name}(${p.state}, bet:${p.currentBet})`).join(', ');
        console.log(`📊 Stage: ${this.stage}, CurrentBet: ${this.currentBet}, Active: [${activePlayers}]`);
    }
}

module.exports = Table;