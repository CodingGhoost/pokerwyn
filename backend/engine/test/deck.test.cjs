const Deck = require('../deck.js');

test('deck should have 52 unique cards', () => {
  const deck = new Deck();
  const cards = deck.cards; // access cards directly
  expect(cards.length).toBe(52);

  const unique = new Set(cards);
  expect(unique.size).toBe(52);
});

test('deck should deal cards properly', () => {
  const deck = new Deck();
  const card = deck.deal(); // use correct method name
  expect(card).toBeDefined();
  expect(deck.cards.length).toBe(51);
});
