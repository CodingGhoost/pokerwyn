const Deck = require("./deck");
const Pot = require("./pot");
const Snapshot = require("/snapShot");
const { evaluateShowdown } = require("./showdown");
const { playerState } = require("./player");

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
        if (this.player.length >= this.maxPlayers) {
            return false;
        }
        this.players.push(player);
        return true;
    }

    removePlayer(playerName) {
        this.players = this.players.filter(p => p.name !== playerName);
    }

    getActivePlayers() {
        return this.players.filter(
            p => 
                p.state === PlayerState.IN_GAME ||
            p.state === PlayerState.READY ||
            p.state === PlayerState.FOLDED
        );
    }

    getPlayerSeat(seatIndex) {
        return this.players.find(p => p.getSeat() === seatIndex);
    }

    getNextActivePlayer(startIndex) {
        const n = this.players.length;
        for (let i = 1; i <= n; i++) {
            const index = (startIndex + i) % n;
            const player = this.players[index];
            if (
                player.state === PlayerState.IN_GAME &&
                !player.isAllIN &&
                player.stack > 0
            ) {
                return index;
            }
        }
        return -1;
    }

    startHand() {
        if (this.players.length < 2) return false;

        this.deck.shuffle();
        this.communityCards = [];
        this.pots = [new Pot()];
        this.handInProgress = true;
        this.currentBet = 0;

        for (const player of this.players) {
            player.clearCards();
            if (p.state !== PlayerState.LEFT && player.stack > 0) {
                player.state = PlayerState.IN_GAME;
            }
        }

        for (let i = 0; i < 2; i++) {
            for (const player of this.players) {
                if (player.state === PlayerState.IN_GAME) {
                    const card = this.deck.deal();
                    player.addCards([card]);
                }
            }
        }

        this.currentPlayerIndex = this.getNextActivePlayerIndex(this.buttonIndex);
        return true;
    }
}