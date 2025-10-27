"use strict";

export class Deck {
    constructor() {
        this.reset();
    }

    reset() {
        const suits = ['s', 'h', 'c', 'd'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

        this.cards = [];
        for (const value of values) {
            for (const suit of suits) {
                this.cards.push(`${value}${suit}`);
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal() {
        if (this.cards.length == 0){
            throw new Error("No cards left in deck");
        }
        return this.cards.pop();
    }
}

module.exports = Deck;