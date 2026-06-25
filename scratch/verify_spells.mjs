import fs from 'fs';
import { GameEngine, PlayerState } from '../js/game-engine.js';

// Mock normalizeCards (copied from app.js to ensure exact logic matching)
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

    const effectText = card.effect ? card.effect.join(' ') : '';
    const discardLessonTypeMatch = effectText.match(/discard (\d+) of your (Charms|Transfiguration|Potions|Herbology|Care of Magical Creatures?)\s+Lessons?\s+from\s+play/i);
    const discardGenericLessonMatch = effectText.match(/discard (\d+) of your Lessons?\s+from\s+play/i);

    if (discardLessonTypeMatch) {
      let type = discardLessonTypeMatch[2];
      if (type.toLowerCase() === 'care of magical creature') {
        type = 'Care of Magical Creatures';
      }
      normalized.playRequirements = {
        discardLessons: {
          count: parseInt(discardLessonTypeMatch[1], 10),
          type: type
        }
      };
    } else if (discardGenericLessonMatch) {
      normalized.playRequirements = {
        discardLessons: {
          count: parseInt(discardGenericLessonMatch[1], 10),
          type: 'Any'
        }
      };
    }

    if (primaryType === 'Lesson') {
      const lessonType = card.lesson ? card.lesson[0] : '';
      normalized.lessonType = lessonType;
      normalized.provides = {
        type: card.provides?.[0]?.lesson || lessonType,
        amount: parseInt(card.provides?.[0]?.amount || '1', 10)
      };
    } else if (primaryType !== 'Character') {
      if (card.cost !== undefined) {
        normalized.lessonCost = {
          total: parseInt(card.cost || '0', 10),
          type: card.lesson ? card.lesson[0] : ''
        };
      }
    }

    if (primaryType === 'Creature') {
      normalized.damagePerTurn = card.dmgEachTurn ? parseInt(card.dmgEachTurn, 10) : 0;
      normalized.health = card.health ? parseInt(card.health, 10) : 1;
    }

    return normalized;
  });
}

// 1. Setup Mock Card Database and Game Rules
const cardsDataRaw = JSON.parse(fs.readFileSync('./data/cards.json', 'utf8'));
const cardsDb = normalizeCards(cardsDataRaw.cards);

const rulesConfig = {
  setup: {
    deckSize: 60,
    startingHandSize: 7,
    startingActions: 2,
    startingCharactersCount: 1
  }
};

const engine = new GameEngine(cardsDb, rulesConfig);

const hermione = cardsDb.find(c => c.name === 'Hermione Granger') || { id: '9', name: 'Hermione Granger' };
const draco = cardsDb.find(c => c.name === 'Draco Malfoy') || { id: '2', name: 'Draco Malfoy' };

engine.players.player = new PlayerState('player', 'You', hermione);
engine.players.opponent = new PlayerState('opponent', 'Hogwarts Rival', draco);

// Build basic decks
engine.players.player.deck = Array(40).fill(null).map((_, i) => ({
  id: `mock-p-${i}`,
  name: 'Mock Player Card',
  type: 'Lesson',
  lessonType: 'Charms'
}));
engine.players.opponent.deck = Array(40).fill(null).map((_, i) => ({
  id: `mock-o-${i}`,
  name: 'Mock Opponent Card',
  type: 'Lesson',
  lessonType: 'Charms'
}));

// Add some lessons to player's playmat so they meet casting costs
const charmsLessonCard = cardsDb.find(c => c.type === 'Lesson' && c.lessonType === 'Charms');
for (let i = 0; i < 10; i++) {
  engine.players.player.lessons.push({ ...charmsLessonCard, instanceId: `playerlessoncharms${i}` });
}

engine.actionsRemaining = 2;
engine.activePlayerId = 'player';

console.log("=== Verification Tests Initiated ===");

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

// Test 1: Direct damage spell (Stupefy)
const stupefyCard = cardsDb.find(c => c.name === 'Stupefy');
assert(stupefyCard !== undefined, "Found Stupefy card in DB");

const initialOpponentDeckSize = engine.players.opponent.deck.length;
engine.players.player.hand.push({ ...stupefyCard, instanceId: 'stupefyinst' });

console.log("Playing Stupefy...");
const successPlay = engine.playCard('player', 'stupefyinst');
assert(successPlay, "Played Stupefy successfully");
assert(engine.players.opponent.deck.length === initialOpponentDeckSize - 5, "Opponent deck depleted by 5 cards (Stupefy deals 5 damage)");
assert(engine.players.player.discardPile.some(c => c.name === 'Stupefy'), "Stupefy put in player's discard pile");

