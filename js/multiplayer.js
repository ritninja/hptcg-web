import { PlayerState } from './game-engine.js';

export class MultiplayerManager {
  constructor() {
    this.serverUrl = window.location.origin; // Defaults to origin served from
    this.gameId = null;
    this.role = null; // 'host' | 'guest'
    this.playerName = 'Wizard';
    this.opponentName = 'Opponent';
    
    this.lobbyInterval = null;
    this.actionPollInterval = null;
    this.statePollInterval = null;
    this.lastStateJson = null;
  }

  setServerUrl(url) {
    if (!url) return;
    this.serverUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  }

  // Matches/Lobby list
  async fetchLobbies() {
    const res = await fetch(`${this.serverUrl}/api/lobbies`);
    if (!res.ok) throw new Error("Failed to load lobbies");
    const data = await res.json();
    return data.lobbies || [];
  }

  async createLobby(hostName, hostDeck, isDebug = false) {
    this.playerName = hostName;
    this.role = 'host';
    this.isDebug = isDebug;
    const res = await fetch(`${this.serverUrl}/api/lobbies/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostName, hostDeck, isDebug })
    });
    if (!res.ok) throw new Error("Failed to create lobby");
    const data = await res.json();
    this.gameId = data.gameId;
    return this.gameId;
  }

  async joinLobby(gameId, guestName, guestDeck) {
    this.playerName = guestName;
    this.gameId = gameId;
    this.role = 'guest';
    const res = await fetch(`${this.serverUrl}/api/lobbies/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, guestName, guestDeck })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to join lobby");
    }
    const data = await res.json();
    this.opponentName = data.hostDeck?.hostName || 'Host';
    this.isDebug = data.isDebug || false;
    return data.hostDeck; // Host details
  }

  startLobbyPolling(callback) {
    if (this.lobbyInterval) clearInterval(this.lobbyInterval);
    this.lobbyInterval = setInterval(async () => {
      try {
        const res = await fetch(`${this.serverUrl}/api/lobbies/${this.gameId}/poll`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.isDebug !== undefined) {
          this.isDebug = data.isDebug;
        }
        callback(data);
      } catch (e) {
        console.error("Lobby poll error", e);
      }
    }, 1000);
  }

  stopLobbyPolling() {
    if (this.lobbyInterval) {
      clearInterval(this.lobbyInterval);
      this.lobbyInterval = null;
    }
  }

  // Game Start Trigger (Host only)
  async startMatch(engine) {
    if (this.role !== 'host') return;
    this.stopLobbyPolling();
    
    // Broadcast initial state
    const state = serializeEngine(engine);
    const res = await fetch(`${this.serverUrl}/api/game/${this.gameId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameState: state })
    });
    if (!res.ok) throw new Error("Failed to start match on server");
  }

  // Intercept actions and proxy
  setupMultiplayerEngine(engine, ui) {
    this.cleanup();
    this.processedAnimationIds = new Set();
    
    if (this.role === 'host') {
      this.wrapHostEngine(engine);
      this.startHostPolling(engine);
    } else if (this.role === 'guest') {
      this.wrapGuestEngine(engine);
      this.startGuestPolling(engine, ui);
    }
  }

  // Wrapper for Host: runs actions locally, then uploads state
  wrapHostEngine(engine) {
    engine.isMultiplayer = true;

    const originalPlayCard = engine.playCard.bind(engine);
    engine.playCard = (playerId, cardInstanceId) => {
      const res = originalPlayCard(playerId, cardInstanceId);
      if (res) this.broadcastState(engine);
      return res;
    };

    const originalDrawCard = engine.drawCard.bind(engine);
    engine.drawCard = (playerId, log) => {
      const res = originalDrawCard(playerId, log);
      if (res) this.broadcastState(engine);
      return res;
    };

    const originalEndTurn = engine.endTurn.bind(engine);
    engine.endTurn = () => {
      originalEndTurn();
      this.broadcastState(engine);
    };

    const originalResolvePendingSpell = engine.resolvePendingSpell.bind(engine);
    engine.resolvePendingSpell = (selectedIds) => {
      originalResolvePendingSpell(selectedIds);
      this.broadcastState(engine);
    };

    const originalSolveAdventure = engine.solveAdventure.bind(engine);
    engine.solveAdventure = (playerId, instanceId) => {
      originalSolveAdventure(playerId, instanceId);
      this.broadcastState(engine);
    };

    const originalActivateCharacterAbility = engine.activateCharacterAbility.bind(engine);
    engine.activateCharacterAbility = (playerId, characterInstanceId) => {
      originalActivateCharacterAbility(playerId, characterInstanceId);
      this.broadcastState(engine);
    };

    const originalCancelPendingSpell = engine.cancelPendingSpell.bind(engine);
    engine.cancelPendingSpell = (playerId) => {
      originalCancelPendingSpell(playerId);
      this.broadcastState(engine);
    };

    const originalResolveSpell = engine.resolveSpell.bind(engine);
    engine.resolveSpell = (casterId, card) => {
      originalResolveSpell(casterId, card);
      this.broadcastState(engine);
    };

    const originalDebugDealCreatureDamage = engine.debugDealCreatureDamage.bind(engine);
    engine.debugDealCreatureDamage = (playerId = 'player') => {
      originalDebugDealCreatureDamage(playerId);
      this.broadcastState(engine);
    };

    const originalDealDamage = engine.dealDamage.bind(engine);
    engine.dealDamage = (playerId, amount, source) => {
      originalDealDamage(playerId, amount, source);
      this.broadcastState(engine);
    };

    const originalEnableUnlimitedActions = engine.enableUnlimitedActions.bind(engine);
    engine.enableUnlimitedActions = () => {
      originalEnableUnlimitedActions();
      this.broadcastState(engine);
    };

    const originalDisableUnlimitedActions = engine.disableUnlimitedActions.bind(engine);
    engine.disableUnlimitedActions = () => {
      originalDisableUnlimitedActions();
      this.broadcastState(engine);
    };

    const originalDebugShuffleDeck = engine.debugShuffleDeck.bind(engine);
    engine.debugShuffleDeck = (playerId = 'player') => {
      originalDebugShuffleDeck(playerId);
      this.broadcastState(engine);
    };

    const originalDebugEnableLessons = engine.debugEnableLessons.bind(engine);
    engine.debugEnableLessons = () => {
      originalDebugEnableLessons();
      this.broadcastState(engine);
    };

    const originalDebugDisableLessons = engine.debugDisableLessons.bind(engine);
    engine.debugDisableLessons = () => {
      originalDebugDisableLessons();
      this.broadcastState(engine);
    };

    const originalDebugMoveCard = engine.debugMoveCard.bind(engine);
    engine.debugMoveCard = (playerId, instanceId, sourceZone, targetZone) => {
      originalDebugMoveCard(playerId, instanceId, sourceZone, targetZone);
      this.broadcastState(engine);
    };

    const originalDebugSolveAdventure = engine.debugSolveAdventure.bind(engine);
    engine.debugSolveAdventure = (playerId, adventureInstanceId) => {
      originalDebugSolveAdventure(playerId, adventureInstanceId);
      this.broadcastState(engine);
    };

    const originalDebugWinMatch = engine.debugWinMatch.bind(engine);
    engine.debugWinMatch = (winnerId, instanceId) => {
      originalDebugWinMatch(winnerId, instanceId);
      this.broadcastState(engine);
    };

    const originalDamageCreature = engine.damageCreature.bind(engine);
    engine.damageCreature = (ownerId, creatureInstanceId, amount) => {
      originalDamageCreature(ownerId, creatureInstanceId, amount);
      this.broadcastState(engine);
    };

    engine.pendingAnimations = [];

    if (engine.onSpellPlayedCallback) {
      const orig = engine.onSpellPlayedCallback;
      engine.onSpellPlayedCallback = (card, playerId) => {
        if (!engine.pendingAnimations) engine.pendingAnimations = [];
        engine.pendingAnimations.push({
          id: Math.random().toString(36).substr(2, 9),
          type: 'spell',
          card,
          playerId
        });
        this.broadcastState(engine);
        orig(card, playerId);
      };
    }

    if (engine.onShuffleCallback) {
      const orig = engine.onShuffleCallback;
      engine.onShuffleCallback = (playerId) => {
        if (!engine.pendingAnimations) engine.pendingAnimations = [];
        engine.pendingAnimations.push({
          id: Math.random().toString(36).substr(2, 9),
          type: 'shuffle',
          playerId
        });
        this.broadcastState(engine);
        orig(playerId);
      };
    }

    if (engine.onDamageTakenCallback) {
      const orig = engine.onDamageTakenCallback;
      engine.onDamageTakenCallback = (playerId, amount) => {
        if (!engine.pendingAnimations) engine.pendingAnimations = [];
        engine.pendingAnimations.push({
          id: Math.random().toString(36).substr(2, 9),
          type: 'damage',
          playerId,
          amount
        });
        this.broadcastState(engine);
        orig(playerId, amount);
      };
    }

    if (engine.onAdventureSolvedCallback) {
      const orig = engine.onAdventureSolvedCallback;
      engine.onAdventureSolvedCallback = (adventure, rewardDescription, solverId) => {
        if (!engine.pendingAnimations) engine.pendingAnimations = [];
        engine.pendingAnimations.push({
          id: Math.random().toString(36).substr(2, 9),
          type: 'adventureSolved',
          adventure,
          rewardDescription,
          solverId
        });
        this.broadcastState(engine);
        orig(adventure, rewardDescription, solverId);
      };
    }

    if (engine.onMatchWonCallback) {
      const orig = engine.onMatchWonCallback;
      engine.onMatchWonCallback = (winnerId, matchCard) => {
        if (!engine.pendingAnimations) engine.pendingAnimations = [];
        engine.pendingAnimations.push({
          id: Math.random().toString(36).substr(2, 9),
          type: 'matchWon',
          winnerId,
          matchCard
        });
        this.broadcastState(engine);
        orig(winnerId, matchCard);
      };
    }
  }

  // Wrapper for Guest: intercepts actions, forwards to server, skips local execution
  wrapGuestEngine(engine) {
    engine.isMultiplayer = true;

    engine.playCard = (playerId, cardInstanceId) => {
      if (engine.activePlayerId !== 'player') return false;
      if (!engine.canPlayCard('player', cardInstanceId)) {
        return false;
      }
      this.postAction({ type: 'playCard', cardInstanceId });
      return true;
    };

    engine.drawCard = (playerId, log) => {
      if (engine.activePlayerId !== 'player') return false;
      this.postAction({ type: 'drawCard', playerId: 'player' });
      return true;
    };

    engine.endTurn = () => {
      if (engine.activePlayerId !== 'player') return false;
      this.postAction({ type: 'endTurn' });
      return true;
    };

    engine.resolvePendingSpell = (selectedIds) => {
      if (!engine.pendingSpell || engine.pendingSpell.casterId !== 'player') return;
      this.postAction({ type: 'resolveSpell', selectedIds });
      engine.pendingSpell = null;
      engine.notifyStateChange();
    };

    engine.solveAdventure = (playerId, instanceId) => {
      if (engine.activePlayerId !== 'player') return false;
      this.postAction({ type: 'solveAdventure', playerId: 'player', instanceId });
      return true;
    };

    engine.activateCharacterAbility = (playerId, characterInstanceId) => {
      if (engine.activePlayerId !== 'player') return false;
      this.postAction({ type: 'activateCharacterAbility', playerId: 'player', characterInstanceId });
      return true;
    };

    engine.cancelPendingSpell = (playerId) => {
      if (!engine.pendingSpell || engine.pendingSpell.casterId !== 'player') return;
      this.postAction({ type: 'cancelSpell', playerId: 'player' });
      engine.pendingSpell = null;
      engine.notifyStateChange();
    };

    engine.debugDealCreatureDamage = () => {
      this.postAction({ type: 'debugDealCreatureDamage' });
    };

    engine.dealDamage = (playerId, amount, source) => {
      const mappedPlayerId = playerId === 'player' ? 'opponent' : 'player';
      this.postAction({ type: 'dealDamage', playerId: mappedPlayerId, amount, source });
    };

    engine.enableUnlimitedActions = () => {
      this.postAction({ type: 'enableUnlimitedActions' });
    };

    engine.disableUnlimitedActions = () => {
      this.postAction({ type: 'disableUnlimitedActions' });
    };

    engine.debugShuffleDeck = (playerId = 'player') => {
      const mappedPlayerId = playerId === 'player' ? 'opponent' : 'player';
      this.postAction({ type: 'debugShuffleDeck', playerId: mappedPlayerId });
    };

    engine.debugEnableLessons = () => {
      this.postAction({ type: 'debugEnableLessons' });
    };

    engine.debugDisableLessons = () => {
      this.postAction({ type: 'debugDisableLessons' });
    };

    engine.debugMoveCard = (playerId, instanceId, sourceZone, targetZone) => {
      const mappedPlayerId = playerId === 'player' ? 'opponent' : 'player';
      this.postAction({ type: 'debugMoveCard', playerId: mappedPlayerId, instanceId, sourceZone, targetZone });
    };

    engine.debugSolveAdventure = (playerId, adventureInstanceId) => {
      const mappedPlayerId = playerId === 'player' ? 'opponent' : 'player';
      this.postAction({ type: 'debugSolveAdventure', playerId: mappedPlayerId, adventureInstanceId });
    };

    engine.debugWinMatch = (winnerId, instanceId) => {
      const mappedWinnerId = winnerId === 'player' ? 'opponent' : 'player';
      this.postAction({ type: 'debugWinMatch', winnerId: mappedWinnerId, instanceId });
    };

    engine.damageCreature = (ownerId, creatureInstanceId, amount) => {
      const mappedOwnerId = ownerId === 'player' ? 'opponent' : 'player';
      this.postAction({ type: 'damageCreature', ownerId: mappedOwnerId, creatureInstanceId, amount });
    };
  }

  // Net posting helper
  async postState(state) {
    try {
      await fetch(`${this.serverUrl}/api/game/${this.gameId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameState: state })
      });
    } catch (e) {
      console.error("Failed to post state", e);
    }
  }

  async postAction(action) {
    try {
      await fetch(`${this.serverUrl}/api/game/${this.gameId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
    } catch (e) {
      console.error("Failed to post action", e);
    }
  }

  broadcastState(engine) {
    const state = serializeEngine(engine);
    this.postState(state);
  }

  // Polling loops
  startHostPolling(engine) {
    if (this.actionPollInterval) clearInterval(this.actionPollInterval);
    this.actionPollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${this.serverUrl}/api/game/${this.gameId}/action`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.actions && data.actions.length > 0) {
          for (const action of data.actions) {
            this.processGuestAction(engine, action);
          }
        }
      } catch (err) {
        console.error("Host failed to poll guest actions:", err);
      }
    }, 300);
  }

  processGuestAction(engine, action) {
    console.log("Host processing guest action:", action);
    // Guest actions mapped from perspective of Host: Guest is 'opponent'
    if (action.type === 'playCard') {
      engine.playCard('opponent', action.cardInstanceId);
    } else if (action.type === 'drawCard') {
      engine.drawCard('opponent', true);
    } else if (action.type === 'endTurn') {
      engine.endTurn();
    } else if (action.type === 'resolveSpell') {
      engine.resolvePendingSpell(action.selectedIds);
    } else if (action.type === 'solveAdventure') {
      engine.solveAdventure('opponent', action.instanceId);
    } else if (action.type === 'activateCharacterAbility') {
      engine.activateCharacterAbility('opponent', action.characterInstanceId);
    } else if (action.type === 'cancelSpell') {
      engine.cancelPendingSpell('opponent');
    } else if (action.type === 'debugDealCreatureDamage') {
      engine.debugDealCreatureDamage('opponent');
    } else if (action.type === 'dealDamage') {
      engine.dealDamage(action.playerId, action.amount, action.source);
    } else if (action.type === 'enableUnlimitedActions') {
      engine.enableUnlimitedActions();
    } else if (action.type === 'disableUnlimitedActions') {
      engine.disableUnlimitedActions();
    } else if (action.type === 'debugShuffleDeck') {
      engine.debugShuffleDeck(action.playerId);
    } else if (action.type === 'debugEnableLessons') {
      engine.debugEnableLessons();
    } else if (action.type === 'debugDisableLessons') {
      engine.debugDisableLessons();
    } else if (action.type === 'debugMoveCard') {
      engine.debugMoveCard(action.playerId, action.instanceId, action.sourceZone, action.targetZone);
    } else if (action.type === 'debugSolveAdventure') {
      engine.debugSolveAdventure(action.playerId, action.adventureInstanceId);
    } else if (action.type === 'debugWinMatch') {
      engine.debugWinMatch(action.winnerId, action.instanceId);
    } else if (action.type === 'damageCreature') {
      engine.damageCreature(action.ownerId, action.creatureInstanceId, action.amount);
    }
  }

  startGuestPolling(engine, ui) {
    if (this.statePollInterval) clearInterval(this.statePollInterval);
    this.lastStateJson = null;
    this.statePollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${this.serverUrl}/api/game/${this.gameId}/state`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.gameState) {
          const stateStr = JSON.stringify(data.gameState);
          if (stateStr !== this.lastStateJson) {
            this.lastStateJson = stateStr;
            loadEngineState(engine, data.gameState, true);
          }
          
          if (data.gameState.pendingAnimations) {
            const isFirstPoll = (this.processedAnimationIds.size === 0);
            data.gameState.pendingAnimations.forEach(anim => {
              if (!this.processedAnimationIds.has(anim.id)) {
                this.processedAnimationIds.add(anim.id);
                if (!isFirstPoll) {
                  this.triggerAnimationOnGuest(anim, ui);
                }
              }
            });
          }
        }
      } catch (err) {
        console.error("Guest failed to poll game state:", err);
      }
    }, 300);
  }

  triggerAnimationOnGuest(anim, ui) {
    let playerId = anim.playerId;
    if (playerId) {
      playerId = playerId === 'player' ? 'opponent' : 'player';
    }
    
    switch (anim.type) {
      case 'damage':
        ui.triggerDeckDamageAnimation(playerId, anim.amount);
        break;
      case 'spell':
        ui.showSpellCastZoom(anim.card, playerId);
        break;
      case 'shuffle':
        ui.triggerShuffleAnnouncement(playerId);
        break;
      case 'adventureSolved': {
        let solverId = anim.solverId;
        if (solverId) {
          solverId = solverId === 'player' ? 'opponent' : 'player';
        }
        ui.showAdventureSolvedModal(anim.adventure, anim.rewardDescription, solverId);
        break;
      }
      case 'matchWon': {
        let wId = anim.winnerId;
        if (wId) {
          wId = wId === 'player' ? 'opponent' : 'player';
        }
        ui.showMatchWonModal(wId, anim.matchCard);
        break;
      }
    }
  }

  cleanup() {
    if (this.actionPollInterval) {
      clearInterval(this.actionPollInterval);
      this.actionPollInterval = null;
    }
    if (this.statePollInterval) {
      clearInterval(this.statePollInterval);
      this.statePollInterval = null;
    }
    this.lastStateJson = null;
    this.stopLobbyPolling();
  }
}

// Serialization/Deserialization utilities
function serializeEngine(engine) {
  return {
    activePlayerId: engine.activePlayerId,
    actionsRemaining: engine.actionsRemaining,
    turnNumber: engine.turnNumber,
    gameOver: engine.gameOver,
    winnerMessage: engine.winnerMessage,
    winnerId: engine.winnerId,
    logs: engine.logs,
    pendingAnimations: engine.pendingAnimations || [],
    isDebugMode: engine.isDebugMode,
    debugUnlimitedActions: engine.debugUnlimitedActions,
    pendingSpell: engine.pendingSpell ? {
      casterId: engine.pendingSpell.casterId,
      title: engine.pendingSpell.title,
      choices: engine.pendingSpell.choices,
      minChoices: engine.pendingSpell.minChoices,
      maxChoices: engine.pendingSpell.maxChoices,
      card: engine.pendingSpell.card
    } : null,
    players: {
      player: serializePlayer(engine.players.player),
      opponent: serializePlayer(engine.players.opponent)
    }
  };
}

function serializePlayer(player) {
  if (!player) return null;
  return {
    id: player.id,
    name: player.name,
    startingCharacter: player.startingCharacter,
    _deck: player._deck,
    _hand: player._hand,
    _discardPile: player._discardPile,
    _creatures: player._creatures,
    _characters: player._characters,
    lessons: player.lessons,
    items: player.items,
    adventures: player.adventures,
    matches: player.matches,
    matchDamageDealt: player.matchDamageDealt,
    preventAllDamageNextTurn: player.preventAllDamageNextTurn,
    preventAllDamageSource: player.preventAllDamageSource,
    preventCreatureAdventureDamageNextTurn: player.preventCreatureAdventureDamageNextTurn,
    preventCreatureDamageNextTurn: player.preventCreatureDamageNextTurn,
    preventCreatureDamageSource: player.preventCreatureDamageSource,
    discardDrawsNextTurn: player.discardDrawsNextTurn,
    cantPlayCardsNextTurn: player.cantPlayCardsNextTurn,
    usedOncePerGameAbilities: player.usedOncePerGameAbilities,
    usedOncePerTurnAbilities: player.usedOncePerTurnAbilities,
    usedHarrySeekerThisTurn: player.usedHarrySeekerThisTurn,
    playedCardsThisTurnCount: player.playedCardsThisTurnCount,
    playedCardsLastTurnCount: player.playedCardsLastTurnCount,
    lessonsPlayedThisTurn: player.lessonsPlayedThisTurn,
    revealHandRestOfGame: player.revealHandRestOfGame,
    preventSpellDamageOnceThisTurn: player.preventSpellDamageOnceThisTurn,
    damageTakenThisTurn: player.damageTakenThisTurn,
    wingedKeysTargetInstanceId: player.wingedKeysTargetInstanceId,
    inDrawingInstance: player.inDrawingInstance,
    tookPeevesDamageThisInstance: player.tookPeevesDamageThisInstance,
    usedCometTwoSixtyThisTurn: player.usedCometTwoSixtyThisTurn,
    playedQuidditchSpellThisTurn: player.playedQuidditchSpellThisTurn,
    mustDrawFirstAction: player.mustDrawFirstAction
  };
}

export function loadEngineState(engine, plainState, isGuest = false) {
  if (!plainState) return;

  const hostPlayerState = plainState.players.player;
  const hostOpponentState = plainState.players.opponent;
  
  if (!engine.players.player) {
    engine.players.player = new PlayerState(
      isGuest ? hostOpponentState.id : hostPlayerState.id, 
      isGuest ? hostOpponentState.name : hostPlayerState.name, 
      isGuest ? hostOpponentState.startingCharacter : hostPlayerState.startingCharacter
    );
  }
  if (!engine.players.opponent) {
    engine.players.opponent = new PlayerState(
      isGuest ? hostPlayerState.id : hostOpponentState.id, 
      isGuest ? hostPlayerState.name : hostOpponentState.name, 
      isGuest ? hostPlayerState.startingCharacter : hostOpponentState.startingCharacter
    );
  }
  
  loadPlayerState(engine.players.player, isGuest ? hostOpponentState : hostPlayerState);
  loadPlayerState(engine.players.opponent, isGuest ? hostPlayerState : hostOpponentState);
  
  if (isGuest) {
    engine.players.player.name = 'You';
    engine.players.opponent.name = 'Hogwarts Rival';
  }
  
  if (isGuest) {
    engine.activePlayerId = plainState.activePlayerId === 'player' ? 'opponent' : 'player';
  } else {
    engine.activePlayerId = plainState.activePlayerId;
  }
  
  engine.actionsRemaining = plainState.actionsRemaining;
  engine.turnNumber = plainState.turnNumber;
  engine.isDebugMode = plainState.isDebugMode || false;
  engine.debugUnlimitedActions = plainState.debugUnlimitedActions || false;
  
  engine.players.player.debug = engine.isDebugMode;
  engine.players.opponent.debug = engine.isDebugMode;
  
  if (isGuest && plainState.logs) {
    engine.logs = plainState.logs.map(log => {
      let result = log.message || '';
      
      result = result.replace(/\bHogwarts Rival's\b/g, '__TEMP_HR_POSSESSIVE__');
      result = result.replace(/\bHogwarts Rival\b/g, '__TEMP_HR__');
      
      result = result.replace(/\byour\b/g, '__TEMP_YOUR__');
      result = result.replace(/\bYour\b/g, '__TEMP_YOUR_CAP__');
      result = result.replace(/\bYou's\b/g, '__TEMP_YOU_POSSESSIVE__');
      result = result.replace(/\byou\b/g, '__TEMP_YOU_LOWER__');
      result = result.replace(/\bYou\b/g, '__TEMP_YOU_CAP__');
      
      result = result.replace(/__TEMP_HR_POSSESSIVE__/g, 'your');
      result = result.replace(/__TEMP_HR__/g, 'you');
      
      result = result.replace(/__TEMP_YOUR__/g, "Hogwarts Rival's");
      result = result.replace(/__TEMP_YOUR_CAP__/g, "Hogwarts Rival's");
      result = result.replace(/__TEMP_YOU_POSSESSIVE__/g, "Hogwarts Rival's");
      
      result = result.replace(/__TEMP_YOU_LOWER__/g, "Hogwarts Rival");
      result = result.replace(/__TEMP_YOU_CAP__/g, "Hogwarts Rival");
      
      if (result.startsWith('you ')) {
        result = 'You ' + result.slice(4);
      } else if (result.startsWith('your ')) {
        result = 'Your ' + result.slice(5);
      }
      
      return {
        ...log,
        message: result
      };
    });
  } else {
    engine.logs = plainState.logs || [];
  }
  engine.gameOver = plainState.gameOver || false;
  engine.winnerMessage = plainState.winnerMessage || null;
  if (isGuest) {
    engine.winnerId = plainState.winnerId === 'player' ? 'opponent' : (plainState.winnerId === 'opponent' ? 'player' : plainState.winnerId);
  } else {
    engine.winnerId = plainState.winnerId || null;
  }
  engine.pendingAnimations = plainState.pendingAnimations || [];
  
  if (plainState.pendingSpell) {
    let casterId = plainState.pendingSpell.casterId;
    if (isGuest) {
      casterId = casterId === 'player' ? 'opponent' : 'player';
    }
    
    let title = plainState.pendingSpell.title || '';
    if (isGuest && title) {
      let result = title;
      
      result = result.replace(/\bHogwarts Rival's\b/g, '__TEMP_HR_POSSESSIVE__');
      result = result.replace(/\bHogwarts Rival\b/g, '__TEMP_HR__');
      
      result = result.replace(/\byour\b/g, '__TEMP_YOUR__');
      result = result.replace(/\bYour\b/g, '__TEMP_YOUR_CAP__');
      result = result.replace(/\bYou's\b/g, '__TEMP_YOU_POSSESSIVE__');
      result = result.replace(/\byou\b/g, '__TEMP_YOU_LOWER__');
      result = result.replace(/\bYou\b/g, '__TEMP_YOU_CAP__');
      
      result = result.replace(/__TEMP_HR_POSSESSIVE__/g, 'your');
      result = result.replace(/__TEMP_HR__/g, 'you');
      
      result = result.replace(/__TEMP_YOUR__/g, "Hogwarts Rival's");
      result = result.replace(/__TEMP_YOUR_CAP__/g, "Hogwarts Rival's");
      result = result.replace(/__TEMP_YOU_POSSESSIVE__/g, "Hogwarts Rival's");
      
      result = result.replace(/__TEMP_YOU_LOWER__/g, "Hogwarts Rival");
      result = result.replace(/__TEMP_YOU_CAP__/g, "Hogwarts Rival");
      
      if (result.startsWith('you ')) {
        result = 'You ' + result.slice(4);
      } else if (result.startsWith('your ')) {
        result = 'Your ' + result.slice(5);
      }
      title = result;
    }
    
    let choices = plainState.pendingSpell.choices || [];
    if (isGuest && choices.length > 0) {
      choices = choices.map(c => {
        let label = c.label || '';
        let result = label;
        
        result = result.replace(/\bHogwarts Rival's\b/g, '__TEMP_HR_POSSESSIVE__');
        result = result.replace(/\bHogwarts Rival\b/g, '__TEMP_HR__');
        
        result = result.replace(/\byour\b/g, '__TEMP_YOUR__');
        result = result.replace(/\bYour\b/g, '__TEMP_YOUR_CAP__');
        result = result.replace(/\bYou's\b/g, '__TEMP_YOU_POSSESSIVE__');
        result = result.replace(/\byou\b/g, '__TEMP_YOU_LOWER__');
        result = result.replace(/\bYou\b/g, '__TEMP_YOU_CAP__');
        
        result = result.replace(/__TEMP_HR_POSSESSIVE__/g, 'your');
        result = result.replace(/__TEMP_HR__/g, 'you');
        
        result = result.replace(/__TEMP_YOUR__/g, "Hogwarts Rival's");
        result = result.replace(/__TEMP_YOUR_CAP__/g, "Hogwarts Rival's");
        result = result.replace(/__TEMP_YOU_POSSESSIVE__/g, "Hogwarts Rival's");
        
        result = result.replace(/__TEMP_YOU_LOWER__/g, "Hogwarts Rival");
        result = result.replace(/__TEMP_YOU_CAP__/g, "Hogwarts Rival");
        
        if (result.startsWith('you ')) {
          result = 'You ' + result.slice(4);
        } else if (result.startsWith('your ')) {
          result = 'Your ' + result.slice(5);
        }
        
        // Map "You" targeting choices specifically to "Your opponent"
        if (c.id === 'opponent' && result.startsWith('Hogwarts Rival')) {
          result = result.replace('Hogwarts Rival', 'Your opponent');
        }
        
        return {
          ...c,
          label: result
        };
      });
    }
    
    engine.pendingSpell = {
      ...plainState.pendingSpell,
      casterId,
      title,
      choices
    };
  } else {
    engine.pendingSpell = null;
  }
  
  engine.notifyStateChange();
}

function loadPlayerState(player, plain) {
  if (!plain) return;
  player.id = plain.id;
  player.name = plain.name;
  player.startingCharacter = plain.startingCharacter;
  player.deck = plain._deck || plain.deck || [];
  player.hand = plain._hand || plain.hand || [];
  player.discardPile = plain._discardPile || plain.discardPile || [];
  player.creatures = plain._creatures || plain.creatures || [];
  player.characters = plain._characters || plain.characters || [];
  player.lessons = plain.lessons || [];
  player.items = plain.items || [];
  player.adventures = plain.adventures || [];
  player.matches = plain.matches || [];
  player.matchDamageDealt = plain.matchDamageDealt || 0;
  player.preventAllDamageNextTurn = plain.preventAllDamageNextTurn || false;
  player.preventAllDamageSource = plain.preventAllDamageSource || null;
  player.preventCreatureAdventureDamageNextTurn = plain.preventCreatureAdventureDamageNextTurn || false;
  player.preventCreatureDamageNextTurn = plain.preventCreatureDamageNextTurn || false;
  player.preventCreatureDamageSource = plain.preventCreatureDamageSource || null;
  player.discardDrawsNextTurn = plain.discardDrawsNextTurn || false;
  player.cantPlayCardsNextTurn = plain.cantPlayCardsNextTurn || false;
  player.usedOncePerGameAbilities = plain.usedOncePerGameAbilities || {};
  player.usedOncePerTurnAbilities = plain.usedOncePerTurnAbilities || {};
  player.usedHarrySeekerThisTurn = plain.usedHarrySeekerThisTurn || false;
  player.playedCardsThisTurnCount = plain.playedCardsThisTurnCount || 0;
  player.playedCardsLastTurnCount = plain.playedCardsLastTurnCount || 0;
  player.lessonsPlayedThisTurn = plain.lessonsPlayedThisTurn || 0;
  player.revealHandRestOfGame = plain.revealHandRestOfGame || false;
  player.preventSpellDamageOnceThisTurn = plain.preventSpellDamageOnceThisTurn || false;
  player.damageTakenThisTurn = plain.damageTakenThisTurn || 0;
  player.wingedKeysTargetInstanceId = plain.wingedKeysTargetInstanceId || null;
  player.inDrawingInstance = plain.inDrawingInstance || false;
  player.tookPeevesDamageThisInstance = plain.tookPeevesDamageThisInstance || false;
  player.usedCometTwoSixtyThisTurn = plain.usedCometTwoSixtyThisTurn || false;
  player.playedQuidditchSpellThisTurn = plain.playedQuidditchSpellThisTurn || false;
  player.mustDrawFirstAction = plain.mustDrawFirstAction || false;
}
