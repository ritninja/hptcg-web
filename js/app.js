/**
 * Harry Potter TCG - Application Bootstrapper
 * Loads data resources, normalizes database schema, and orchestrates the engine and UI.
 */

import { GameEngine } from './game-engine.js';
import { UIManager } from './ui.js';

// Predefined themed wizarding decks (40 cards each)
const PRESET_DECKS = {
  gryffindor: {
    name: "Gryffindor / Hermione's Deck",
    lessons: [
      { type: 'Care of Magical Creatures', count: 12 },
      { type: 'Transfiguration', count: 8 }
    ],
    cards: [
      { name: 'Avifors', count: 2 },
      { name: 'Curious Raven', count: 4 },
      { name: 'Epoximise', count: 2 },
      { name: 'Forest Troll', count: 3 },
      { name: 'Hagrid and the Stranger', count: 1 },
      { name: 'Incarcifors', count: 3 },
      { name: 'Take Root', count: 2 },
      { name: 'Vicious Wolf', count: 3 }
    ]
  },
  slytherin: {
    name: "Slytherin / Draco's Deck",
    lessons: [
      { type: 'Care of Magical Creatures', count: 10 },
      { type: 'Charms', count: 10 }
    ],
    cards: [
      { name: 'Accio', count: 2 },
      { name: 'Boa Constrictor', count: 2 },
      { name: 'Curious Raven', count: 3 },
      { name: 'Hagrid and the Stranger', count: 1 },
      { name: 'Magical Mishap', count: 4 },
      { name: 'Stupefy', count: 2 },
      { name: 'Surly Hound', count: 2 },
      { name: 'Vermillious', count: 4 }
    ]
  },
  ravenclaw: {
    name: "Ravenclaw / Flitwick's Deck",
    lessons: [
      { type: 'Charms', count: 10 },
      { type: 'Transfiguration', count: 10 }
    ],
    cards: [
      { name: 'Stupefy', count: 3 },
      { name: 'Vermillious', count: 3 },
      { name: 'Magical Mishap', count: 2 },
      { name: 'Incendio', count: 2 },
      { name: 'Avifors', count: 2 },
      { name: 'Epoximise', count: 2 },
      { name: 'Remembrall', count: 2 },
      { name: 'Wingardium Leviosa!', count: 2 },
      { name: 'Baubillious', count: 2 }
    ]
  },
  hufflepuff: {
    name: "Hufflepuff / Snape's Deck",
    lessons: [
      { type: 'Potions', count: 12 },
      { type: 'Transfiguration', count: 8 }
    ],
    cards: [
      { name: 'Boil Cure', count: 3 },
      { name: 'Forgetfulness Potion', count: 3 },
      { name: 'Potion Ingredients', count: 3 },
      { name: 'Snuffling Potion', count: 2 },
      { name: 'Dungbomb', count: 3 },
      { name: 'Foul Brew', count: 2 },
      { name: 'Lost Notes', count: 2 },
      { name: 'Incarcifors', count: 2 }
    ]
  },
  creatures: {
    name: "Hagrid's / Creatures Deck",
    lessons: [
      { type: 'Care of Magical Creatures', count: 15 },
      { type: 'Transfiguration', count: 5 }
    ],
    cards: [
      { name: 'Unicorn', count: 2 },
      { name: 'Delivery Owl', count: 2 },
      { name: 'Forest Troll', count: 3 },
      { name: 'Vicious Wolf', count: 3 },
      { name: 'Scottish Stag', count: 2 },
      { name: 'Surly Hound', count: 2 },
      { name: 'Hagrid and the Stranger', count: 2 },
      { name: 'Kelpie', count: 2 },
      { name: 'Guard Dog', count: 2 }
    ]
  }
};

