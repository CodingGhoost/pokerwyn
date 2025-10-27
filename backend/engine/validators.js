"use strict";

const { PlayerState } = require("./player");

class Validator {
    constructor(table) {
        this.table = table;
    }

    validatePlayer(name) {
        const player = this.table.player.find(p => p.name === name);
        if (!player) {
            throw new Error(`Player '${name}' not found at the table.`);
        }

        if (!this.table.handInProgress) {
            throw new Error(`No active hand in progress.`);
        }

        if (
            player.state !== PlayerState.IN_GAME ||
            player.stack <= 0 ||
            player.folded
        ) {
            throw new Error(`Player '${name}' cannot act in their current state.`);
        }

        return player;
    }

    validateAction(player, action, amount = 0) {
        switch (action.toUpperCase()) {
            case "FOLD":
                return this._validateFold(player);

            case "CHECK":
                if (this.table.currentBet > player.currentBet) {
                    throw new Error(`${player.name} cannot check when there is a bet`);
                }
                return true;
            
            case "CALL":
                return this._validateCall(player);
            
            case "BET":
            
            case "RAISE":
                return this._validateBet(player, amount);
            
            case "ALL_IN":
                return this._validateAllIn(player);
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }

    _validateBet(player, amount) {
        if (amount <= 0) {
            throw new Error(`Bet amount must be positive.`);
        }
        if (amount > player.stack) {
            throw new Error(`${player.name} cannot be more than their stack.`);
        }
    }

    _validateCall(player) {
        const callAmount = this.table.currentBet - player.currentBet;
        if (callAmount <= 0) {
            throw new Error(`${player.name} has nothing to call.`);
        }
        if (callAmount > player.stack) {
            throw new Error(`${player.name} cannot call more than their stack.`);
        }
        return true;
    }

    _validateFold(player) {
        if (player.folded) {
            throw new Error(`${player.name} has already folded.`);
        }
        return true;
    }

    _validateAllIn(player) {
        if (player.stack <= 0) {
            throw new Error(`${player.name} has no chips to go all in.`);
        }
        return true;
    }

    validateNextBettingRound() {
        const num = this.table.communityCards.length;
        if (n > 5) throw new Error(`Cannot deal more than 5 community cards.`);
        return true;
    }

    validateShowdown() {
        if (this.table.communityCards.length < 5) {
            throw new Error(`Cannot reach showdown before all 5 community cards are dealt.`);
        }

        const activePlayers = this.table.players.filter(
            p => p.state === PlayerState.IN_GAME || p.isAllIn
        );
        if (activePlayers.length === 0) {
            throw new Error(`No active players to evaluate showdown.`);
        }
        return true;
    }
}

module.exports = Validator;