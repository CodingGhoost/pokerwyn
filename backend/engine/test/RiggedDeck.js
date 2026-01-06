class RiggedDeck {
    constructor(cardsToDeal) {
        this.cards = cardsToDeal ? cardsToDeal.reverse() : []; 
    }
    reset() {}
    shuffle() {}
    deal() {
        if (this.cards.length === 0) return "2s";
        return this.cards.pop();
    }
}
module.exports = RiggedDeck;