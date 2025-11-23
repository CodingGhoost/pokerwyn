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

        // move the button one seat clockwise (wrap)
        this.buttonIndex = (this.buttonIndex + 1) % this.players.length;

        if (this.deck && typeof this.deck.reset === "function") this.deck.reset();
        if (this.deck && typeof this.deck.shuffle === "function") this.deck.shuffle();

        this.communityCards = [];
        this.pot = [new Pot()];
        this.handInProgress = true;
        this.currentBet = 0;
        this.stage = 'preflop';

        // reset per-player round flags and prepare players
        for (const p of this.players) {
            p.clearCards();
            p.resetBet && p.resetBet(); // if method exists
            p.actedThisRound = false;
            if (p.state !== PlayerState.LEFT && p.stack > 0) {
                p.state = PlayerState.IN_GAME;
            }
        }

        // deal two cards to each in-game player
        for (let i = 0; i < 2; i++) {
            for (const p of this.players) {
                if (p.state === PlayerState.IN_GAME) {
                    p.addCards([this.deck.deal()]);
                }
            }
        }

        // first to act: the first active player after the button
        this.currentPlayerIndex = this.getNextActivePlayer(this.buttonIndex);
        return true;
    }



    nextBettingRound() {
        const len = this.communityCards.length;
        if (len === 0) {
            this.communityCards.push(this.deck.deal(), this.deck.deal(), this.deck.deal());
        }
        else if (len === 3) {
            this.communityCards.push(this.deck.deal());
        }
        else if (len === 4) {
            this.communityCards.push(this.deck.deal());
        } else {
            this.resolveShowdown();
        }
    }

    playerAction(name, action, amount = 0) {
        const player = this.players.find(p => p.name === name);
        if (!player || player.state !== PlayerState.IN_GAME) return false;

        // normalize action
        const act = String(action).toUpperCase();

        // apply action
        switch (act) {
            case "BET":
                if (player.bet(amount)) {
                    this.currentBet = Math.max(this.currentBet, player.currentBet);
                    this.pot[0].addContribution(name, amount);
                    player.actedThisRound = true;
                }
                break;

            case "CALL": {
                const callAmount = Math.max(0, this.currentBet - player.currentBet);
                if (callAmount > 0 && player.bet(callAmount)) {
                    this.pot[0].addContribution(name, callAmount);
                    player.actedThisRound = true;
                }
                break;
            }

            case "FOLD":
                player.fold();
                player.actedThisRound = true;
                break;

            case "ALL_IN":
                player.allIn();
                this.pot[0].addContribution(name, player.currentBet);
                player.actedThisRound = true;
                break;

            default:
                // unknown action
                return false;
        }

        // advance to next active player
        const next = this.getNextActivePlayer(this.currentPlayerIndex);
        this.currentPlayerIndex = next;

        // if only one active player remains, resolve showdown automatically
        if (this.isHandOver()) {
            this.resolveShowdown();
            this.currentPlayerIndex = -1;
        }

        console.log(`➡️ Next player index: ${this.currentPlayerIndex}`);


        return true;
    }


    resolveShowdown() {
        const activePlayers = this.players.filter(
            p => p.state === PlayerState.IN_GAME || p.isAllIn
        );

        const result = Showdown.evaluate(activePlayers, this.communityCards, this.pot);
        this.handInProgress = false;
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
                hand: p.hand,           // don't reveal hole cards in production
                state: p.state,
                isActive: p.isActive,
                currentBet: p.currentBet,
                socketId: p.socketId || null,
            })),
            communityCards: [...this.communityCards],
            pot: this.pot.map(p => ({ total: p.total ?? 0, contributions: p.contributions ? Object.fromEntries(p.contributions) : {} })),
            currentBet: this.currentBet,
            currentPlayer: typeof this.currentPlayerIndex === 'number' ? this.currentPlayerIndex : -1,
            buttonIndex: this.buttonIndex,
            stage: this.stage || null,
        };
    }


    removePlayerBySocketId(id) {
        const index = this.players.findIndex(p => p.socketId === id);
        if (index !== -1) this.players.splice(index, 1);
    }

    isHandOver() {
        const active = this.players.filter(p => 
            (p.state === PlayerState.IN_GAME || p.isAllIn) && p.stack > 0
        );
        return active.length <= 1;
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
}

module.exports = Table;