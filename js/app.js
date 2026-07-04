/**
 * Harry Potter TCG - Application Bootstrapper
 * Loads data resources, normalizes database schema, and orchestrates the engine and UI.
 */

import { GameEngine } from './game-engine.js';
import { UIManager } from './ui.js';
import { DeckBuilder, validateDeck } from './deck-builder.js';


async function bootstrap() {
  try {
    // 1. Fetch JSON databases
    const [baseSetRes, quidditchCupRes, rulesResponse] = await Promise.all([
      fetch('./data/base_set/cards.json'),
      fetch('./data/quidditch_cup/cards.json'),
      fetch('./data/rules.json')
    ]);
    const baseSetDb = await baseSetRes.json();
    const quidditchCupDb = await quidditchCupRes.json();
    const rulesConfig = await rulesResponse.json();

    // 2. Normalize raw card data from Downloads format to Engine structure
    const cardsDb = [
      ...normalizeCards(baseSetDb.cards, 'bs'),
      ...normalizeCards(quidditchCupDb.cards, 'qc')
    ];

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

      deckSelectionModal.close();

      // Trigger the Coin Toss first
      ui.triggerCoinToss((startingPlayerId) => {
        // Set up the match with the chosen starting player
        engine.setupGame(
          pDeck.cardIds,
          oDeck.cardIds,
          pDeck.characterId,
          oDeck.characterId,
          isDebugMatch,
          startingPlayerId
        );

        ui.lastTurnNumber = null;
        ui.lastActivePlayerId = null;
        ui.isInitialTurnAnnouncementDelayed = true;

        showScreen('game');
        ui.render();

        // Show Game Initialized overlay for 2 seconds
        ui.triggerGameStartAnnouncement(startingPlayerId);
      });
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
        engine.dealDamage('player', 10, 'spell');
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
function normalizeCards(rawCards, setPrefix = '') {
  const series = setPrefix === 'qc' ? 'Quidditch Cup' : 'Base Set';
  return rawCards.map(card => {
    const primaryType = card.type ? card.type[0] : 'Lesson';
    const normalized = {
      id: setPrefix ? `${setPrefix}_${card.number}` : card.number,
      name: card.name,
      type: primaryType,
      subTypes: card.subTypes || [],
      text: card.effect ? card.effect.join(' ') : (card.flavorText || ''),
      image: card.image || '',
      series: series,
    };

    let effectText = card.effect ? card.effect.join(' ') : '';
    // Pre-process bracket symbols to full lesson names
    effectText = effectText
      .replace(/\[C\]/g, 'Charms')
      .replace(/\[P\]/g, 'Potions')
      .replace(/\[T\]/g, 'Transfiguration')
      .replace(/\[F\]/g, 'Care of Magical Creatures')
      .replace(/\[Q\]/g, 'Quidditch');

    // Regex for specific lesson types: Charms, Transfiguration, Potions, Herbology, Care of Magical Creatures, Quidditch
    const discardLessonTypeMatch = effectText.match(/discard (\d+) of your (Charms|Transfiguration|Potions|Herbology|Care of Magical Creatures?|Quidditch)\s+Lessons?\s+from\s+play/i);
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

    // Regex for returning lessons to hand
    const returnLessonTypeMatch = effectText.match(/return (\d+) of your (Charms|Transfiguration|Potions|Herbology|Care of Magical Creatures?|Quidditch)\s+Lessons?\s+from\s+play\s+to\s+your\s+hand/i);
    if (returnLessonTypeMatch) {
      let type = returnLessonTypeMatch[2];
      if (type.toLowerCase() === 'care of magical creature') {
        type = 'Care of Magical Creatures';
      }
      normalized.playRequirements = normalized.playRequirements || {};
      normalized.playRequirements.returnLessonsToHand = {
        count: parseInt(returnLessonTypeMatch[1], 10),
        type: type
      };
    }

    if (card.provides && card.provides.length > 0) {
      normalized.provides = {
        type: card.provides[0].lesson,
        amount: parseInt(card.provides[0].amount || '1', 10)
      };
    }

    if (primaryType === 'Lesson') {
      const lessonType = card.lesson ? card.lesson[0] : (card.provides?.[0]?.lesson || '');
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

    if (primaryType === 'Match') {
      normalized.prize = card.prize || '';
      normalized.toWin = card.toWin || '';
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


// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', bootstrap);
