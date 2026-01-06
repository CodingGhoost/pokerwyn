const Deck = require('../deck.js');

test('deck should have 52 unique cards', () => {
  const deck = new Deck();
  const cards = deck.cards;
  expect(cards.length).toBe(52);

  const unique = new Set(cards);
  expect(unique.size).toBe(52);
});

test('deck should deal cards properly', () => {
  const deck = new Deck();
  const card = deck.deal();
  expect(card).toBeDefined();
  expect(deck.cards.length).toBe(51);
});
