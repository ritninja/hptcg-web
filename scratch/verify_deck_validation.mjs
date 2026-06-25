import fs from 'fs';
import { validateDeck } from '../js/deck-builder.js';

// Mock card database loading and normalization
function normalizeCards(rawCards) {
  return rawCards.map(card => {
    const primaryType = card.type ? card.type[0] : 'Lesson';
    const normalized = {
      id: card.number,
      name: card.name,
      type: primaryType,
      subTypes: card.subTypes || [],
      text: card.effect ? card.effect.join(' ') : (card.flavorText || ''),
      image: card.image || '',
    };

    if (primaryType === 'Lesson') {
      const lessonType = card.lesson ? card.lesson[0] : '';
      normalized.lessonType = lessonType;
    }

    return normalized;
  });
}

const cardsDataRaw = JSON.parse(fs.readFileSync('./data/cards.json', 'utf8'));
const cardsDb = normalizeCards(cardsDataRaw.cards);

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log("=== Deck Validation Tests Initiated ===");

// 1. Gryffindor Preset Deck (Should be valid)
// Build card ID array manually based on Gryffindor preset definition
const charmsLessonId = cardsDb.find(c => c.type === 'Lesson' && c.lessonType === 'Charms')?.id || 'lesson-charms';
const comcLessonId = cardsDb.find(c => c.type === 'Lesson' && c.lessonType === 'Care of Magical Creatures')?.id || '101';
const transLessonId = cardsDb.find(c => c.type === 'Lesson' && c.lessonType === 'Transfiguration')?.id || '102';

const validDeckCardIds = [];
for (let i = 0; i < 12; i++) validDeckCardIds.push(comcLessonId);
for (let i = 0; i < 8; i++) validDeckCardIds.push(transLessonId);

const cardsToAdd = [
  { name: 'Avifors', count: 2 },
  { name: 'Curious Raven', count: 4 },
  { name: 'Epoximise', count: 2 },
  { name: 'Forest Troll', count: 3 },
  { name: 'Hagrid and the Stranger', count: 1 },
  { name: 'Incarcifors', count: 3 },
  { name: 'Take Root', count: 2 },
  { name: 'Vicious Wolf', count: 3 }
];

cardsToAdd.forEach(item => {
  const matched = cardsDb.find(c => c.name.toLowerCase() === item.name.toLowerCase());
  if (matched) {
    for (let i = 0; i < item.count; i++) validDeckCardIds.push(matched.id);
  }
});

// Pad with Charms lessons to reach exactly 60 cards
while (validDeckCardIds.length < 60) {
  validDeckCardIds.push(charmsLessonId);
}

const hermioneId = '9'; // Hermione Granger
const validDeck = {
  id: 'test-valid',
  name: 'Valid Deck',
  characterId: hermioneId,
  cardIds: validDeckCardIds
};

const vResult = validateDeck(validDeck, cardsDb);
console.log("Valid Deck errors:", vResult.errors);
assert(vResult.isValid === true, "Hermione Granger deck with exactly 60 cards is valid");

// 2. Insufficient card count (Should be invalid)
const shortDeck = {
  id: 'test-short',
  name: 'Short Deck',
  characterId: hermioneId,
  cardIds: validDeckCardIds.slice(0, 50)
};
const sResult = validateDeck(shortDeck, cardsDb);
assert(sResult.isValid === false, "Deck with 50 cards is invalid");
assert(sResult.errors.some(e => e.includes("exactly 60 cards")), "Reports correct deck size error");

// 3. Invalid starting character (Hagrid - not a Witch/Wizard) (Should be invalid)
const hagridId = '18'; // Rubeus Hagrid
const invalidCharDeck = {
  id: 'test-invalid-char',
  name: 'Invalid Character Deck',
  characterId: hagridId,
  cardIds: validDeckCardIds
};
const icResult = validateDeck(invalidCharDeck, cardsDb);
console.log("Invalid starting character errors:", icResult.errors);
assert(icResult.isValid === false, "Deck with Rubeus Hagrid starting character is invalid");
assert(icResult.errors.some(e => e.includes("must be a Witch or Wizard")), "Reports character subtype validity error");

// 4. Duplicate copies limit exceeded (Should be invalid)
const viciousWolf = cardsDb.find(c => c.name === 'Vicious Wolf');
const duplicateDeckIds = [...validDeckCardIds];
// Add 3 more Vicious Wolves (now total 6 copies, replacing some lessons to keep size at 60)
let replaced = 0;
for (let i = 0; i < duplicateDeckIds.length; i++) {
  if (duplicateDeckIds[i] === charmsLessonId && replaced < 3) {
    duplicateDeckIds[i] = viciousWolf.id;
    replaced++;
  }
}

const duplicateDeck = {
  id: 'test-duplicate',
  name: 'Duplicate Deck',
  characterId: hermioneId,
  cardIds: duplicateDeckIds
};
const dResult = validateDeck(duplicateDeck, cardsDb);
console.log("Duplicate deck errors:", dResult.errors);
assert(dResult.isValid === false, "Deck with 6 copies of Vicious Wolf is invalid");
assert(dResult.errors.some(e => e.includes("Too many copies of \"Vicious Wolf\"")), "Reports duplicate copies exceeded error");

// 5. Unlimited Lessons (Should be valid)
// Build a deck of 40 lessons and 20 other cards (no copy limits exceeded)
const heavyLessonsIds = [];
for (let i = 0; i < 40; i++) heavyLessonsIds.push(comcLessonId); // 40 copies of Care of Magical Creatures
for (let i = 0; i < 20; i++) heavyLessonsIds.push(charmsLessonId); // 20 copies of Charms lessons

const lessonHeavyDeck = {
  id: 'test-heavy-lessons',
  name: 'Lesson Heavy Deck',
  characterId: hermioneId,
  cardIds: heavyLessonsIds
};
const lhResult = validateDeck(lessonHeavyDeck, cardsDb);
assert(lhResult.isValid === true, "Deck with 40 copies of COMC lesson and 20 copies of Charms lesson is valid");

console.log("=== All Deck Validation Tests Passed Successfully! ===");