async function bootstrap() {
  try {
    // 1. Fetch JSON databases
    const cardsResponse = await fetch('./data/cards.json');
    const cardsDbRaw = await cardsResponse.json();

    const rulesResponse = await fetch('./data/rules.json');
    const rulesConfig = await rulesResponse.json();

    // 2. Normalize raw card data from Downloads format to Engine structure
    const cardsDb = normalizeCards(cardsDbRaw.cards);

    // 3. Initialize Game Engine
    const engine = new GameEngine(cardsDb, rulesConfig);

    // 4. Initialize UI Manager
    const ui = new UIManager(engine);

    // 5. Connect UI updates to state changes
    engine.onStateChange(() => {
      ui.render();
    });

    // 6. Setup the Deck & Character Selection Dialog
    const deckSelectionModal = document.getElementById('deck-selection-modal');
    
    const playerCharSelect = document.getElementById('player-char-select');
    const playerDeckSelect = document.getElementById('player-deck-select');
    const playerPreview = document.getElementById('player-char-preview');
    
    const opponentCharSelect = document.getElementById('opponent-char-select');
    const opponentDeckSelect = document.getElementById('opponent-deck-select');
    const opponentPreview = document.getElementById('opponent-char-preview');
    
    const btnStartMatch = document.getElementById('btn-start-match');

    // List of canonical wizard/witch starting characters
    const characters = [
      { name: 'Dean Thomas', id: '1' },
      { name: 'Draco Malfoy', id: '2' },
      { name: 'Hannah Abbott', id: '7' },
      { name: 'Harry Potter', id: '8' },
      { name: 'Hermione Granger', id: '9' },
      { name: 'Nearly Headless Nick', id: '13' },
      { name: 'Professor Filius Flitwick', id: '15' },
      { name: 'Professor Severus Snape', id: '16' },
      { name: 'Ron Weasley', id: '17' },
      { name: 'Rubeus Hagrid', id: '18' }
    ];

    // Populate Character select tags
    characters.forEach(char => {
      const opt1 = document.createElement('option');
      opt1.value = char.id;
      opt1.innerText = char.name;
      playerCharSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = char.id;
      opt2.innerText = char.name;
      opponentCharSelect.appendChild(opt2);
    });

    // Populate Deck select tags
    Object.keys(PRESET_DECKS).forEach(key => {
      const opt1 = document.createElement('option');
      opt1.value = key;
      opt1.innerText = PRESET_DECKS[key].name;
      playerDeckSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = key;
      opt2.innerText = PRESET_DECKS[key].name;
      opponentDeckSelect.appendChild(opt2);
    });

    // Preview updater
    const updatePreviews = () => {
      const pChar = cardsDb.find(c => c.id === playerCharSelect.value);
      if (pChar) playerPreview.src = pChar.image;

      const oChar = cardsDb.find(c => c.id === opponentCharSelect.value);
      if (oChar) opponentPreview.src = oChar.image;
    };

    playerCharSelect.addEventListener('change', updatePreviews);
    opponentCharSelect.addEventListener('change', updatePreviews);

    // Default configuration: Hermione Granger + Gryffindor deck vs Draco Malfoy + Slytherin deck
    playerCharSelect.value = '9';
    playerDeckSelect.value = 'gryffindor';
    opponentCharSelect.value = '2';
    opponentDeckSelect.value = 'slytherin';
    updatePreviews();

    // Show selection dialog overlay initially
    const introRulesModal = document.getElementById('intro-rules-modal');
    const btnGotoDeckSelect = document.getElementById('btn-goto-deck-select');

    if (introRulesModal && btnGotoDeckSelect) {
      introRulesModal.showModal();
      btnGotoDeckSelect.addEventListener('click', () => {
        introRulesModal.close();
        deckSelectionModal.showModal();
      });
    } else {
      deckSelectionModal.showModal();
    }

    // Bind Start Match action
    btnStartMatch.addEventListener('click', () => {
      const pDeckDef = PRESET_DECKS[playerDeckSelect.value];
      const oDeckDef = PRESET_DECKS[opponentDeckSelect.value];

      const pDeckIds = buildCustomDeck(cardsDb, pDeckDef);
      const oDeckIds = buildCustomDeck(cardsDb, oDeckDef);

      engine.setupGame(
        pDeckIds,
        oDeckIds,
        playerCharSelect.value,
        opponentCharSelect.value
      );

      deckSelectionModal.close();
      ui.render();
    });

    // Bind top-right Reset Game button to reopen selection modal
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        deckSelectionModal.showModal();
      });
    }

  } catch (error) {
    console.error('Failed to initialize Harry Potter TCG:', error);
    alert('Failed to load local JSON files. Make sure you are running a local HTTP server (refer to README.md).');
  }
}

/**
 * Normalizes card data from the downloaded Base Set JSON format to the format required by the engine.
 */
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
    // Regex for specific lesson types: Charms, Transfiguration, Potions, Herbology, Care of Magical Creatures
    const discardLessonTypeMatch = effectText.match(/discard (\d+) of your (Charms|Transfiguration|Potions|Herbology|Care of Magical Creatures?)\s+Lessons?\s+from\s+play/i);
    // Regex for generic lessons: discard X of your Lessons from play
    const discardGenericLessonMatch = effectText.match(/discard (\d+) of your Lessons?\s+from\s+play/i);

    if (discardLessonTypeMatch) {
      let type = discardLessonTypeMatch[2];
      // Normalize "Care of Magical Creature" to plural
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

    if (primaryType === 'Adventure') {
      normalized.adventureRules = {
        effect: card.effect?.[0] || '',
        toSolve: card.toSolve || '',
        reward: card.reward || ''
      };
    }

    // Load custom attributes based on character effects
    if (card.name === 'Harry Potter') {
      normalized.effects = { handSizeModifier: 1 };
    } else if (card.name === 'Draco Malfoy') {
      normalized.effects = { opponentStartingHandSizeModifier: -1 };
    }

    return normalized;
  });
}

/**
 * Helper to construct a custom deck array from a structured testing deck definition.
 */
function buildCustomDeck(cardsDb, deckDefinition) {
  const deck = [];

  // Add lessons
  deckDefinition.lessons.forEach(item => {
    const lessonCard = cardsDb.find(c => c.type === 'Lesson' && c.lessonType === item.type);
    if (lessonCard) {
      for (let i = 0; i < item.count; i++) {
        deck.push(lessonCard.id);
      }
    }
  });

  // Add card counts
  deckDefinition.cards.forEach(item => {
    const matchedCard = cardsDb.find(c => c.name.toLowerCase() === item.name.toLowerCase());
    if (matchedCard) {
      for (let i = 0; i < item.count; i++) {
        deck.push(matchedCard.id);
      }
    } else {
      console.warn(`Could not find card "${item.name}" in database.`);
    }
  });

  return deck;
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', bootstrap);