// Test 2: Choice damage spell (Vermillious)
const vermilliousCard = cardsDb.find(c => c.name === 'Vermillious');
assert(vermilliousCard !== undefined, "Found Vermillious card in DB");

engine.actionsRemaining = 2;
engine.players.player.hand.push({ ...vermilliousCard, instanceId: 'vermilliousinst' });

console.log("Playing Vermillious (Interactive Targeting)...");
engine.playCard('player', 'vermilliousinst');
assert(engine.pendingSpell !== null, "Vermillious requires targeting and creates pendingSpell state");
assert(engine.pendingSpell.choices.some(c => c.id === 'opponent'), "Vermillious choices list includes opponent");

// Resolve spell targeting opponent
const preOppDeckSize = engine.players.opponent.deck.length;
engine.resolvePendingSpell(['opponent']);
assert(engine.pendingSpell === null, "pendingSpell cleared after resolution");
assert(engine.players.opponent.deck.length === preOppDeckSize - 3, "Opponent deck depleted by 3 cards (Vermillious deals 3 damage to opponent)");

// Test 3: Discard retrieval spell (Accio)
const accioCard = cardsDb.find(c => c.name === 'Accio');
assert(accioCard !== undefined, "Found Accio card in DB");

// Place some Lessons in player discard pile
const charmsLesson = cardsDb.find(c => c.type === 'Lesson' && c.lessonType === 'Charms');
engine.players.player.discardPile.push({ ...charmsLesson, instanceId: 'disclesson1' });
engine.players.player.discardPile.push({ ...charmsLesson, instanceId: 'disclesson2' });

console.log("Discard pile contents before playing Accio:");
console.log(engine.players.player.discardPile.map(c => ({ name: c.name, type: c.type, instanceId: c.instanceId })));

engine.actionsRemaining = 2;
engine.players.player.hand.push({ ...accioCard, instanceId: 'accioinst' });

console.log("Playing Accio...");
engine.playCard('player', 'accioinst');
console.log("Pending spell info after playing Accio:");
console.log(engine.pendingSpell);

// Target the two lessons in discard
engine.resolvePendingSpell(['discard-player-disclesson1', 'discard-player-disclesson2']);
console.log("Player hand contents after resolving Accio:");
console.log(engine.players.player.hand.map(c => ({ name: c.name, instanceId: c.instanceId })));

assert(engine.players.player.hand.some(c => c.instanceId === 'disclesson1'), "First lesson retrieved to hand");
assert(engine.players.player.hand.some(c => c.instanceId === 'disclesson2'), "Second lesson retrieved to hand");
assert(!engine.players.player.discardPile.some(c => c.instanceId === 'disclesson1'), "First lesson removed from discard pile");

// Test 4: Next-turn damage prevention (Wingardium Leviosa!)
const wingardiumCard = cardsDb.find(c => c.name === 'Wingardium Leviosa!');
assert(wingardiumCard !== undefined, "Found Wingardium Leviosa! in DB");

engine.actionsRemaining = 2;
engine.players.player.hand.push({ ...wingardiumCard, instanceId: 'wingardiuminst' });
console.log("Playing Wingardium Leviosa!...");
engine.playCard('player', 'wingardiuminst');
assert(engine.players.player.preventCreatureDamageNextTurn === true, "Active preventCreatureDamageNextTurn flag is set");

// Opponent tries to attack with a creature
engine.endTurn(); // Switches active to opponent, but should NOT clear Player's protection yet.
assert(engine.players.player.preventCreatureDamageNextTurn === true, "Player protection remains active during Opponent's turn");

const prePlayerDeckSize = engine.players.player.deck.length;
console.log("Opponent deals creature damage...");
engine.dealDamage('player', 3, 'creature');
assert(engine.players.player.deck.length === prePlayerDeckSize, "Damage was prevented because Wingardium Leviosa! is active");

console.log("Opponent deals spell damage...");
engine.dealDamage('player', 3, 'spell');
assert(engine.players.player.deck.length === prePlayerDeckSize - 3, "Spell damage was NOT prevented (only Creature damage)");

// Turn ends for opponent
engine.endTurn(); // Switches active back to player
assert(engine.players.player.preventCreatureDamageNextTurn === false, "Player protection expired at the end of opponent's turn");

console.log("=== All Tests Passed Successfully! ===");
