/**
 * Harry Potter TCG - Application Bootstrapper
 * Loads data resources, normalizes database schema, and orchestrates the engine and UI.
 */

import { GameEngine } from './game-engine.js';
import { UIManager } from './ui.js';
import { DeckBuilder, validateDeck } from './deck-builder.js';

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
    const cardsResponse = await fetch('./data/base_set/cards.json');
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



    // 6. Setup the Deck Builder and Screen Management
    const deckBuilder = new DeckBuilder(cardsDb, () => {
      showScreen('menu');
    });

    const showScreen = (screenId) => {
      document.getElementById('main-menu-container').classList.add('hidden');
      document.getElementById('deck-builder-container').classList.add('hidden');
      document.getElementById('game-container').classList.add('hidden');
      
      if (screenId === 'menu') {
        document.getElementById('main-menu-container').classList.remove('hidden');
      } else if (screenId === 'builder') {
        deckBuilder.show();
      } else if (screenId === 'game') {
        document.getElementById('game-container').classList.remove('hidden');
        const debugPanel = document.getElementById('debug-menu-panel');
        if (debugPanel) {
          debugPanel.style.display = isDebugMatch ? 'flex' : 'none';
        }
        ui.render();
      }
    };

    // Main Menu Buttons
    const btnMenuPlay = document.getElementById('btn-menu-play');
    const btnMenuBuilder = document.getElementById('btn-menu-builder');
    const deckSelectionModal = document.getElementById('deck-selection-modal');

    const playerDeckSelect = document.getElementById('player-deck-select');
    const playerPreview = document.getElementById('player-char-preview');
    const opponentDeckSelect = document.getElementById('opponent-deck-select');
    const opponentPreview = document.getElementById('opponent-char-preview');
    const btnStartMatch = document.getElementById('btn-start-match');

    const updatePreviews = () => {
      const pDeck = deckBuilder.decks.find(d => d.id === playerDeckSelect.value);
      if (pDeck) {
        const pChar = cardsDb.find(c => c.id === pDeck.characterId);
        if (pChar) playerPreview.src = pChar.image;
      }

      const oDeck = deckBuilder.decks.find(d => d.id === opponentDeckSelect.value);
      if (oDeck) {
        const oChar = cardsDb.find(c => c.id === oDeck.characterId);
        if (oChar) opponentPreview.src = oChar.image;
      }
    };

    const populateMatchDecks = () => {
      playerDeckSelect.innerHTML = '';
      opponentDeckSelect.innerHTML = '';

      deckBuilder.decks.forEach(deck => {
        const opt1 = document.createElement('option');
        opt1.value = deck.id;
        opt1.innerText = deck.name + (deck.isPreset ? " (Preset)" : "");
        playerDeckSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = deck.id;
        opt2.innerText = deck.name + (deck.isPreset ? " (Preset)" : "");
        opponentDeckSelect.appendChild(opt2);
      });

      // Default selections
      if (deckBuilder.decks.length > 0) {
        playerDeckSelect.value = deckBuilder.decks[0].id;
        if (deckBuilder.decks.length > 1) {
          opponentDeckSelect.value = deckBuilder.decks[1].id;
        } else {
          opponentDeckSelect.value = deckBuilder.decks[0].id;
        }
      }
      updatePreviews();
    };

    playerDeckSelect.addEventListener('change', updatePreviews);
    opponentDeckSelect.addEventListener('change', updatePreviews);

    let isDebugMatch = false;

    btnMenuPlay.addEventListener('click', () => {
      isDebugMatch = false;
      const titleEl = document.getElementById('deck-selection-title');
      if (titleEl) titleEl.innerText = "Choose Your Deck";
      populateMatchDecks();
      deckSelectionModal.showModal();
    });

    const btnMenuDebug = document.getElementById('btn-menu-debug');
    if (btnMenuDebug) {
      btnMenuDebug.addEventListener('click', () => {
        isDebugMatch = true;
        const titleEl = document.getElementById('deck-selection-title');
        if (titleEl) titleEl.innerText = "Choose Decks (Debug Mode)";
        populateMatchDecks();
        deckSelectionModal.showModal();
      });
    }

    btnMenuBuilder.addEventListener('click', () => {
      showScreen('builder');
    });

    // Start Match action
    btnStartMatch.addEventListener('click', () => {
      const pDeck = deckBuilder.decks.find(d => d.id === playerDeckSelect.value);
      const oDeck = deckBuilder.decks.find(d => d.id === opponentDeckSelect.value);

      if (!pDeck || !oDeck) {
        alert("Decks not found!");
        return;
      }

      // Check deck validity only if NOT in Debug Mode
      if (!isDebugMatch) {
        // Check player deck validity
        const pValidity = validateDeck(pDeck, cardsDb);
        if (!pValidity.isValid) {
          alert(`Cannot play game: your deck "${pDeck.name}" is invalid!\n\nErrors:\n- ${pValidity.errors.join('\n- ')}`);
          return;
        }

        // Check opponent deck validity
        const oValidity = validateDeck(oDeck, cardsDb);
        if (!oValidity.isValid) {
          alert(`Cannot play game: rival's deck "${oDeck.name}" is invalid!\n\nErrors:\n- ${oValidity.errors.join('\n- ')}`);
          return;
        }
      }

      // Set up the match
      engine.setupGame(
        pDeck.cardIds,
        oDeck.cardIds,
        pDeck.characterId,
        oDeck.characterId,
        isDebugMatch
      );

      ui.lastTurnNumber = null;
      ui.lastActivePlayerId = null;

      deckSelectionModal.close();
      showScreen('game');
    });

    // Back to Menu button inside Game
    const btnBackToMenu = document.getElementById('btn-back-to-menu');
    if (btnBackToMenu) {
      btnBackToMenu.addEventListener('click', () => {
        showScreen('menu');
      });
    }

    // Reset Game button inside Game
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        const titleEl = document.getElementById('deck-selection-title');
        if (titleEl) {
          titleEl.innerText = isDebugMatch ? "Choose Decks (Debug Mode)" : "Choose Your Deck";
        }
        populateMatchDecks();
        deckSelectionModal.showModal();
      });
    }

    // Debug Menu buttons
    const btnDebugCreatureDmg = document.getElementById('btn-debug-creature-damage');
    if (btnDebugCreatureDmg) {
      btnDebugCreatureDmg.addEventListener('click', () => {
        engine.debugDealCreatureDamage();
      });
    }

    const btnDebugDealTenDmg = document.getElementById('btn-debug-deal-10-damage');
    if (btnDebugDealTenDmg) {
      btnDebugDealTenDmg.addEventListener('click', () => {
        engine.applyDeckDamage('player', 10);
      });
    }

    const btnDebugEnableActions = document.getElementById('btn-debug-enable-actions');
    if (btnDebugEnableActions) {
      btnDebugEnableActions.addEventListener('click', () => {
        engine.enableUnlimitedActions();
      });
    }

    const btnDebugDisableActions = document.getElementById('btn-debug-disable-actions');
    if (btnDebugDisableActions) {
      btnDebugDisableActions.addEventListener('click', () => {
        engine.disableUnlimitedActions();
      });
    }

    const btnDebugShuffleDeck = document.getElementById('btn-debug-shuffle-deck');
    if (btnDebugShuffleDeck) {
      btnDebugShuffleDeck.addEventListener('click', () => {
        engine.debugShuffleDeck();
      });
    }

    const btnDebugEnableLessons = document.getElementById('btn-debug-enable-lessons');
    if (btnDebugEnableLessons) {
      btnDebugEnableLessons.addEventListener('click', () => {
        engine.debugEnableLessons();
      });
    }

    const btnDebugDisableLessons = document.getElementById('btn-debug-disable-lessons');
    if (btnDebugDisableLessons) {
      btnDebugDisableLessons.addEventListener('click', () => {
        engine.debugDisableLessons();
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

    if (card.provides && card.provides.length > 0) {
      normalized.provides = {
        type: card.provides[0].lesson,
        amount: parseInt(card.provides[0].amount || '1', 10)
      };
    }

    if (primaryType === 'Lesson') {
      const lessonType = card.lesson ? card.lesson[0] : '';
      normalized.lessonType = lessonType;
      if (!normalized.provides) {
        normalized.provides = {
          type: lessonType,
          amount: 1
        };
      }
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
