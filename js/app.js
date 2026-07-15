/**
 * Harry Potter TCG - Application Bootstrapper
 * Loads data resources, normalizes database schema, and orchestrates the engine and UI.
 */

import { GameEngine } from './game-engine.js';
import { UIManager } from './ui.js';
import { DeckBuilder, validateDeck } from './deck-builder.js';
import { MultiplayerManager } from './multiplayer.js';


async function bootstrap() {
  try {
    // 1. Fetch JSON databases
    const [baseSetRes, quidditchCupRes, diagonAlleyRes, rulesResponse] = await Promise.all([
      fetch('./data/base_set/cards.json'),
      fetch('./data/quidditch_cup/cards.json'),
      fetch('./data/diagon_alley/cards.json'),
      fetch('./data/rules.json')
    ]);
    const baseSetDb = await baseSetRes.json();
    const quidditchCupDb = await quidditchCupRes.json();
    const diagonAlleyDb = await diagonAlleyRes.json();
    const rulesConfig = await rulesResponse.json();

    // 2. Normalize raw card data from Downloads format to Engine structure
    const cardsDb = [
      ...normalizeCards(baseSetDb.cards, 'bs'),
      ...normalizeCards(quidditchCupDb.cards, 'qc'),
      ...normalizeCards(diagonAlleyDb.cards, 'da')
    ];

    // Redirect all card images to use the cards_v2 directory with a cache-buster query parameter
    const cacheBuster = Date.now();
    cardsDb.forEach(card => {
      if (card.image) {
        const v2Path = card.image.replace('assets/images/cards/', 'assets/images/cards_v2/');
        card.image = `${v2Path}?v=${cacheBuster}`;
      }
    });

    // 3. Initialize Game Engine
    const engine = new GameEngine(cardsDb, rulesConfig);

    // 4. Initialize UI Manager
    const ui = new UIManager(engine);

    // Initialize Multiplayer Manager
    const multiplayer = new MultiplayerManager();

    // 5. Connect UI updates to state changes
    engine.onStateChange(() => {
      ui.render();
    });



    // 6. Setup the Deck Builder and Screen Management
    const deckBuilder = new DeckBuilder(cardsDb, () => {
      showScreen('menu');
    });

    document.addEventListener('decks-loaded', () => {
      populateMatchDecks();
      populateLanDecks();
    });

    const showScreen = (screenId) => {
      document.getElementById('main-menu-container').classList.add('hidden');
      document.getElementById('deck-builder-container').classList.add('hidden');
      document.getElementById('game-container').classList.add('hidden');
      document.getElementById('lan-menu-container').classList.add('hidden');
      
      if (screenId === 'menu') {
        document.getElementById('main-menu-container').classList.remove('hidden');
      } else if (screenId === 'builder') {
        deckBuilder.show();
      } else if (screenId === 'lan') {
        document.getElementById('lan-menu-container').classList.remove('hidden');
      } else if (screenId === 'game') {
        document.getElementById('game-container').classList.remove('hidden');
        const debugPanel = document.getElementById('debug-menu-panel');
        if (debugPanel) {
          debugPanel.style.display = isDebugMatch ? 'flex' : 'none';
        }
        const btnReset = document.getElementById('btn-reset');
        if (btnReset) {
          btnReset.style.display = engine.isMultiplayer ? 'none' : 'block';
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
        if (deckBuilder.currentDeck && deckBuilder.decks.some(d => d.id === deckBuilder.currentDeck.id)) {
          playerDeckSelect.value = deckBuilder.currentDeck.id;
        } else {
          playerDeckSelect.value = deckBuilder.decks[0].id;
        }
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
    let isLanDebugMode = false;

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
        multiplayer.cleanup();
        engine.isMultiplayer = false;
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

    // Multiplayer (LAN) event binding
    const btnMenuLan = document.getElementById('btn-menu-lan');
    const btnLanBack = document.getElementById('btn-lan-back');
    const btnLanConnectServer = document.getElementById('btn-lan-connect-server');
    const btnLanHostLobby = document.getElementById('btn-lan-host-lobby');
    const btnLanRefreshLobbies = document.getElementById('btn-lan-refresh-lobbies');
    const btnLanStartMatch = document.getElementById('btn-lan-start-match');
    const btnLanLeaveLobby = document.getElementById('btn-lan-leave-lobby');

    const lanPlayerName = document.getElementById('lan-player-name');
    const lanServerUrl = document.getElementById('lan-server-url');
    const lanDeckSelect = document.getElementById('lan-deck-select');
    const lanCharPreviewImg = document.getElementById('lan-char-preview-img');
    const serverConnectionStatus = document.getElementById('server-connection-status');
    const lanActionPanel = document.getElementById('lan-action-panel');
    const lanWaitingRoom = document.getElementById('lan-waiting-room');
    const lanLobbyList = document.getElementById('lan-lobby-list');
    const lobbyHostName = document.getElementById('lobby-host-name');
    const lobbyGuestName = document.getElementById('lobby-guest-name');
    const waitingRoomTitle = document.getElementById('waiting-room-title');

    const populateLanDecks = () => {
      const previousValue = lanDeckSelect.value;
      lanDeckSelect.innerHTML = '';
      deckBuilder.decks.forEach(deck => {
        const opt = document.createElement('option');
        opt.value = deck.id;
        opt.innerText = deck.name + (deck.isPreset ? " (Preset)" : "");
        lanDeckSelect.appendChild(opt);
      });

      // Try to preserve previous selection, or fallback to deck builder active deck
      if (previousValue && deckBuilder.decks.some(d => d.id === previousValue)) {
        lanDeckSelect.value = previousValue;
      } else if (deckBuilder.currentDeck) {
        lanDeckSelect.value = deckBuilder.currentDeck.id;
      }

      updateLanPreview();
    };

    const updateLanPreview = () => {
      const deck = deckBuilder.decks.find(d => d.id === lanDeckSelect.value);
      if (deck) {
        const charCard = cardsDb.find(c => c.id === deck.characterId);
        if (charCard) lanCharPreviewImg.src = charCard.image;
      }
    };

    const updateLobbyDeck = async () => {
      if (!multiplayer.gameId) return;
      const deckId = lanDeckSelect.value;
      const deck = deckBuilder.decks.find(d => d.id === deckId);
      if (!deck) return;
      
      try {
        await fetch(`${multiplayer.serverUrl}/api/lobbies/update-deck`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: multiplayer.gameId,
            role: multiplayer.role,
            deck: {
              id: deck.id,
              name: deck.name,
              characterId: deck.characterId,
              cardIds: deck.cardIds
            }
          })
        });
      } catch (e) {
        console.error("Failed to sync lobby deck:", e);
      }
    };

    lanDeckSelect.addEventListener('change', () => {
      updateLanPreview();
      updateLobbyDeck();
    });

    if (btnMenuLan) {
      btnMenuLan.addEventListener('click', () => {
        isLanDebugMode = false;
        const lanTitle = document.getElementById('lan-title');
        if (lanTitle) lanTitle.innerText = "LAN Multiplayer";
        
        const checkboxDiv = document.getElementById('lan-debug-checkbox')?.closest('div');
        if (checkboxDiv) checkboxDiv.style.display = 'none';

        showScreen('lan');
        populateLanDecks();
        const currentOrigin = window.location.origin;
        lanServerUrl.value = currentOrigin;
        connectToLanServer(currentOrigin);
      });
    }

    const btnMenuDebugLan = document.getElementById('btn-menu-debug-lan');
    if (btnMenuDebugLan) {
      btnMenuDebugLan.addEventListener('click', () => {
        isLanDebugMode = true;
        const lanTitle = document.getElementById('lan-title');
        if (lanTitle) lanTitle.innerText = "LAN Multiplayer - Debug Mode";

        const checkboxDiv = document.getElementById('lan-debug-checkbox')?.closest('div');
        if (checkboxDiv) checkboxDiv.style.display = 'flex';
        const checkbox = document.getElementById('lan-debug-checkbox');
        if (checkbox) checkbox.checked = true;

        showScreen('lan');
        populateLanDecks();
        const currentOrigin = window.location.origin;
        lanServerUrl.value = currentOrigin;
        connectToLanServer(currentOrigin);
      });
    }

    if (btnLanBack) {
      btnLanBack.addEventListener('click', () => {
        multiplayer.cleanup();
        showScreen('menu');
      });
    }

    const connectToLanServer = async (url) => {
      multiplayer.setServerUrl(url);
      serverConnectionStatus.className = 'status-indicator';
      serverConnectionStatus.innerHTML = '<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ffd700;"></span> Connecting...';
      
      try {
        await multiplayer.fetchLobbies();
        serverConnectionStatus.className = 'status-indicator connected';
        serverConnectionStatus.innerHTML = '<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%;"></span> Connected to Server';
        lanActionPanel.classList.remove('hidden');
        refreshLobbiesList();
      } catch (err) {
        console.error("LAN Connection failed:", err);
        serverConnectionStatus.className = 'status-indicator disconnected';
        serverConnectionStatus.innerHTML = '<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%;"></span> Connection Failed';
        lanActionPanel.classList.add('hidden');
      }
    };

    btnLanConnectServer.addEventListener('click', () => {
      connectToLanServer(lanServerUrl.value);
    });

    const refreshLobbiesList = async () => {
      lanLobbyList.innerHTML = '<li style="padding: 16px; text-align: center; color: var(--text-secondary); font-style: italic;">Loading lobbies...</li>';
      try {
        const lobbies = await multiplayer.fetchLobbies();
        lanLobbyList.innerHTML = '';
        if (lobbies.length === 0) {
          lanLobbyList.innerHTML = '<li style="padding: 16px; text-align: center; color: var(--text-secondary); font-style: italic;">No active lobbies. Click Host or Refresh!</li>';
          return;
        }

        lobbies.forEach(lobby => {
          const li = document.createElement('li');
          li.className = 'lobby-item-li';
          
          const nameSpan = document.createElement('span');
          nameSpan.className = 'lobby-item-name';
          nameSpan.innerText = `${lobby.hostName}'s Match` + (lobby.isDebug ? ' (Debug)' : '');

          const idSpan = document.createElement('span');
          idSpan.className = 'lobby-item-id';
          idSpan.innerText = lobby.gameId;

          li.appendChild(nameSpan);
          li.appendChild(idSpan);

          li.addEventListener('click', () => {
            joinExistingLobby(lobby.gameId, lobby.isDebug);
          });
          lanLobbyList.appendChild(li);
        });
      } catch (err) {
        console.error("Failed to load lobbies:", err);
        lanLobbyList.innerHTML = '<li style="padding: 16px; text-align: center; color: #ff4d4d; font-style: italic;">Failed to load lobbies.</li>';
      }
    };

    btnLanRefreshLobbies.addEventListener('click', refreshLobbiesList);

    btnLanHostLobby.addEventListener('click', async () => {
      const pName = lanPlayerName.value.trim() || 'Host';
      const deckId = lanDeckSelect.value;
      const deck = deckBuilder.decks.find(d => d.id === deckId);
      if (!deck) {
        alert("Select a deck first!");
        return;
      }
      
      const lanDebugCheckbox = document.getElementById('lan-debug-checkbox');
      const isDebug = lanDebugCheckbox ? lanDebugCheckbox.checked : false;

      if (!isDebug) {
        const validity = validateDeck(deck, cardsDb);
        if (!validity.isValid) {
          alert(`Cannot host: your deck "${deck.name}" is invalid!\n\nErrors:\n- ${validity.errors.join('\n- ')}`);
          return;
        }
      }

      try {
        const gameId = await multiplayer.createLobby(pName, {
          id: deck.id,
          name: deck.name,
          characterId: deck.characterId,
          cardIds: deck.cardIds
        }, isDebug);

        lanActionPanel.classList.add('hidden');
        lanWaitingRoom.classList.remove('hidden');
        waitingRoomTitle.innerText = `Match Lobby: ${gameId}`;
        lobbyHostName.innerText = pName;
        lobbyHostName.style.fontStyle = 'normal';
        lobbyGuestName.innerText = "Waiting for guest...";
        lobbyGuestName.style.fontStyle = 'italic';
        btnLanStartMatch.classList.add('hidden');

        multiplayer.startLobbyPolling((data) => {
          if (data.guestName) {
            lobbyGuestName.innerText = data.guestName;
            lobbyGuestName.style.fontStyle = 'normal';
            btnLanStartMatch.classList.remove('hidden');
          } else {
            lobbyGuestName.innerText = "Waiting for guest...";
            lobbyGuestName.style.fontStyle = 'italic';
            btnLanStartMatch.classList.add('hidden');
          }
        });
      } catch (err) {
        alert("Failed to create lobby: " + err.message);
      }
    });

    const joinExistingLobby = async (gameId, isDebugLobby = false) => {
      const pName = lanPlayerName.value.trim() || 'Guest';
      const deckId = lanDeckSelect.value;
      const deck = deckBuilder.decks.find(d => d.id === deckId);
      if (!deck) {
        alert("Select a deck first!");
        return;
      }

      let isDebug = isDebugLobby;
      try {
        const res = await fetch(`${multiplayer.serverUrl}/api/lobbies/${gameId}/poll`);
        if (res.ok) {
          const data = await res.json();
          if (data.isDebug !== undefined) {
            isDebug = data.isDebug;
          }
        }
      } catch (e) {
        console.error("Failed to pre-check lobby debug status:", e);
      }

      if (!isDebug) {
        const validity = validateDeck(deck, cardsDb);
        if (!validity.isValid) {
          alert(`Cannot join: your deck "${deck.name}" is invalid!\n\nErrors:\n- ${validity.errors.join('\n- ')}`);
          return;
        }
      }

      try {
        console.log("Guest joining lobby with deck:", deck);
        const hostDeck = await multiplayer.joinLobby(gameId, pName, {
          id: deck.id,
          name: deck.name,
          characterId: deck.characterId,
          cardIds: deck.cardIds
        });

        lanActionPanel.classList.add('hidden');
        lanWaitingRoom.classList.remove('hidden');
        waitingRoomTitle.innerText = `Match Lobby: ${gameId}`;
        lobbyHostName.innerText = multiplayer.opponentName;
        lobbyHostName.style.fontStyle = 'normal';
        lobbyGuestName.innerText = pName;
        lobbyGuestName.style.fontStyle = 'normal';
        btnLanStartMatch.classList.add('hidden');

        multiplayer.startLobbyPolling((data) => {
          if (data.hasStarted) {
            multiplayer.stopLobbyPolling();
            console.log("Guest starting multiplayer game sync...");
            
            multiplayer.setupMultiplayerEngine(engine, ui);
            
            isDebugMatch = multiplayer.isDebug;
            showScreen('game');
            ui.render();
          }
        });
      } catch (err) {
        alert("Failed to join lobby: " + err.message);
      }
    };

    btnLanStartMatch.addEventListener('click', async () => {
      if (multiplayer.role !== 'host') return;
      
      try {
        const res = await fetch(`${multiplayer.serverUrl}/api/lobbies/${multiplayer.gameId}/poll`);
        const data = await res.json();
        
        if (!data.guestDeck) {
          alert("Guest deck details missing!");
          return;
        }

        const hostDeck = deckBuilder.decks.find(d => d.id === lanDeckSelect.value);
        const guestDeck = data.guestDeck;
        console.log("Host starting match. hostDeck:", hostDeck, "guestDeck:", guestDeck);

        ui.triggerCoinToss((startingPlayerId) => {
          engine.setupGame(
            hostDeck.cardIds,
            guestDeck.cardIds,
            hostDeck.characterId,
            guestDeck.characterId,
            multiplayer.isDebug,
            startingPlayerId
          );

          ui.lastTurnNumber = null;
          ui.lastActivePlayerId = null;
          ui.isInitialTurnAnnouncementDelayed = true;

          isDebugMatch = multiplayer.isDebug;

          multiplayer.startMatch(engine).then(() => {
            multiplayer.setupMultiplayerEngine(engine, ui);

            showScreen('game');
            ui.render();
            ui.triggerGameStartAnnouncement(startingPlayerId);
          }).catch(err => {
            alert("Failed to broadcast starting match: " + err.message);
          });
        });
      } catch (err) {
        alert("Failed to start match: " + err.message);
      }
    });

    btnLanLeaveLobby.addEventListener('click', () => {
      multiplayer.cleanup();
      lanWaitingRoom.classList.add('hidden');
      lanActionPanel.classList.remove('hidden');
      refreshLobbiesList();
    });

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

    const btnDebugReturnHandToDeck = document.getElementById('btn-debug-return-hand-to-deck');
    if (btnDebugReturnHandToDeck) {
      btnDebugReturnHandToDeck.addEventListener('click', () => {
        engine.debugReturnHandToDeck();
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
  const series = setPrefix === 'qc' ? 'Quidditch Cup' : (setPrefix === 'da' ? 'Diagon Alley' : 'Base Set');
  return rawCards.map(card => {
    const primaryType = card.type ? card.type[0] : 'Lesson';
    let image = card.image || '';
    if (!image && setPrefix === 'da') {
      image = `assets/images/cards/diagon_alley/${card.number}_${card.name.replace(/'/g, '_')}.png`;
    }
    const normalized = {
      id: setPrefix ? `${setPrefix}_${card.number}` : card.number,
      name: card.name,
      type: primaryType,
      subTypes: card.subTypes || [],
      text: card.effect ? card.effect.join(' ') : (card.flavorText || ''),
      image: image,
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
    const discardLessonTypeMatch = effectText.match(/to play this card,\s+discard\s+(\d+)\s+of\s+your\s+(Charms|Transfiguration|Potions|Herbology|Care of Magical Creatures?|Quidditch)\s+Lessons?\s+from\s+play/i);
    // Regex for generic lessons: discard X of your Lessons from play
    const discardGenericLessonMatch = effectText.match(/to play this card,\s+discard\s+(\d+)\s+of\s+your\s+Lessons?\s+from\s+play/i);

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
    const returnLessonTypeMatch = effectText.match(/to play this card,\s+return\s+(\d+)\s+of\s+your\s+(Charms|Transfiguration|Potions|Herbology|Care of Magical Creatures?|Quidditch)\s+Lessons?\s+from\s+play\s+to\s+your\s+hand/i);
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

      if (normalized.name === 'Hebridean Black Dragon' || normalized.name === 'River Troll') {
        normalized.playRequirements = { discardLessons: { count: 1, type: 'Care of Magical Creatures' } };
      } else if (normalized.name === 'Wild Boar') {
        normalized.playRequirements = { discardLessons: { count: 2, type: 'Care of Magical Creatures' } };
      }
    }

    if (primaryType === 'Item') {
      if (normalized.name === 'Self-Stirring Cauldron') {
        normalized.playRequirements = { discardLessons: { count: 2, type: 'Potions' } };
      }
    }

    if (primaryType === 'Spell') {
      if (normalized.name === 'Butterfly Weed Balm') {
        normalized.playRequirements = { discardLessons: { count: 1, type: 'Potions' } };
      }
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
