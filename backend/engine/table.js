const Deck = require("./deck");
const Pot = require("./pot");
const Snapshot = require("/snapshot");
const { Showdown } = require("./showdown");
const { PlayerState } = require("./player");

class Table {
    constructor( maxPlayers = 9 ) {
        this.maxPlayers = maxPlayers;
        this.players = [];
        this.deck = new Deck();
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
            if (
                p.state === PlayerState.IN_GAME &&
                !p.isAllIn &&
                p.stack > 0
            ) {
                return index;
            }
        }
        return -1;
    }

    startHand() {
        if (this.players.length < 2) return false;

        this.deck.reset();
        this.deck.shuffle();
        this.communityCards = [];
        this.pot = [new Pot()];
        this.handInProgress = true;
        this.currentBet = 0;

        for (const p of this.players) {
            p.clearCards();
            if (p.state !== PlayerState.LEFT && p.stack > 0) {
                p.state = PlayerState.IN_GAME;
            }
        }

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
        if (!player || player.state !== PlayerState.IN_GAME) return;

        switch (action) {
            case "BET":
                if (player.bet(amount)) {
                    this.currentBet = Math.max(this.currentBet, player.currentBet);
                    this.pot[0].addContribution(name, amount);
                }
                break;

            case "CALL":
                const callAmount = this.currentBet - player.currentBet;
                if (callAmount > 0 && player.bet(callAmount)) {
                    this.pot[0].addContribution(name, callAmount);
                }
                break;

            case "FOLD":
                player.fold();
                break;

            case "ALL_IN":
                player.allIn();
                this.pot[0].addContribution(name, player.currentBet);
                break;
        }

        this.currentPlayerIndex = this.getNextActivePlayer(this.currentPlayerIndex);
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
        return Snapshot.create(this);
    }

    getState() {
        return {
            players: this.players.map(p => ({
                name: p.name,
                stack: p.stack,
                state: p.state,
                isAllIn: p.isAllIn,
                bet: p.currentBet,
                hand: p.getCards(),
            })),
            communityCards: this.communityCards,
            pot: this.pot.map(p => p.amount),
            currentBet: this.currentBet,
            handInProgress: this.handInProgress,
        };
    }

    broadcast(io) {
        io.emit("table:update", this.getState());
    }

    isHandOver() {
        const active = this.getActivePlayers().filter(p => p.state === PlayerState.IN_GAME);
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