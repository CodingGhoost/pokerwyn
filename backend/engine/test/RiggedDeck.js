class RiggedDeck {
    constructor(cardsToDeal) {
        // Reverse because .pop() takes from the end
        this.cards = cardsToDeal ? cardsToDeal.reverse() : []; 
    }
    reset() {}
    shuffle() {}
    deal() {
        if (this.cards.length === 0) return "2s"; // Default junk card if run out
        return this.cards.pop();
    }
}
module.exports = RiggedDeck;