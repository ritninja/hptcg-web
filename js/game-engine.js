/**
 * Harry Potter TCG - Game Engine
 * Manages the state machine, turn phases, rules validation, and deck operations.
 */

export class PlayerState {
  constructor(id, name, startingCharacter) {
    this.id = id;
    this.name = name;
    this.startingCharacter = startingCharacter;
    this._debug = false;
    
    this._deck = [];
    this._hand = [];
    this._discardPile = [];
    this._creatures = [];
    this._characters = [];
    
    // Set initial values using the setters to apply the wrappers
    this.deck = [];
    this.hand = [];
    this.discardPile = [];
    this.creatures = [];
    this.characters = startingCharacter ? [startingCharacter] : [];
    
    // Zones in play
    this.lessons = [];
    this.items = [];
    this.locations = [];
    this.adventures = [];
    this.matches = [];
    this.engine = null;

    this.matchDamageDealt = 0;

    // Next-turn status flags for spell effects
    this.preventAllDamageNextTurn = false;
    this.preventAllDamageSource = null;
    this.preventCreatureAdventureDamageNextTurn = false;
    this.preventCreatureDamageNextTurn = false;
    this.preventCreatureDamageSource = null;
    this.discardDrawsNextTurn = false;
    this.cantPlayCardsNextTurn = false;
    this.cantPlaySpellsNextTurn = false;
    this.cantPlayAdventuresNextTurn = false;
    this.cantPlayItemsNextTurn = false;
    this.playedMoneyCardThisTurn = false;
    this.hospitalDormitoryPreventedThisTurn = 0;
    this.usedQuidditchCupThisTurn = false;
    this.bravadoActiveThisTurn = false;
    this.preventSpellDamageNextTurn = false;
    this.biasedCommentaryActive = false;
    this.slothGripActive = false;
    this.preventAllCreatureDamageNextTurn = false;
    this.playedAdventureThisTurn = false;
    this.usedDracoMalfoySlytherinThisTurn = false;
    
    // Adventures at Hogwarts and other sets play restriction flags
    this.cantPlayLessonsNextTurn = false;
    this.fewerActionsNextTurn = 0;
    this.extraActionsNextTurn = 0;
    this.preventAllDamageNextTurn = false;
    this.preventCreatureAdventureDamageNextTurn = false;
    this.preventCreatureDamageNextTurn = false;
    this.discardDrawsNextTurn = false;

    // Character ability status tracking
    this.usedOncePerGameAbilities = {};
    this.usedOncePerTurnAbilities = {};
    this.usedHarrySeekerThisTurn = false;

    // Item and Adventure state tracking
    this.playedCardsThisTurnCount = 0;
    this.playedCardsLastTurnCount = 0;
    this.lessonsPlayedThisTurn = 0;
    this.preventStartingLessonsLimitCount = false;
    this.revealHandRestOfGame = false;
    this.preventSpellDamageOnceThisTurn = false;
    this.damageTakenThisTurn = 0;
    this.wingedKeysTargetInstanceId = null;
    this.inDrawingInstance = false;
    this.tookPeevesDamageThisInstance = false;
    
    // Quidditch state tracking
    this.playedQuidditchSpellThisTurn = false;
    this.usedCometTwoSixtyThisTurn = false;
    this._mustDrawFirstAction = false;
  }

  get debug() { return this._debug; }
  set debug(val) {
    this._debug = val;
    if (val && this._hand) {
      this.sortHandArray(this._hand);
    }
  }

  get mustDrawFirstAction() {
    return this._mustDrawFirstAction;
  }
  set mustDrawFirstAction(val) {
    this._mustDrawFirstAction = val;
  }

  get deck() { return this._deck; }
  set deck(val) {
    this._deck = val;
    this.resetDamageOnPushOrUnshift(val);
  }

  get hand() { return this._hand; }
  set hand(val) {
    if (val && this.debug) {
      this.sortHandArray(val);
    }
    this._hand = val;
    this.resetDamageOnPushOrUnshift(val);
    this.sortHandOnPushOrUnshift(val);
  }

  get discardPile() { return this._discardPile; }
  set discardPile(val) {
    this._discardPile = val;
    this.resetDamageOnPushOrUnshift(val);
  }

  get creatures() { return this._creatures; }
  set creatures(val) {
    this._creatures = val;
    this.resetDamageOnPushOrUnshift(val);
  }

  get characters() { return this._characters; }
  set characters(val) {
    if (val && this.startingCharacter) {
      const hasStarting = val.some(c => c.instanceId === this.startingCharacter.instanceId);
      if (!hasStarting) {
        val.unshift(this.startingCharacter);
      }
    }
    this._characters = val;
    this.preventStartingCharacterRemoval(val);
  }

  preventStartingCharacterRemoval(arr) {
    if (!arr) return;
    const originalSplice = arr.splice;
    arr.splice = function(start, deleteCount, ...items) {
      const itemsToDelete = arr.slice(start, start + (deleteCount !== undefined ? deleteCount : arr.length));
      const containsStartingChar = itemsToDelete.some(c => 
        c && (c.instanceId === 'player-starting-char' || c.instanceId === 'opponent-starting-char')
      );
      if (containsStartingChar) {
        console.warn("Rules Enforcement: Attempted to remove starting character from play. Blocked!");
        return [];
      }
      return originalSplice.apply(this, [start, deleteCount, ...items]);
    };
    
    const originalPop = arr.pop;
    arr.pop = function() {
      const last = arr[arr.length - 1];
      if (last && (last.instanceId === 'player-starting-char' || last.instanceId === 'opponent-starting-char')) {
        console.warn("Rules Enforcement: Attempted to pop starting character from play. Blocked!");
        return undefined;
      }
      return originalPop.apply(this);
    };
    
    const originalShift = arr.shift;
    arr.shift = function() {
      const first = arr[0];
      if (first && (first.instanceId === 'player-starting-char' || first.instanceId === 'opponent-starting-char')) {
        console.warn("Rules Enforcement: Attempted to shift starting character from play. Blocked!");
        return undefined;
      }
      return originalShift.apply(this);
    };
  }

  resetDamageOnPushOrUnshift(arr) {
    if (!arr) return;
    const originalPush = arr.push;
    arr.push = function(...items) {
      items.forEach(item => {
        if (item && typeof item === 'object') {
          delete item.damage;
        }
      });
      return originalPush.apply(this, items);
    };
    const originalUnshift = arr.unshift;
    arr.unshift = function(...items) {
      items.forEach(item => {
        if (item && typeof item === 'object') {
          delete item.damage;
        }
      });
      return originalUnshift.apply(this, items);
    };
  }

  sortHandOnPushOrUnshift(arr) {
    if (!arr) return;
    const self = this;
    const originalPush = arr.push;
    arr.push = function(...items) {
      const result = originalPush.apply(this, items);
      if (self.debug) {
        self.sortHandArray(this);
      }
      return result;
    };
    const originalUnshift = arr.unshift;
    arr.unshift = function(...items) {
      const result = originalUnshift.apply(this, items);
      if (self.debug) {
        self.sortHandArray(this);
      }
      return result;
    };
  }

  sortHandArray(arr) {
    const LESSON_ORDER = [
      'Care of Magical Creatures',
      'Charms',
      'Potions',
      'Transfiguration',
      'Quidditch'
    ];
    arr.sort((a, b) => {
      const typeA = a.lessonCost?.type || (a.type === 'Lesson' ? a.lessonType : null);
      const typeB = b.lessonCost?.type || (b.type === 'Lesson' ? b.lessonType : null);
      
      if (typeA || typeB) {
        if (!typeA) return 1;
        if (!typeB) return -1;
        
        if (typeA === typeB) {
          if (a.type !== b.type) {
            if (a.type === 'Lesson') return -1;
            if (b.type === 'Lesson') return 1;
          }
          return (a.name || '').localeCompare(b.name || '');
        }
        
        const indexA = LESSON_ORDER.indexOf(typeA);
        const indexB = LESSON_ORDER.indexOf(typeB);
        
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        
        return typeA.localeCompare(typeB);
      }
      
      // Both have no lesson type (e.g. Adventures, Characters)
      const typeOrder = ['Adventure', 'Character'];
      const classA = a.type;
      const classB = b.type;
      
      if (classA === classB) {
        return (a.name || '').localeCompare(b.name || '');
      }
      
      const idxA = typeOrder.indexOf(classA);
      const idxB = typeOrder.indexOf(classB);
      
      if (idxA !== -1 && idxB !== -1) {
        return idxA - idxB;
      }
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      
      return classA.localeCompare(classB);
    });
  }

  clearNextTurnFlags() {
    this.preventAllDamageNextTurn = false;
    this.preventAllDamageSource = null;
    this.preventCreatureAdventureDamageNextTurn = false;
    this.preventCreatureDamageNextTurn = false;
    this.preventCreatureDamageSource = null;
    this.discardDrawsNextTurn = false;
    this.cantPlayCardsNextTurn = false;
  }

  hasCharacterInPlay(name) {
    if (this.startingCharacter?.name === name) return true;
    return this.characters.some(c => c.name === name);
  }

  // Calculate available lesson points by type
  get lessonCounts() {
    const counts = {};
    let total = 0;
    
    const allInPlay = [
      ...this.lessons,
      ...this.characters,
      ...this.items,
      ...this.locations,
      ...this.adventures
    ];
    
    let hasWandShop = false;
    if (this.engine) {
      hasWandShop = this.engine.players.player.locations.some(l => l.name === 'Wand Shop') ||
                    this.engine.players.opponent.locations.some(l => l.name === 'Wand Shop');
    }
    
    allInPlay.forEach(card => {
      const type = card.provides?.type;
      let amount = card.provides?.amount || 1;
      if (type) {
        if (hasWandShop && type === 'Charms' && card.type === 'Lesson') {
          amount *= 2;
        }
        counts[type] = (counts[type] || 0) + amount;
        total += amount;
      }
    });

    return { counts, total };
  }
}

export class GameEngine {
  constructor(cardDatabase, rulesConfig) {
    this.cardDatabase = cardDatabase;
    
    // Fallback to default mechanics if rulesConfig is the rulings database or empty
    if (!rulesConfig || Array.isArray(rulesConfig) || !rulesConfig.setup) {
      this.rules = {
        setup: {
          deckSize: 60,
          startingHandSize: 7,
          startingActions: 2,
          startingCharactersCount: 1
        }
      };
      this.rulingsDatabase = Array.isArray(rulesConfig) ? rulesConfig : [];
    } else {
      this.rules = rulesConfig;
      this.rulingsDatabase = [];
    }
    
    this.players = {
      player: null,
      opponent: null
    };
    
    this.activePlayerId = 'player'; // Player always starts first locally
    this.actionsRemaining = 2;
    this.turnNumber = 1;
    this.logs = [];
    this.onStateChangeCallback = null;
    this.onSpellPlayedCallback = null;
    this.onShuffleCallback = null;
    this.onDamageTakenCallback = null;
    this.onPlayErrorCallback = null;
    this.onAdventureSolvedCallback = null;
    this.onActionErrorCallback = null;
    this.onMatchWonCallback = null;
    this.gameOver = false;
    this.winnerMessage = null;
    this.winnerId = null;
    this.pendingAnimations = [];
    this.pendingSpell = null;
    this.isMultiplayer = false;
  }

  // Subscribe UI to state changes
  onStateChange(callback) {
    this.onStateChangeCallback = callback;
  }

  // Subscribe UI to spell play events
  onSpellPlayed(callback) {
    this.onSpellPlayedCallback = callback;
  }

  // Subscribe UI to shuffle events
  onShuffle(callback) {
    this.onShuffleCallback = callback;
  }

  // Subscribe UI to damage taken events
  onDamageTaken(callback) {
    this.onDamageTakenCallback = callback;
  }

  // Subscribe UI to play error events
  onPlayError(callback) {
    this.onPlayErrorCallback = callback;
  }

  // Subscribe UI to adventure solved events
  onAdventureSolved(callback) {
    this.onAdventureSolvedCallback = callback;
  }

  // Subscribe UI to match won events
  onMatchWon(callback) {
    this.onMatchWonCallback = callback;
  }

  // Subscribe UI to illegal action error events
  onActionError(callback) {
    this.onActionErrorCallback = callback;
  }

  notifyStateChange() {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback();
    }
  }

  log(message, type = 'action') {
    this.logs.push({
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    });
    this.notifyStateChange();
  }

  logPlayError(playerId, message) {
    this.log(message, 'error');
    if (this.onPlayErrorCallback) {
      this.onPlayErrorCallback(message, playerId);
    }
  }

  logActionError(playerId, message) {
    this.log(message, 'error');
    if (this.onActionErrorCallback) {
      this.onActionErrorCallback(message, playerId);
    }
  }

  // Setup game with chosen decks
  setupGame(playerDeckIds, opponentDeckIds, playerCharId, opponentCharId, isDebugMode = false, startingPlayerId = 'player') {
    this.isSettingUpGame = true;
    this.isDebugMode = isDebugMode;
    this.debugUnlimitedActions = isDebugMode;
    this.activePlayerId = startingPlayerId;
    const pCharRaw = this.cardDatabase.find(c => c.id === playerCharId);
    const oCharRaw = this.cardDatabase.find(c => c.id === opponentCharId);
    const pChar = pCharRaw ? { ...pCharRaw, instanceId: 'player-starting-char' } : null;
    const oChar = oCharRaw ? { ...oCharRaw, instanceId: 'opponent-starting-char' } : null;

    this.players.player = new PlayerState('player', 'You', pChar);
    this.players.player.engine = this;
    this.players.opponent = new PlayerState('opponent', 'Hogwarts Rival', oChar);
    this.players.opponent.engine = this;
    this.players.player.debug = isDebugMode;
    this.players.opponent.debug = isDebugMode;

    this.gameOver = false;
    this.winnerMessage = null;
    this.winnerId = null;
    this.pendingAnimations = [];
    this.pendingSpell = null;

    // Build Decks (ignoring starting character which is already in play)
    this.players.player.deck = playerDeckIds
      .map(id => ({ ...this.cardDatabase.find(c => c.id === id), instanceId: Math.random().toString(36).substr(2, 9) }))
      .filter(c => c.id && c.id !== playerCharId);
      
    this.players.opponent.deck = opponentDeckIds
      .map(id => ({ ...this.cardDatabase.find(c => c.id === id), instanceId: Math.random().toString(36).substr(2, 9) }))
      .filter(c => c.id && c.id !== opponentCharId);

    // Shuffle
    this.shuffle(this.players.player.deck);
    this.shuffle(this.players.opponent.deck);

    if (this.isDebugMode) {
      // 1. Spawning lessons in play for player and opponent (10 of each type each)
      const lessonTypesToSpawn = ['Care of Magical Creatures', 'Potions', 'Transfiguration', 'Charms', 'Quidditch'];
      lessonTypesToSpawn.forEach(lType => {
        const proto = this.cardDatabase.find(c => c.type === 'Lesson' && c.lessonType === lType);
        if (proto) {
          for (let i = 0; i < 10; i++) {
            this.players.player.lessons.push({
              ...proto,
              instanceId: `debug-lesson-${lType.replace(/\s+/g, '-')}-${i}`
            });
            this.players.opponent.lessons.push({
              ...proto,
              instanceId: `debug-lesson-opponent-${lType.replace(/\s+/g, '-')}-${i}`
            });
          }
        }
      });

      // 2. Put all non-lesson cards in player's deck into player's hand, leaving only lessons in deck
      const pNonLessons = this.players.player.deck.filter(c => c.type !== 'Lesson');
      const pLessonsOnly = this.players.player.deck.filter(c => c.type === 'Lesson');

      this.players.player.hand = pNonLessons;
      this.players.player.deck = pLessonsOnly;

      // 3. Put all non-lesson cards in opponent's deck into opponent's hand, leaving only lessons in deck
      const oNonLessons = this.players.opponent.deck.filter(c => c.type !== 'Lesson');
      const oLessonsOnly = this.players.opponent.deck.filter(c => c.type === 'Lesson');

      this.players.opponent.hand = oNonLessons;
      this.players.opponent.deck = oLessonsOnly;

    } else {
      // Normal game setup
      const pHandModifier = pChar?.effects?.handSizeModifier || 0;
      const oHandModifier = oChar?.effects?.handSizeModifier || 0;
      const pStartHand = this.rules.setup.startingHandSize + pHandModifier;
      const oStartHand = this.rules.setup.startingHandSize + oHandModifier;

      // Draw starting hands
      this.drawCards('player', pStartHand, false);
      this.drawCards('opponent', oStartHand, false);

      // Start of first turn draw for the active player
      this.drawCard(this.activePlayerId, false);
    }

    this.actionsRemaining = this.rules.setup.startingActions;
    if (this.isDebugMode && this.debugUnlimitedActions) {
      this.actionsRemaining = 99;
    }
    this.log('Game initialized! Shuffling decks and drawing starting hands.', 'turn');
    this.isSettingUpGame = false;
    this.notifyStateChange();
  }

  // Shuffle Utility
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }

    let targetPlayerId = null;
    if (this.players.player && array === this.players.player.deck) {
      targetPlayerId = 'player';
    } else if (this.players.opponent && array === this.players.opponent.deck) {
      targetPlayerId = 'opponent';
    }

    if (targetPlayerId && this.onShuffleCallback && !this.isSettingUpGame) {
      this.onShuffleCallback(targetPlayerId);
    }
  }

  // Draw multiple cards as a single drawing instance
  drawCards(playerId, count, costAction = false) {
    const player = this.players[playerId];
    const wasInInstance = player.inDrawingInstance;
    player.inDrawingInstance = true;
    if (!wasInInstance) {
      player.tookPeevesDamageThisInstance = false;
    }
    try {
      if (costAction) {
        return this.drawCard(playerId, true);
      } else {
        let success = true;
        for (let i = 0; i < count; i++) {
          if (!this.drawCard(playerId, false)) {
            success = false;
          }
        }
        return success;
      }
    } finally {
      if (!wasInInstance) {
        player.inDrawingInstance = false;
        player.tookPeevesDamageThisInstance = false;
      }
    }
  }

  canDrawCard(playerId, costAction = false) {
    if (this.gameOver) return false;
    const player = this.players[playerId];
    
    if (costAction) {
      const hasDiagonAlley = player.adventures.some(a => a.name === 'Diagon Alley');
      if (hasDiagonAlley) {
        this.logActionError(playerId, `Cannot draw cards as an Action: Diagon Alley is active!`);
        return false;
      }
      const hasSnapesBias = player.adventures.some(a => a.name === "Snape's Bias");
      if (hasSnapesBias) {
        this.logActionError(playerId, `Cannot draw cards as an Action: Snape's Bias is active!`);
        return false;
      }
      if (this.actionsRemaining < 1) {
        this.logActionError(playerId, 'Not enough actions to draw a card.');
        return false;
      }
    }
    return true;
  }

  // Draw card from deck to hand
  drawCard(playerId, costAction = false) {
    const player = this.players[playerId];
    
    if (costAction) {
      if (!this.canDrawCard(playerId, costAction)) {
        return false;
      }
      this.actionsRemaining--;
      player.mustDrawFirstAction = false;
    }

    const isOuterInstance = !player.inDrawingInstance;
    if (isOuterInstance) {
      player.inDrawingInstance = true;
      player.tookPeevesDamageThisInstance = false;
    }

    try {
      let drawCount = 1;
      if (costAction && player.characters.some(c => c.name === 'Harry Potter')) {
        drawCount = 2;
        this.log(`Harry Potter: Drawing 2 cards instead of 1.`);
      }

      for (let d = 0; d < drawCount; d++) {
        if (player.deck.length === 0) {
          this.log(`${player.name} has no cards left to draw!`, 'damage');
          this.checkWinConditions();
          break;
        }
        const card = player.deck.pop();
        if (player.discardDrawsNextTurn) {
          player.discardPile.push(card);
          this.log(`${player.name} drew ${card.name} but discarded it immediately due to Snuffling Potion!`, 'damage');
        } else {
          player.hand.push(card);
        }
      }
      
      if (costAction) {
        this.log(`${player.name} drew ${drawCount} card(s). (${this.actionsRemaining} action(s) left)`);
        this.notifyStateChange();
      }

      // Peeves Causes Trouble check
      const hasPeeves = player.adventures.some(a => a.name === 'Peeves Causes Trouble');
      if (hasPeeves && !player.tookPeevesDamageThisInstance) {
        player.tookPeevesDamageThisInstance = true;
        this.log(`Peeves Causes Trouble: Draw triggers 1 damage to ${player.name}.`);
        this.dealDamage(playerId, 1, 'adventure');
      }

      return true;
    } finally {
      if (isOuterInstance) {
        player.inDrawingInstance = false;
        player.tookPeevesDamageThisInstance = false;
      }
    }
  }

  canPlayCard(playerId, cardInstanceId) {
    if (this.activePlayerId !== playerId) {
      this.logPlayError(playerId, 'It is not your turn!');
      return false;
    }

    const player = this.players[playerId];
    if (player.cantPlayCardsNextTurn) {
      this.logPlayError(playerId, `Cannot play cards this turn (Forgetfulness Potion is active)!`);
      return false;
    }
    // Letters From No One restriction: solver can only use actions to draw cards
    if (player.adventures.some(a => a.name === 'Letters From No One')) {
      this.logPlayError(playerId, `Cannot play cards: Letters From No One is active! You can only use actions to draw cards.`);
      return false;
    }
    const cardIndex = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    
    if (cardIndex === -1) return false;
    const card = player.hand[cardIndex];

    if (player.cantPlayItemsNextTurn && (card.type === 'Item' || card.type?.includes('Item'))) {
      this.logPlayError(playerId, `Cannot play Item cards this turn (Swelling Potion is active)!`);
      return false;
    }

    // Uniqueness rule check for characters and creatures
    const isUnique = card.subTypes && card.subTypes.includes('Unique');
    if (isUnique && (card.type === 'Character' || card.type === 'Creature')) {
      const allInPlay = [
        ...this.players.player.characters,
        ...this.players.opponent.characters,
        ...this.players.player.creatures,
        ...this.players.opponent.creatures
      ];
      const alreadyInPlay = allInPlay.some(c => c.name === card.name);
      if (alreadyInPlay) {
        this.logPlayError(playerId, `Cannot play ${card.name}: A Unique copy is already in play!`);
        return false;
      }
    }

    // Action Cost Calculation
    let actionCost = 1;
    if (card.type === 'Character') {
      if (player.characters.some(c => c.name === card.name)) {
        this.logPlayError(playerId, `Cannot play ${card.name} - you already have this Character in play!`);
        return false;
      }
      const hasRon = player.characters.some(c => c.name === 'Ron Weasley');
      const isLeakyCauldronActive = this.players.player.locations.some(l => l.name === 'The Leaky Cauldron') ||
                                    this.players.opponent.locations.some(l => l.name === 'The Leaky Cauldron');
      actionCost = (hasRon || isLeakyCauldronActive) ? 1 : 2;
    }
    if (card.type === 'Adventure') {
      const hasFredGeorge = player.characters.some(c => c.name === 'Fred & George Weasley');
      actionCost = hasFredGeorge ? 1 : 2;
    } else if (card.type === 'Spell' && card.lessonCost?.type === 'Quidditch' && player.adventures.some(a => a.name === 'Flying Practice')) {
      actionCost = 2;
    }

    if (this.actionsRemaining < actionCost) {
      this.logPlayError(playerId, `Not enough actions! Requires ${actionCost} action(s) (you have ${this.actionsRemaining}).`);
      return false;
    }

    // Adventure restrictions active on the player (victim of the Adventure)
    const activeAdventures = player.adventures;

    // Pep Talk first action check
    if (player.mustDrawFirstAction) {
      this.logPlayError(playerId, `Pep Talk: You must use your first action of this turn to draw a card!`);
      return false;
    }

    // In the Stands: Can't play Creature cards
    const hasInStands = activeAdventures.some(a => a.name === 'In the Stands');
    if (hasInStands && card.type === 'Creature') {
      this.logPlayError(playerId, `Cannot play Creature cards while In the Stands is active!`);
      return false;
    }

    // 4 Privet Drive: Can't play Spell cards
    const hasPrivetDrive = activeAdventures.some(a => a.name === '4 Privet Drive');
    if (hasPrivetDrive && card.type === 'Spell') {
      this.logPlayError(playerId, `Cannot play Spell cards while 4 Privet Drive is active!`);
      return false;
    }

    // Through the Arch: Can't play Spell cards
    const hasThroughArch = activeAdventures.some(a => a.name === 'Through the Arch');
    if (hasThroughArch && card.type === 'Spell') {
      this.logPlayError(playerId, `Cannot play Spell cards while Through the Arch is active!`);
      return false;
    }

    // Hiding From Snape: Can't play Item cards
    const hasHidingFromSnape = activeAdventures.some(a => a.name === 'Hiding From Snape');
    if (hasHidingFromSnape && card.type === 'Item') {
      this.logPlayError(playerId, `Cannot play Item cards while Hiding From Snape is active!`);
      return false;
    }

    // Human Chess Game: Can play cards only if opponent played 1 or more cards during their previous turn
    const hasHumanChessGame = activeAdventures.some(a => a.name === 'Human Chess Game');
    if (hasHumanChessGame) {
      const opponent = this.players[playerId === 'player' ? 'opponent' : 'player'];
      if (opponent.playedCardsLastTurnCount === 0) {
        this.logPlayError(playerId, `Cannot play cards: Human Chess Game is active and opponent played 0 cards in their last turn!`);
        return false;
      }
    }

    // Reptile House: Can't play more than 1 Lesson card per turn
    const hasReptileHouse = activeAdventures.some(a => a.name === 'Reptile House');
    if (hasReptileHouse && card.type === 'Lesson' && player.lessonsPlayedThisTurn >= 1) {
      this.logPlayError(playerId, `Cannot play Lesson card: Reptile House limits you to 1 Lesson card per turn!`);
      return false;
    }

    // Only one Match card can be in play at a time
    if (card.type === 'Match') {
      const activeMatch = this.players.player.matches.length > 0 || this.players.opponent.matches.length > 0;
      if (activeMatch) {
        this.logPlayError(playerId, `Cannot play Match: There is already a Match card in play!`);
        return false;
      }
    }

    if (player.cantPlaySpellsNextTurn && card.type === 'Spell') {
      this.logPlayError(playerId, `Cannot play Spell card: Spell cast restrictions are active this turn!`);
      return false;
    }

    if (player.cantPlayLessonsNextTurn && card.type === 'Lesson') {
      this.logPlayError(playerId, `Cannot play Lesson card: Lesson play restrictions are active this turn!`);
      return false;
    }

    if (player.cantPlayAdventuresNextTurn && card.type === 'Adventure') {
      this.logPlayError(playerId, `Cannot play Adventure card: Adventure play restrictions are active this turn (Sleeping Potion)!`);
      return false;
    }

    // Adventure play locks on active player
    if (player.adventures.some(a => a.name === 'Detention!') && card.type === 'Adventure') {
      this.logPlayError(playerId, `Cannot play Adventure card: Detention! is active!`);
      return false;
    }

    if (player.adventures.some(a => a.name === 'Finding the Platform') && card.type === 'Location') {
      this.logPlayError(playerId, `Cannot play Location card: Finding the Platform is active!`);
      return false;
    }

    const isHealing = this.isHealingCard(card);
    if (player.adventures.some(a => a.name === 'Stoat Sandwiches') && isHealing) {
      this.logPlayError(playerId, `Cannot play Healing card: Stoat Sandwiches is active!`);
      return false;
    }

    if (player.adventures.some(a => a.name === 'Voldemort Revealed') && card.type === 'Spell') {
      this.logPlayError(playerId, `Cannot play Spell card: Voldemort Revealed is active!`);
      return false;
    }

    if (player.adventures.some(a => a.name === 'Looking for Trevor') && card.type === 'Creature') {
      this.logPlayError(playerId, `Cannot play Creature card: Looking for Trevor is active!`);
      return false;
    }

    if (player.adventures.some(a => a.name === 'Running from Filch') && card.type === 'Lesson') {
      this.logPlayError(playerId, `Cannot play Lesson card: Running from Filch is active!`);
      return false;
    }

    // Money cards limit
    if (card.subTypes?.includes('Money') && player.playedMoneyCardThisTurn) {
      this.logPlayError(playerId, `Cannot play Money card: You can only play 1 Money card each turn!`);
      return false;
    }

    // Midnight Duel hand discard check
    if (player.adventures.some(a => a.name === 'Midnight Duel') && (card.type === 'Creature' || card.type === 'Spell')) {
      if (player.hand.length < 2) {
        this.logPlayError(playerId, `Midnight Duel: You must have another card in hand to discard to play a Creature or Spell!`);
        return false;
      }
    }

    // Play requirement: Lessons in play minimum thresholds
    if (card.name === 'Hut on the Rock' && player.lessons.length < 5) {
      this.logPlayError(playerId, `Cannot play Hut on the Rock: requires at least 5 Lessons in play!`);
      return false;
    }
    if (card.name === 'Meeting Fluffy' && player.lessons.length < 9) {
      this.logPlayError(playerId, `Cannot play Meeting Fluffy: requires at least 9 Lessons in play!`);
      return false;
    }
    if (card.name === 'Midnight Duel' && player.lessons.length < 5) {
      this.logPlayError(playerId, `Cannot play Midnight Duel: requires at least 5 Lessons in play!`);
      return false;
    }
    if (card.name === '5 Points from Gryffindor' && player.lessons.length < 5) {
      this.logPlayError(playerId, `Cannot play 5 Points from Gryffindor: requires at least 5 Lessons in play!`);
      return false;
    }
    if (card.name === 'Running from Filch' && player.lessons.length < 6) {
      this.logPlayError(playerId, `Cannot play Running from Filch: requires at least 6 Lessons in play!`);
      return false;
    }
    if (card.name === 'Candy Cart' && player.lessons.length < 3) {
      this.logPlayError(playerId, `Cannot play Candy Cart: requires at least 3 Lessons in play!`);
      return false;
    }

    if (card.name === 'Power Play') {
      const activeMatch = this.players.player.matches.length > 0 || this.players.opponent.matches.length > 0;
      if (!activeMatch) {
        this.logPlayError(playerId, `Cannot play Power Play: There must be a Match card in play!`);
        return false;
      }
    }

    // Special Wand play requirements
    if (card.name === 'Phoenix Feather Wand') {
      const allInPlay = [
        ...player.lessons,
        ...player.characters,
        ...player.items,
        ...player.adventures
      ];
      const hasProvider = allInPlay.some(c => c.provides && c.provides.type === 'Charms' && c.provides.amount >= 3);
      if (!hasProvider) {
        this.logPlayError(playerId, `Cannot play Phoenix Feather Wand: Requires at least one card in play that provides at least 3 Charms Power (such as a Dragon Heart Wand).`);
        return false;
      }
    }
    if (card.name === 'Dragon Heart Wand') {
      const allInPlay = [
        ...player.lessons,
        ...player.characters,
        ...player.items,
        ...player.adventures
      ];
      const hasProvider = allInPlay.some(c => c.provides && c.provides.type === 'Charms' && c.provides.amount >= 2);
      if (!hasProvider) {
        this.logPlayError(playerId, `Cannot play Dragon Heart Wand: Requires at least one card in play that provides at least 2 Charms Power (such as a Borrowed Wand).`);
        return false;
      }
    }

    // Adventure Play check: Opponent can have at most one Adventure in play on their side
    if (card.type === 'Adventure') {
      const opponent = this.players[playerId === 'player' ? 'opponent' : 'player'];
      const hasFredGeorge = player.characters.some(c => c.name === 'Fred & George Weasley');
      if (opponent.adventures.length > 0 && !hasFredGeorge) {
        this.logPlayError(playerId, `Cannot play ${card.name}: You already have an active Adventure on your opponent's side! It must be resolved by the opponent before you can play another one.`);
        return false;
      }

      // Unusual Pets play restriction check
      if (card.name === 'Unusual Pets' && opponent.creatures.length === 0) {
        this.logPlayError(playerId, `Cannot play Unusual Pets: Opponent has no Creatures in play!`);
        return false;
      }
    }

    // Lesson count requirement check
    if (card.lessonCost && card.lessonCost.total > 0) {
      let requiredTotal = card.lessonCost.total;

      // Cost reduction effects
      if (card.type === 'Spell') {
        const hasDumbledore = player.characters.some(c => c.name === 'Albus Dumbledore');
        let dumbledoreReduction = 0;
        if (hasDumbledore && player.lessons.length >= 4 && card.lessonCost.total >= 6) {
          dumbledoreReduction = 2;
        }

        const isQuidditchPitchActive = this.players.player.locations.some(l => l.name === 'Quidditch Pitch') ||
                                       this.players.opponent.locations.some(l => l.name === 'Quidditch Pitch');
        let quidditchPitchReduction = 0;
        if (isQuidditchPitchActive && card.lessonCost.type === 'Quidditch') {
          quidditchPitchReduction = 2;
        }

        requiredTotal = Math.max(1, requiredTotal - dumbledoreReduction - quidditchPitchReduction);
      }

      const total = player.lessonCounts.total;
      if (total < requiredTotal) {
        this.logPlayError(playerId, `Cannot play ${card.name}. Requires ${requiredTotal} lessons total (you have ${total}).`);
        return false;
      }

      // Lesson type checking (requires at least one lesson of each type in lessonCost)
      const counts = player.lessonCounts.counts;

      const requiredType = card.lessonCost.type;
      if (requiredType && (!counts[requiredType] || counts[requiredType] < 1)) {
        this.logPlayError(playerId, `Cannot play ${card.name}. Requires at least 1 ${requiredType} lesson.`);
        return false;
      }
    }

    if (card.playRequirements && card.playRequirements.discardLessons) {
      const dl = card.playRequirements.discardLessons;
      const matchCount = player.lessons.filter(l => {
        const lType = l.provides?.type || l.lessonType;
        if (dl.type === 'Any') return true;
        return lType === dl.type;
      }).length;

      if (matchCount < dl.count) {
        this.logPlayError(playerId, `Cannot play ${card.name}. Requires discarding ${dl.count} of your ${dl.type === 'Any' ? '' : dl.type + ' '}Lessons from play (you only have ${matchCount} available).`);
        return false;
      }
    }

    if (card.playRequirements && card.playRequirements.returnLessonsToHand) {
      const req = card.playRequirements.returnLessonsToHand;
      const matchCount = player.lessons.filter(l => {
        const lType = l.provides?.type || l.lessonType;
        return lType === req.type;
      }).length;

      if (matchCount < req.count) {
        this.logPlayError(playerId, `Cannot play ${card.name}. Requires returning ${req.count} of your ${req.type} Lessons from play to your hand (you only have ${matchCount} available).`);
        return false;
      }
    }

    return true;
  }

  // Play a card from hand to board
  playCard(playerId, cardInstanceId) {
    if (!this.canPlayCard(playerId, cardInstanceId)) {
      return false;
    }

    const player = this.players[playerId];
    const cardIndex = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    const card = player.hand[cardIndex];

    // Action Cost Calculation
    let actionCost = 1;
    if (card.type === 'Character') {
      const hasRon = player.characters.some(c => c.name === 'Ron Weasley');
      const isLeakyCauldronActive = this.players.player.locations.some(l => l.name === 'The Leaky Cauldron') ||
                                    this.players.opponent.locations.some(l => l.name === 'The Leaky Cauldron');
      actionCost = (hasRon || isLeakyCauldronActive) ? 1 : 2;
    }
    if (card.type === 'Adventure') {
      const hasFredGeorge = player.characters.some(c => c.name === 'Fred & George Weasley');
      actionCost = hasFredGeorge ? 1 : 2;
    } else if (card.type === 'Spell' && card.lessonCost?.type === 'Quidditch' && player.adventures.some(a => a.name === 'Flying Practice')) {
      actionCost = 2;
    }

    // Spend Action and discard lesson cost if any
    if (card.playRequirements && card.playRequirements.discardLessons) {
      const dl = card.playRequirements.discardLessons;
      const cardInstanceId = card.instanceId;
      const choices = player.lessons
        .filter(l => {
          const lType = l.provides?.type || l.lessonType;
          return dl.type === 'Any' || lType === dl.type;
        })
        .map(l => ({ id: `lesson-${playerId}-${l.instanceId}`, label: l.name, card: l }));

      this.promptChoice(playerId, `Discard Cost: Choose ${dl.count} Lesson(s) to discard from play`, choices, dl.count, dl.count, (selected) => {
        // Spend Action
        this.actionsRemaining -= actionCost;
        const idxInHand = player.hand.findIndex(c => c.instanceId === cardInstanceId);
        if (idxInHand !== -1) {
          player.hand.splice(idxInHand, 1);
        }

        // Discard selected lessons
        selected.forEach(selId => {
          const instId = selId.split('-').slice(2).join('-');
          const idx = player.lessons.findIndex(l => l.instanceId === instId);
          if (idx !== -1) {
            const [l] = player.lessons.splice(idx, 1);
            this.discardCardFromPlay(playerId, l);
          }
        });
        this.log(`${player.name} discarded ${dl.count} of their ${dl.type === 'Any' ? '' : dl.type + ' '}Lessons from play as a cost.`);

        this.proceedWithPlayCard(playerId, card);
      });
      return true;
    }

    // Spend Action
    this.actionsRemaining -= actionCost;
    player.hand.splice(cardIndex, 1);

    this.proceedWithPlayCard(playerId, card);
    return true;
  }

  proceedWithPlayCard(playerId, card) {
    const player = this.players[playerId];

    // Track money card play
    if (card.subTypes?.includes('Money')) {
      player.playedMoneyCardThisTurn = true;
    }

    // Midnight Duel cost check
    if (player.adventures.some(a => a.name === 'Midnight Duel') && (card.type === 'Creature' || card.type === 'Spell')) {
      if (player.hand.length > 0) {
        if (playerId === 'player' || this.isMultiplayer) {
          const choices = player.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(playerId, "Midnight Duel: Choose 1 card from hand to discard to play this card", choices, 1, 1, (selected) => {
            const sel = selected[0];
            const idx = player.hand.findIndex(c => c.instanceId === sel);
            if (idx !== -1) {
              const [c] = player.hand.splice(idx, 1);
              player.discardPile.push(c);
              this.log(`Midnight Duel: Discarded ${c.name} from hand.`);
            }
            this.executeProceedWithPlayCard(playerId, card);
          });
        } else {
          const idx = Math.floor(Math.random() * player.hand.length);
          const [c] = player.hand.splice(idx, 1);
          player.discardPile.push(c);
          this.log(`Midnight Duel: AI discarded ${c.name} from hand.`);
          this.executeProceedWithPlayCard(playerId, card);
        }
        return;
      }
    }

    this.executeProceedWithPlayCard(playerId, card);
  }
  executeProceedWithPlayCard(playerId, card) {
    const player = this.players[playerId];

    // Quidditch Cup trigger
    const hasQuidditchCup = player.items.some(i => i.name === 'Quidditch Cup');
    const isQuidditchCard = card.lessonCost?.type === 'Quidditch';
    if (hasQuidditchCup && isQuidditchCard && !player.usedQuidditchCupThisTurn) {
      player.usedQuidditchCupThisTurn = true;
      this.actionsRemaining++;
      this.log(`Quidditch Cup: Gained +1 Action for playing a Quidditch card.`);
    }

    // Resolve return lessons to hand if any
    if (card.playRequirements && card.playRequirements.returnLessonsToHand) {
      const req = card.playRequirements.returnLessonsToHand;
      let returned = 0;
      for (let i = player.lessons.length - 1; i >= 0; i--) {
        if (returned >= req.count) break;
        const l = player.lessons[i];
        const lType = l.provides?.type || l.lessonType;
        if (lType === req.type) {
          player.lessons.splice(i, 1);
          player.hand.push(l);
          returned++;
        }
      }
      this.log(`${player.name} returned ${req.count} of their ${req.type} Lessons to hand as a cost.`);
    }

    // Deploy card based on type
    switch (card.type) {
      case 'Lesson':
        player.lessons.push(card);
        player.lessonsPlayedThisTurn++;
        this.log(`${player.name} played a Lesson: ${card.name}.`);

        // Harry the Seeker draw trigger
        const hasHarrySeeker = player.characters.some(c => c.name === 'Harry the Seeker');
        if (hasHarrySeeker && card.lessonType === 'Quidditch' && !player.usedHarrySeekerThisTurn) {
          player.usedHarrySeekerThisTurn = true;
          this.log(`Harry the Seeker: Drawing a card for playing a Quidditch Lesson.`);
          this.drawCard(playerId, false);
        }
        
        // Hermione Granger passive: play second lesson for free
        const hasHermione = player.characters.some(c => c.name === 'Hermione Granger');
        if (hasHermione && player.lessons.length >= 3) {
          const handLessons = player.hand.filter(c => c.type === 'Lesson');
          if (handLessons.length > 0) {
            const choices = handLessons.map(l => ({ id: `hand-player-${l.instanceId}`, label: l.name, card: l }));
            this.promptChoice(playerId, "Hermione Granger: Choose a second Lesson to play for free (Optional)", choices, 0, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const instId = sel.split('-').slice(2).join('-');
                const idx = player.hand.findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [secLesson] = player.hand.splice(idx, 1);
                  player.lessons.push(secLesson);
                  this.log(`Hermione Granger: Played second Lesson for free: ${secLesson.name}.`);
                  this.notifyStateChange();
                }
              }
            });
          }
        }
        break;
      case 'Character':
        player.characters.push(card);
        this.log(`${player.name} played Character: ${card.name}.`);
        break;
      case 'Creature':
        player.creatures.push(card);
        this.log(`${player.name} summoned Creature: ${card.name}.`);
        if (card.name === 'Fang') {
          const oppId = playerId === 'player' ? 'opponent' : 'player';
          this.log(`Fang: Deals 4 damage to opponent on play.`);
          this.dealDamage(oppId, 4, 'creature', card);
        }
        if (card.name === 'Welsh Green Dragon') {
          const oppId = playerId === 'player' ? 'opponent' : 'player';
          this.log(`Welsh Green Dragon: Deals 6 damage to opponent on play.`);
          this.dealDamage(oppId, 6, 'creature', card);
        }
        if (card.name === 'Black Bat') {
          const oppId = playerId === 'player' ? 'opponent' : 'player';
          this.log(`Black Bat: Deals 2 damage to opponent on play.`);
          this.dealDamage(oppId, 2, 'creature', card);
        }
        if (card.name === 'Unicorn') {
          this.actionsRemaining++;
          this.log(`Unicorn: Granting 1 extra Action to ${player.name} this turn.`);
        }
        if (card.name === 'Doxy' || card.name === 'Streeler') {
          const dmg = card.name === 'Doxy' ? 2 : 1;
          const allOther = [
            ...this.players.player.creatures.filter(c => c.instanceId !== card.instanceId),
            ...this.players.opponent.creatures.filter(c => c.instanceId !== card.instanceId)
          ];
          if (allOther.length > 0) {
            if (playerId === 'player' || this.isMultiplayer) {
              const choices = allOther.map(c => ({ id: c.instanceId, label: c.name, card: c, ownerId: this.players.player.creatures.includes(c) ? 'player' : 'opponent' }));
              this.promptChoice(playerId, `${card.name}: Choose another Creature to deal ${dmg} damage to`, choices, 1, 1, (selected) => {
                const sel = selected[0];
                const found = choices.find(t => t.id === sel);
                if (found) {
                  this.damageCreature(found.ownerId, found.card.instanceId, dmg);
                  this.notifyStateChange();
                }
              }, card);
            } else {
              const pCreatures = this.players.player.creatures;
              const target = pCreatures.length > 0 ? pCreatures[0] : allOther[0];
              const owner = this.players.player.creatures.includes(target) ? 'player' : 'opponent';
              this.damageCreature(owner, target.instanceId, dmg);
              this.notifyStateChange();
            }
          } else {
            this.log(`${card.name}: No other creatures in play to damage.`);
          }
        }
        if (card.name === 'Trevor') {
          const lessons = player.discardPile.filter(c => c.type === 'Lesson');
          if (lessons.length > 0) {
            if (playerId === 'player' || this.isMultiplayer) {
              const choices = lessons.map(c => ({ id: c.instanceId, label: c.name, card: c }));
              this.promptChoice(playerId, "Trevor: Choose 1 Lesson card from your discard pile to return to hand", choices, 0, 1, (selected) => {
                const sel = selected[0];
                const idx = player.discardPile.findIndex(c => c.instanceId === sel);
                if (idx !== -1) {
                  const [lesson] = player.discardPile.splice(idx, 1);
                  player.hand.push(lesson);
                  this.log(`Trevor: Returned ${lesson.name} to hand.`);
                  this.notifyStateChange();
                }
              });
            } else {
              const [lesson] = player.discardPile.splice(player.discardPile.indexOf(lessons[0]), 1);
              player.hand.push(lesson);
              this.log(`Trevor: AI returned ${lesson.name} to hand.`);
              this.notifyStateChange();
            }
          }
        }
        
        if (card.name === 'Hedwig') {
          const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
          if (nonHealing.length > 0) {
            if (playerId === 'player' || this.isMultiplayer) {
              const choices = nonHealing.map(c => ({ id: c.instanceId, label: c.name, card: c }));
              this.promptChoice(playerId, "Hedwig: Choose a non-Healing card from discard to put into hand (Optional)", choices, 0, 1, (selected) => {
                const sel = selected[0];
                if (sel) {
                  const idx = player.discardPile.findIndex(c => c.instanceId === sel);
                  if (idx !== -1) {
                    const [retrieved] = player.discardPile.splice(idx, 1);
                    player.hand.push(retrieved);
                    this.log(`Hedwig: Put ${retrieved.name} from discard into hand.`);
                    this.notifyStateChange();
                  }
                }
              }, card);
            } else {
              const [retrieved] = player.discardPile.splice(player.discardPile.indexOf(nonHealing[0]), 1);
              player.hand.push(retrieved);
              this.log(`Hedwig: AI put ${retrieved.name} from discard into hand.`);
              this.notifyStateChange();
            }
          }
        }
        
        if (card.name === 'Barn Owl') {
          const cmcLessons = player.lessons.filter(l => (l.provides?.type || l.lessonType) === 'Care of Magical Creatures');
          const creaturesInDiscard = player.discardPile.filter(c => c.type === 'Creature');
          if (cmcLessons.length > 0 && creaturesInDiscard.length > 0) {
            if (playerId === 'player' || this.isMultiplayer) {
              const lessonChoices = cmcLessons.map(l => ({ id: `lesson-${playerId}-${l.instanceId}`, label: l.name, card: l }));
              this.promptChoice(playerId, "Barn Owl: Choose 1 Care of Magical Creatures Lesson to discard (Optional)", lessonChoices, 0, 1, (selectedLesson) => {
                const selLesson = selectedLesson[0];
                if (selLesson) {
                  const instId = selLesson.split('-').slice(2).join('-');
                  const idx = player.lessons.findIndex(l => l.instanceId === instId);
                  if (idx !== -1) {
                    const [l] = player.lessons.splice(idx, 1);
                    player.discardPile.push(l);
                    this.log(`Barn Owl: Discarded lesson ${l.name}.`);
                    
                    const creatureChoices = creaturesInDiscard.map(c => ({ id: c.instanceId, label: c.name, card: c }));
                    this.promptChoice(playerId, "Barn Owl: Choose a Creature card from discard to put into hand", creatureChoices, 1, 1, (selectedCreature) => {
                      const selCreature = selectedCreature[0];
                      if (selCreature) {
                        const cIdx = player.discardPile.findIndex(c => c.instanceId === selCreature);
                        if (cIdx !== -1) {
                          const [retrieved] = player.discardPile.splice(cIdx, 1);
                          player.hand.push(retrieved);
                          this.log(`Barn Owl: Put ${retrieved.name} from discard into hand.`);
                          this.notifyStateChange();
                        }
                      }
                    }, card);
                  }
                }
              }, card);
            } else {
              const [l] = player.lessons.splice(player.lessons.indexOf(cmcLessons[0]), 1);
              player.discardPile.push(l);
              this.log(`Barn Owl: AI discarded lesson ${l.name}.`);
              
              const [retrieved] = player.discardPile.splice(player.discardPile.indexOf(creaturesInDiscard[0]), 1);
              player.hand.push(retrieved);
              this.log(`Barn Owl: AI put ${retrieved.name} from discard into hand.`);
              this.notifyStateChange();
            }
          }
        }
        
        if (card.name === 'Screech Owl') {
          const lessons = player.discardPile.filter(c => c.type === 'Lesson');
          if (lessons.length > 0) {
            if (playerId === 'player' || this.isMultiplayer) {
              const choices = lessons.map(c => ({ id: c.instanceId, label: c.name, card: c }));
              this.promptChoice(playerId, "Screech Owl: Choose a Lesson card from discard to put into hand (Optional)", choices, 0, 1, (selected) => {
                const sel = selected[0];
                if (sel) {
                  const idx = player.discardPile.findIndex(c => c.instanceId === sel);
                  if (idx !== -1) {
                    const [retrieved] = player.discardPile.splice(idx, 1);
                    player.hand.push(retrieved);
                    this.log(`Screech Owl: Put Lesson ${retrieved.name} from discard into hand.`);
                    this.notifyStateChange();
                  }
                }
              }, card);
            } else {
              const [retrieved] = player.discardPile.splice(player.discardPile.indexOf(lessons[0]), 1);
              player.hand.push(retrieved);
              this.log(`Screech Owl: AI put Lesson ${retrieved.name} from discard into hand.`);
              this.notifyStateChange();
            }
          }
        }
        
        if (card.name === 'Tawny Owl') {
          const items = player.discardPile.filter(c => c.type === 'Item' && !c.subTypes?.includes('Healing'));
          if (items.length > 0) {
            if (playerId === 'player' || this.isMultiplayer) {
              const choices = items.map(c => ({ id: c.instanceId, label: c.name, card: c }));
              this.promptChoice(playerId, "Tawny Owl: Choose a non-Healing Item card from discard to put into hand (Optional)", choices, 0, 1, (selected) => {
                const sel = selected[0];
                if (sel) {
                  const idx = player.discardPile.findIndex(c => c.instanceId === sel);
                  if (idx !== -1) {
                    const [retrieved] = player.discardPile.splice(idx, 1);
                    player.hand.push(retrieved);
                    this.log(`Tawny Owl: Put Item ${retrieved.name} from discard into hand.`);
                    this.notifyStateChange();
                  }
                }
              }, card);
            } else {
              const [retrieved] = player.discardPile.splice(player.discardPile.indexOf(items[0]), 1);
              player.hand.push(retrieved);
              this.log(`Tawny Owl: AI put Item ${retrieved.name} from discard into hand.`);
              this.notifyStateChange();
            }
          }
        }
        break;
      case 'Item':
        if (card.subTypes && card.subTypes.some(s => s.includes('Wand'))) {
          const oldWandIndex = player.items.findIndex(i => i.subTypes && i.subTypes.some(s => s.includes('Wand')));
          if (oldWandIndex !== -1) {
            const [oldWand] = player.items.splice(oldWandIndex, 1);
            this.discardCardFromPlay(playerId, oldWand);
            this.log(`Discarded old Wand from play: ${oldWand.name}`);
          }
        }
        if (card.name === "Hagrid's Umbrella") {
          const oldWandIndex = player.items.findIndex(i => i.subTypes && i.subTypes.some(s => s.includes('Wand')));
          if (oldWandIndex !== -1) {
            const [oldWand] = player.items.splice(oldWandIndex, 1);
            this.discardCardFromPlay(playerId, oldWand);
            this.log(`Discarded old Wand from play due to Hagrid's Umbrella: ${oldWand.name}`);
          }
        }
        if (card.subTypes && card.subTypes.some(s => s.includes('Broom'))) {
          const oldBroomIndex = player.items.findIndex(i => i.subTypes && i.subTypes.some(s => s.includes('Broom')));
          if (oldBroomIndex !== -1) {
            const [oldBroom] = player.items.splice(oldBroomIndex, 1);
            this.discardCardFromPlay(playerId, oldBroom);
            this.log(`Discarded old Broom from play: ${oldBroom.name}`);
          }
        }
        player.items.push(card);
        this.log(`${player.name} played Item: ${card.name}.`);

        if (card.name === 'School Broom') {
          this.log(`School Broom: Drawing a card on play.`);
          this.drawCard(playerId, false);
        }
        
        // Draco Malfoy, Slytherin passive
        const hasDracoSlytherin = player.characters.some(c => c.name === 'Draco Malfoy, Slytherin');
        if (hasDracoSlytherin && !player.usedDracoMalfoySlytherinThisTurn) {
          player.usedDracoMalfoySlytherinThisTurn = true;
          this.actionsRemaining++;
          this.log(`Draco Malfoy, Slytherin: Gained +1 Action for playing an Item card.`);
        }

        if (card.name === 'Cleansweep Seven') {
          if (player.deck.length > 0) {
            const lookCount = Math.min(4, player.deck.length);
            const topCards = [];
            for (let i = 0; i < lookCount; i++) {
              topCards.push(player.deck.pop());
            }
            if (playerId === 'player' || this.isMultiplayer) {
              const choices = topCards.map((c, idx) => ({ id: `${idx}`, label: c.name, card: c }));
              this.promptChoice(playerId, "Cleansweep Seven: Choose order to return cards to deck (First selected will be on top)", choices, lookCount, lookCount, (selected) => {
                selected.forEach(idxStr => {
                  const cardIdx = parseInt(idxStr, 10);
                  player.deck.push(topCards[cardIdx]);
                });
                this.log(`Cleansweep Seven: Returned ${lookCount} card(s) to top of deck.`);
                this.notifyStateChange();
              }, card);
            } else {
              for (let i = lookCount - 1; i >= 0; i--) {
                player.deck.push(topCards[i]);
              }
              this.notifyStateChange();
            }
          }
        }

        if (card.name === 'Self-Stirring Cauldron') {
          this.actionsRemaining++;
          this.log(`Self-Stirring Cauldron: Gained +1 Action.`);
        }

        if (card.name === 'Silver Unicorn Horn') {
          const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
          if (nonHealing.length > 0) {
            const maxTake = Math.min(2, nonHealing.length);
            if (playerId === 'player' || this.isMultiplayer) {
              const choices = nonHealing.map(c => ({ id: c.instanceId, label: c.name, card: c }));
              this.promptChoice(playerId, "Silver Unicorn Horn: Choose up to 2 non-Healing cards from discard to put on bottom of deck", choices, 0, maxTake, (selected) => {
                selected.forEach(selId => {
                  const idx = player.discardPile.findIndex(c => c.instanceId === selId);
                  if (idx !== -1) {
                    const [retrieved] = player.discardPile.splice(idx, 1);
                    player.deck.unshift(retrieved);
                    this.log(`Silver Unicorn Horn: Put ${retrieved.name} on bottom of deck.`);
                  }
                });
                this.notifyStateChange();
              }, card);
            } else {
              const toMove = nonHealing.slice(0, maxTake);
              toMove.forEach(c => {
                player.discardPile.splice(player.discardPile.indexOf(c), 1);
                player.deck.unshift(c);
                this.log(`Silver Unicorn Horn: AI put ${c.name} on bottom of deck.`);
              });
              this.notifyStateChange();
            }
          }
        }

        if (card.name === 'Beetle Eyes') {
          const oppId = playerId === 'player' ? 'opponent' : 'player';
          this.log(`Beetle Eyes: Dealing 4 damage to opponent.`);
          this.dealDamage(oppId, 4, 'item', card);
        }

        if (card.name === 'Eel Eyes') {
          const opponent = this.players[playerId === 'player' ? 'opponent' : 'player'];
          if (playerId === 'player' || this.isMultiplayer) {
            const choices = opponent.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(playerId, `${opponent.name}'s Hand:`, choices, 1, 1, () => {}, card);
          } else {
            this.log(`Eel Eyes: AI looked at player's hand.`);
          }
        }

        if (card.name === 'Moonseed Poison') {
          const oppId = playerId === 'player' ? 'opponent' : 'player';
          this.log(`Moonseed Poison: Dealing 3 damage to opponent.`);
          this.dealDamage(oppId, 3, 'item', card);
        }
        break;
      case 'Adventure': {
        const opponent = this.players[playerId === 'player' ? 'opponent' : 'player'];
        const hasFredGeorge = player.characters.some(c => c.name === 'Fred & George Weasley');
        if (hasFredGeorge && opponent.adventures.length > 0) {
          const oldAdvs = opponent.adventures.splice(0);
          opponent.discardPile.push(...oldAdvs);
          this.log(`Fred & George Weasley: Discarded old active Adventure: ${oldAdvs.map(a => a.name).join(', ')} (no reward).`);
        }
        opponent.adventures.push(card);
        this.log(`${player.name} played Adventure: ${card.name} on ${opponent.name}'s side.`);
        player.playedAdventureThisTurn = true;
        break;
      }
      case 'Location': {
        const oldLocations = [];
        ['player', 'opponent'].forEach(pId => {
          const p = this.players[pId];
          if (p.locations.length > 0) {
            const locs = p.locations.splice(0);
            locs.forEach(loc => this.discardCardFromPlay(pId, loc));
            oldLocations.push(...locs);
          }
        });
        if (oldLocations.length > 0) {
          this.log(`Discarded old active Location(s) from play: ${oldLocations.map(l => l.name).join(', ')}.`);
        }
        player.locations.push(card);
        this.log(`${player.name} played Location: ${card.name}.`);
        
        // Gringotts immediate action count increase
        if (card.name === 'Gringotts') {
          this.actionsRemaining += 1;
          this.log(`Gringotts: Active player gets +1 Action this turn.`);
        }
        break;
      }
      case 'Match': {
        const oldMatches = [];
        ['player', 'opponent'].forEach(pId => {
          const p = this.players[pId];
          if (p.matches.length > 0) {
            const ms = p.matches.splice(0);
            p.discardPile.push(...ms);
            oldMatches.push(...ms);
          }
        });
        if (oldMatches.length > 0) {
          this.log(`Discarded old active Match(es) from play: ${oldMatches.map(m => m.name).join(', ')}.`);
        }
        // Reset match progress
        this.players.player.matchDamageDealt = 0;
        this.players.opponent.matchDamageDealt = 0;

        player.matches.push(card);
        this.log(`${player.name} played Match: ${card.name}.`);
        break;
      }
      case 'Spell':
        player.discardPile.push(card);
        this.log(`${player.name} cast Spell: ${card.name}!`);
        if (card.lessonCost && card.lessonCost.type === 'Quidditch') {
          player.playedQuidditchSpellThisTurn = true;
        }
        if (this.onSpellPlayedCallback) {
          this.onSpellPlayedCallback(card, playerId);
          setTimeout(() => {
            this.resolveSpell(playerId, card);
            this.notifyStateChange();
          }, 2000);
        } else {
          this.resolveSpell(playerId, card);
        }
        break;
    }

    player.playedCardsThisTurnCount++;
    this.notifyStateChange();
  }

  // Resolve spell effects
  resolveSpell(casterId, card) {
    this.currentlyResolvingSpell = card;
    try {
      const player = this.players[casterId];
      const opponent = this.players[casterId === 'player' ? 'opponent' : 'player'];
      const opponentId = opponent.id;
      const playerId = player.id;
      
      this.log(`${player.name} resolved spell effect of ${card.name}.`);

    switch (card.name) {
      case 'Elixir of Life': {
        const nonHealing = player.discardPile.filter(c => !this.isHealingCard(c));
        const choices = nonHealing.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        const maxTake = Math.min(16, choices.length);
        if (maxTake === 0) {
          this.log(`${player.name} resolved Elixir of Life: No non-Healing cards in discard pile.`);
          break;
        }
        this.promptChoice(casterId, `Elixir of Life: Choose up to ${maxTake} non-Healing cards to shuffle into deck`, choices, 0, maxTake, (selected) => {
          selected.forEach(instId => {
            const idx = player.discardPile.findIndex(dc => dc.instanceId === instId);
            if (idx !== -1) {
              const [c] = player.discardPile.splice(idx, 1);
              player.deck.push(c);
            }
          });
          this.shuffle(player.deck);
          this.log(`${player.name} shuffled ${selected.length} non-Healing card(s) from discard into deck.`);
          this.notifyStateChange();
        });
        break;
      }
      
      case 'Obliviate': {
        const discardedCount = opponent.hand.length;
        opponent.discardPile.push(...opponent.hand);
        opponent.hand = [];
        this.log(`${opponent.name} discarded their hand (${discardedCount} card(s)).`);
        break;
      }

      case "Dragon's Blood": {
        const choices = [{ id: 'opponent', label: `${opponent.name} (11 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 11 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 11 Damage)`, card: c }));
        this.promptChoice(casterId, "Choose target for Dragon's Blood (11 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 11, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 11);
          }
        }, card);
        break;
      }

      case 'End-of-Year Feast': {
        const advCards = player.discardPile.filter(c => c.type === 'Adventure');
        if (advCards.length === 0) {
          this.log(`No Adventure cards in discard pile.`);
          break;
        }
        const choices = advCards.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        const maxTake = Math.min(4, choices.length);
        if (casterId === 'player' || this.isMultiplayer) {
          this.promptChoice(casterId, `End-of-Year Feast: Choose up to ${maxTake} Adventure card(s) to return to hand`, choices, 0, maxTake, (selected) => {
            selected.forEach(instId => {
              const idx = player.discardPile.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.discardPile.splice(idx, 1);
                player.hand.push(c);
                this.log(`Returned ${c.name} to hand.`);
              }
            });
            this.notifyStateChange();
          }, card);
        } else {
          for (let i = 0; i < maxTake; i++) {
            const [c] = player.discardPile.splice(player.discardPile.indexOf(advCards[i]), 1);
            player.hand.push(c);
            this.log(`AI returned ${c.name} to hand.`);
          }
        }
        break;
      }

      case 'Alohomora': {
        const eligible = player.deck.filter(c => c.type === 'Location' || c.type === 'Adventure');
        if (eligible.length === 0) {
          this.log(`No Location or Adventure cards in deck.`);
          this.shuffle(player.deck);
          break;
        }
        if (casterId === 'player' || this.isMultiplayer) {
          const choices = eligible.map(c => ({ id: c.instanceId, label: `${c.name} (${c.type})`, card: c }));
          this.promptChoice(casterId, "Alohomora: Choose a Location or Adventure card to put in hand", choices, 0, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const idx = player.deck.findIndex(c => c.instanceId === sel);
              if (idx !== -1) {
                const [c] = player.deck.splice(idx, 1);
                player.hand.push(c);
                this.log(`Alohomora: Added ${c.name} to hand.`);
              }
            }
            this.shuffle(player.deck);
            this.notifyStateChange();
          }, card);
        } else {
          const [c] = player.deck.splice(player.deck.indexOf(eligible[0]), 1);
          player.hand.push(c);
          this.log(`AI added ${c.name} to hand.`);
          this.shuffle(player.deck);
        }
        break;
      }

      case 'Baneberry Potion': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (8 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 8 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 8 Damage)`, card: c }));
        this.promptChoice(casterId, "Choose target for Baneberry Potion (8 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 8, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 8);
          }
        }, card);
        break;
      }

      case 'Bludger Bop': {
        const inPlay = this.getCardsInPlay(opponentId);
        const bopHandDiscard = () => {
          if (opponent.hand.length > 0) {
            if (opponentId === 'player' || this.isMultiplayer) {
              const choices = opponent.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
              this.promptChoice(opponentId, "Bludger Bop: Choose 1 card from hand to discard", choices, 1, 1, (selected) => {
                const sel = selected[0];
                const idx = opponent.hand.findIndex(c => c.instanceId === sel);
                if (idx !== -1) {
                  const [c] = opponent.hand.splice(idx, 1);
                  opponent.discardPile.push(c);
                  this.log(`${opponent.name} discarded ${c.name} from hand.`);
                }
                this.notifyStateChange();
              }, card);
            } else {
              const idx = Math.floor(Math.random() * opponent.hand.length);
              const [c] = opponent.hand.splice(idx, 1);
              opponent.discardPile.push(c);
              this.log(`AI discarded ${c.name} from hand.`);
              this.notifyStateChange();
            }
          } else {
            this.notifyStateChange();
          }
        };

        if (inPlay.length > 0) {
          if (opponentId === 'player' || this.isMultiplayer) {
            const choices = inPlay.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(opponentId, "Bludger Bop: Choose 1 of your cards in play to discard", choices, 1, 1, (selected) => {
              const sel = selected[0];
              const cardToDiscard = inPlay.find(c => c.instanceId === sel);
              if (cardToDiscard) {
                let found = false;
                const zones = ['lessons', 'creatures', 'items', 'locations', 'adventures', 'matches', 'characters'];
                for (let zone of zones) {
                  const idx = opponent[zone].findIndex(c => c.instanceId === cardToDiscard.instanceId);
                  if (idx !== -1) {
                    const [c] = opponent[zone].splice(idx, 1);
                    this.discardCardFromPlay(opponentId, c);
                    found = true;
                    break;
                  }
                }
              }
              bopHandDiscard();
            }, card);
          } else {
            const cardToDiscard = inPlay[0];
            const zones = ['lessons', 'creatures', 'items', 'locations', 'adventures', 'matches', 'characters'];
            for (let zone of zones) {
              const idx = opponent[zone].findIndex(c => c.instanceId === cardToDiscard.instanceId);
              if (idx !== -1) {
                const [c] = opponent[zone].splice(idx, 1);
                this.discardCardFromPlay(opponentId, c);
                break;
              }
            }
            bopHandDiscard();
          }
        } else {
          bopHandDiscard();
        }
        break;
      }

      case 'Flying Motorbike': {
        const list = [];
        this.players.player.locations.forEach(c => list.push({ id: `player-locations-${c.instanceId}`, label: `${c.name} (${this.players.player.name}'s Location)`, card: c, ownerId: 'player', zone: 'locations' }));
        this.players.opponent.locations.forEach(c => list.push({ id: `opponent-locations-${c.instanceId}`, label: `${c.name} (${this.players.opponent.name}'s Location)`, card: c, ownerId: 'opponent', zone: 'locations' }));
        this.players.player.adventures.forEach(c => list.push({ id: `player-adventures-${c.instanceId}`, label: `${c.name} (${this.players.player.name}'s Adventure)`, card: c, ownerId: 'player', zone: 'adventures' }));
        this.players.opponent.adventures.forEach(c => list.push({ id: `opponent-adventures-${c.instanceId}`, label: `${c.name} (${this.players.opponent.name}'s Adventure)`, card: c, ownerId: 'opponent', zone: 'adventures' }));
        
        if (list.length === 0) {
          this.log(`No active Locations or Adventures in play to discard.`);
          break;
        }
        
        if (casterId === 'player' || this.isMultiplayer) {
          this.promptChoice(casterId, "Flying Motorbike: Choose an Adventure or Location in play to discard", list, 1, 1, (selected) => {
            const sel = selected[0];
            const item = list.find(c => c.id === sel);
            if (item) {
              this.discardCardFromPlay(item.ownerId, item.card, item.zone);
              this.log(`Flying Motorbike: Discarded ${item.card.name} from play without reward.`);
            }
            this.notifyStateChange();
          }, card);
        } else {
          const item = list[0];
          this.discardCardFromPlay(item.ownerId, item.card, item.zone);
          this.log(`Flying Motorbike: AI discarded ${item.card.name} from play without reward.`);
        }
        break;
      }

      case 'Purple Firecrackers': {
        const count = Math.min(3, opponent.hand.length);
        if (count === 0) {
          this.log(`${opponent.name} has no cards in hand.`);
          break;
        }
        if (opponentId === 'player' || this.isMultiplayer) {
          const choices = opponent.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(opponentId, `Purple Firecrackers: Choose ${count} card(s) to discard`, choices, count, count, (selected) => {
            selected.forEach(instId => {
              const idx = opponent.hand.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = opponent.hand.splice(idx, 1);
                opponent.discardPile.push(c);
              }
            });
            this.log(`${opponent.name} discarded ${selected.length} card(s) from hand.`);
            this.notifyStateChange();
          }, card);
        } else {
          for (let i = 0; i < count; i++) {
            const idx = Math.floor(Math.random() * opponent.hand.length);
            const [c] = opponent.hand.splice(idx, 1);
            opponent.discardPile.push(c);
          }
          this.log(`AI discarded ${count} card(s) from hand.`);
        }
        break;
      }

      case 'Star Grass Salve': {
        const nonHealing = player.discardPile.filter(c => !this.isHealingCard(c));
        if (nonHealing.length === 0) {
          this.log(`No non-Healing cards in discard pile.`);
          break;
        }
        const choices = nonHealing.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        const maxTake = Math.min(12, choices.length);
        if (casterId === 'player' || this.isMultiplayer) {
          this.promptChoice(casterId, `Star Grass Salve: Choose up to ${maxTake} non-Healing cards to shuffle into deck`, choices, 0, maxTake, (selected) => {
            selected.forEach(instId => {
              const idx = player.discardPile.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.discardPile.splice(idx, 1);
                player.deck.push(c);
              }
            });
            this.shuffle(player.deck);
            this.log(`${player.name} shuffled ${selected.length} cards into deck.`);
            this.notifyStateChange();
          }, card);
        } else {
          for (let i = 0; i < maxTake; i++) {
            const [c] = player.discardPile.splice(player.discardPile.indexOf(nonHealing[i]), 1);
            player.deck.push(c);
          }
          this.shuffle(player.deck);
          this.log(`AI shuffled ${maxTake} cards into deck.`);
        }
        break;
      }

      case 'Winter Holiday': {
        const oppLessons = opponent.lessons;
        const oppCount = Math.min(3, oppLessons.length);
        
        const runCasterDiscard = () => {
          const castLessons = player.lessons;
          const castCount = Math.min(3, castLessons.length);
          if (castCount > 0) {
            if (casterId === 'player' || this.isMultiplayer) {
              const choices = castLessons.map(l => ({ id: l.instanceId, label: l.name, card: l }));
              this.promptChoice(casterId, `Winter Holiday: Choose ${castCount} Lesson(s) of yours to discard`, choices, castCount, castCount, (selected) => {
                selected.forEach(instId => {
                  const idx = player.lessons.findIndex(l => l.instanceId === instId);
                  if (idx !== -1) {
                    const [l] = player.lessons.splice(idx, 1);
                    this.discardCardFromPlay(playerId, l);
                  }
                });
                this.notifyStateChange();
              }, card);
            } else {
              for (let i = 0; i < castCount; i++) {
                const [l] = player.lessons.splice(0, 1);
                this.discardCardFromPlay(playerId, l);
              }
              this.notifyStateChange();
            }
          } else {
            this.notifyStateChange();
          }
        };

        if (oppCount > 0) {
          if (opponentId === 'player' || this.isMultiplayer) {
            const choices = oppLessons.map(l => ({ id: l.instanceId, label: l.name, card: l }));
            this.promptChoice(opponentId, `Winter Holiday: Choose ${oppCount} Lesson(s) of yours to discard`, choices, oppCount, oppCount, (selected) => {
              selected.forEach(instId => {
                const idx = opponent.lessons.findIndex(l => l.instanceId === instId);
                if (idx !== -1) {
                  const [l] = opponent.lessons.splice(idx, 1);
                  this.discardCardFromPlay(opponentId, l);
                }
              });
              runCasterDiscard();
            }, card);
          } else {
            for (let i = 0; i < oppCount; i++) {
              const [l] = opponent.lessons.splice(0, 1);
              this.discardCardFromPlay(opponentId, l);
            }
            runCasterDiscard();
          }
        } else {
          runCasterDiscard();
        }
        break;
      }

      case 'Wooden Flute': {
        const creatures = [...player.creatures, ...opponent.creatures];
        if (creatures.length === 0) {
          this.log(`No Creatures in play.`);
          break;
        }
        const choices = creatures.map(c => ({ id: c.instanceId, label: `${c.name} (${this.players[player.creatures.includes(c) ? player.id : opponent.id].name}'s)`, card: c }));
        const maxTake = Math.min(3, choices.length);
        if (casterId === 'player' || this.isMultiplayer) {
          this.promptChoice(casterId, `Wooden Flute: Choose up to ${maxTake} Creature(s) to return to hand`, choices, 0, maxTake, (selected) => {
            selected.forEach(instId => {
              const pIdx = player.creatures.findIndex(c => c.instanceId === instId);
              if (pIdx !== -1) {
                const [c] = player.creatures.splice(pIdx, 1);
                c.damage = 0;
                player.hand.push(c);
                this.log(`Wooden Flute: Returned ${c.name} to ${player.name}'s hand.`);
              }
              const oIdx = opponent.creatures.findIndex(c => c.instanceId === instId);
              if (oIdx !== -1) {
                const [c] = opponent.creatures.splice(oIdx, 1);
                c.damage = 0;
                opponent.hand.push(c);
                this.log(`Wooden Flute: Returned ${c.name} to ${opponent.name}'s hand.`);
              }
            });
            this.notifyStateChange();
          }, card);
        } else {
          for (let i = 0; i < maxTake; i++) {
            const instId = creatures[i].instanceId;
            const pIdx = player.creatures.findIndex(c => c.instanceId === instId);
            if (pIdx !== -1) {
              const [c] = player.creatures.splice(pIdx, 1);
              c.damage = 0;
              player.hand.push(c);
            }
            const oIdx = opponent.creatures.findIndex(c => c.instanceId === instId);
            if (oIdx !== -1) {
              const [c] = opponent.creatures.splice(oIdx, 1);
              c.damage = 0;
              opponent.hand.push(c);
            }
          }
        }
        break;
      }

      case 'Anti-Cheating Spell': {
        const lessons = opponent.hand.filter(c => c.type === 'Lesson');
        if (casterId === 'player' || this.isMultiplayer) {
          const choices = opponent.hand.map(c => ({ id: c.instanceId, label: `${c.name} (${c.type})`, card: c, disabled: c.type !== 'Lesson' }));
          if (lessons.length > 0) {
            this.promptChoice(casterId, `${opponent.name}'s Hand: Choose 1 Lesson to discard`, choices, 1, 1, (selected) => {
              const sel = selected[0];
              const idx = opponent.hand.findIndex(c => c.instanceId === sel);
              if (idx !== -1) {
                const [c] = opponent.hand.splice(idx, 1);
                opponent.discardPile.push(c);
                this.log(`Anti-Cheating Spell: Discarded ${c.name} from opponent's hand.`);
              }
              this.notifyStateChange();
            }, card);
          } else {
            choices.push({ id: 'done', label: 'Acknowledge (No Lessons in hand)' });
            this.promptChoice(casterId, `${opponent.name}'s Hand:`, choices, 1, 1, () => {
              this.notifyStateChange();
            }, card);
          }
        } else {
          if (lessons.length > 0) {
            const [c] = opponent.hand.splice(opponent.hand.indexOf(lessons[0]), 1);
            opponent.discardPile.push(c);
            this.log(`AI discarded ${c.name} from your hand.`);
          }
        }
        break;
      }

      case 'Bewitched Snowballs': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (3 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 3 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 3 Damage)`, card: c }));
        this.promptChoice(casterId, "Choose target for Bewitched Snowballs (3 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 3, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 3);
          }
          this.drawCard(casterId, false);
          this.log(`Bewitched Snowballs: Drew a card.`);
          this.notifyStateChange();
        }, card);
        break;
      }

      case 'Bucking Broomstick': {
        this.dealDamage(opponentId, 3, 'spell');
        const count = Math.min(2, opponent.hand.length);
        if (count > 0) {
          if (opponentId === 'player' || this.isMultiplayer) {
            const choices = opponent.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(opponentId, `Bucking Broomstick: Choose ${count} card(s) to discard`, choices, count, count, (selected) => {
              selected.forEach(instId => {
                const idx = opponent.hand.findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = opponent.hand.splice(idx, 1);
                  opponent.discardPile.push(c);
                }
              });
              this.log(`${opponent.name} discarded ${selected.length} card(s) from hand.`);
              this.notifyStateChange();
            }, card);
          } else {
            for (let i = 0; i < count; i++) {
              const idx = Math.floor(Math.random() * opponent.hand.length);
              const [c] = opponent.hand.splice(idx, 1);
              opponent.discardPile.push(c);
            }
            this.log(`AI discarded ${count} card(s) from hand.`);
          }
        }
        break;
      }

      case 'Cauldron Cakes': {
        const nonHealing = player.discardPile.filter(c => !this.isHealingCard(c));
        const choices = nonHealing.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        const maxTake = Math.min(2, choices.length);
        
        const finishCauldronCakes = () => {
          this.drawCard(casterId, false);
          this.log(`Cauldron Cakes: Drew a card.`);
          this.notifyStateChange();
        };

        if (maxTake > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            this.promptChoice(casterId, `Cauldron Cakes: Choose up to ${maxTake} non-Healing cards for bottom of deck`, choices, 0, maxTake, (selected) => {
              selected.forEach(instId => {
                const idx = player.discardPile.findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = player.discardPile.splice(idx, 1);
                  player.deck.unshift(c);
                }
              });
              finishCauldronCakes();
            }, card);
          } else {
            for (let i = 0; i < maxTake; i++) {
              const [c] = player.discardPile.splice(player.discardPile.indexOf(nonHealing[i]), 1);
              player.deck.unshift(c);
            }
            finishCauldronCakes();
          }
        } else {
          finishCauldronCakes();
        }
        break;
      }

      case 'Charms Accident': {
        this.dealDamage(opponentId, 2, 'spell');
        const items = [...player.items, ...opponent.items].filter(i => !i.subTypes?.includes('Healing') && i.name !== "Philosopher's Stone" && i.name !== "Hospital Dormitory");
        if (items.length > 0) {
          const choices = items.map(i => ({ id: i.instanceId, label: `${i.name} (${this.players[player.items.includes(i) ? player.id : opponent.id].name}'s)`, card: i }));
          choices.push({ id: 'none', label: 'Do not return any Item' });
          this.promptChoice(casterId, "Charms Accident: You may choose a non-Healing Item in play to return to hand", choices, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel && sel !== 'none') {
              const pIdx = player.items.findIndex(i => i.instanceId === sel);
              if (pIdx !== -1) {
                const [i] = player.items.splice(pIdx, 1);
                player.hand.push(i);
                this.log(`Charms Accident: Returned ${i.name} to ${player.name}'s hand.`);
              }
              const oIdx = opponent.items.findIndex(i => i.instanceId === sel);
              if (oIdx !== -1) {
                const [i] = opponent.items.splice(oIdx, 1);
                opponent.hand.push(i);
                this.log(`Charms Accident: Returned ${i.name} to ${opponent.name}'s hand.`);
              }
            }
            this.notifyStateChange();
          }, card);
        }
        break;
      }

      case 'Dog Bite': {
        const creatures = [...player.creatures, ...opponent.creatures];
        if (creatures.length === 0) {
          this.log(`No Creatures in play to choose.`);
          break;
        }
        const choices = creatures.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        this.promptChoice(casterId, "Dog Bite: Choose a Creature in play", choices, 1, 1, (selected) => {
          const sel = selected[0];
          const c = creatures.find(x => x.instanceId === sel);
          if (c) {
            const damage = c.damagePerTurn || 0;
            this.log(`Dog Bite: Selected ${c.name}. ${c.name} deals ${damage} damage to ${opponent.name}.`);
            this.dealDamage(opponentId, damage, 'creature', c);
          }
          this.notifyStateChange();
        }, card);
        break;
      }

      case 'Every-Flavor Beans': {
        const revealed = [];
        for (let i = 0; i < 2; i++) {
          if (player.deck.length > 0) {
            revealed.push(player.deck.pop());
          }
        }
        this.log(`Every-Flavor Beans: Revealed ${revealed.map(c => c.name).join(', ')}.`);
        revealed.forEach(c => {
          if (c.type === 'Lesson') {
            player.lessons.push(c);
            this.log(`Put Lesson into play: ${c.name}`);
          } else {
            player.discardPile.push(c);
            this.log(`Discarded non-Lesson: ${c.name}`);
          }
        });
        this.drawCard(casterId, false);
        this.log(`Every-Flavor Beans: Drew a card.`);
        break;
      }

      case 'Fire Protection Potion': {
        this.dealDamage(opponentId, 3, 'spell');
        player.preventSpellDamageNextTurn = true;
        this.log(`Fire Protection Potion: ${player.name} will prevent all Spell damage during ${opponent.name}'s next turn.`);
        break;
      }

      case 'Fungiface Potion': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (6 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 6 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 6 Damage)`, card: c }));
        this.promptChoice(casterId, "Choose target for Fungiface Potion (6 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 6, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 6);
          }
        }, card);
        break;
      }

      case 'Liquorice Wand': {
        this.dealDamage(opponentId, 2, 'spell');
        this.drawCard(casterId, false);
        this.log(`Liquorice Wand: Drew a card.`);
        break;
      }

      case 'Loop-the-Loops': {
        this.dealDamage(opponentId, 4, 'spell');
        this.drawCards(casterId, 4, false);
        this.log(`Loop-the-Loops: Drew 4 cards.`);
        break;
      }

      case 'Manegrow Potion': {
        const pLessons = player.lessons.filter(l => (l.provides?.type || l.lessonType) === 'Potions');
        const dmg = pLessons.length;
        this.dealDamage(opponentId, dmg, 'spell');
        this.log(`Manegrow Potion deals ${dmg} damage to ${opponent.name}.`);
        if (pLessons.length > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            const choices = pLessons.map(l => ({ id: l.instanceId, label: l.name, card: l }));
            this.promptChoice(casterId, "Manegrow Potion: Choose 1 of your Potions Lessons to discard", choices, 1, 1, (selected) => {
              const sel = selected[0];
              const idx = player.lessons.findIndex(l => l.instanceId === sel);
              if (idx !== -1) {
                const [l] = player.lessons.splice(idx, 1);
                this.discardCardFromPlay(casterId, l);
              }
              this.notifyStateChange();
            }, card);
          } else {
            const [l] = player.lessons.splice(player.lessons.indexOf(pLessons[0]), 1);
            this.discardCardFromPlay(casterId, l);
          }
        }
        break;
      }

      case 'Muffling Draught': {
        opponent.cantPlaySpellsNextTurn = true;
        this.log(`Muffling Draught: ${opponent.name} cannot play Spells on their next turn.`);
        break;
      }

      case 'Owl Post': {
        this.drawCards(casterId, 3, false);
        this.log(`Owl Post: Drew 3 cards.`);
        break;
      }

      case 'Scribblifors': {
        const oppCards = this.getCardsInPlay(opponentId);
        if (oppCards.length < 2) {
          this.log(`Opponent does not have 2 cards in play to target.`);
          break;
        }
        if (casterId === 'player' || this.isMultiplayer) {
          const choices = oppCards.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(casterId, "Scribblifors: Choose 2 of opponent's cards in play", choices, 2, 2, (selected) => {
            const targetCards = oppCards.filter(c => selected.includes(c.instanceId));
            if (opponentId === 'player' || this.isMultiplayer) {
              const oppChoices = targetCards.map(c => ({ id: c.instanceId, label: `Discard ${c.name} (Return other to hand)`, card: c }));
              this.promptChoice(opponentId, "Scribblifors: Choose 1 card to discard (the other returns to hand)", oppChoices, 1, 1, (oppSel) => {
                const discId = oppSel[0];
                const discCard = targetCards.find(c => c.instanceId === discId);
                const retCard = targetCards.find(c => c.instanceId !== discId);
                if (discCard) {
                  const zones = ['lessons', 'creatures', 'items', 'locations', 'adventures', 'matches', 'characters'];
                  for (let zone of zones) {
                    const idx = opponent[zone].findIndex(c => c.instanceId === discCard.instanceId);
                    if (idx !== -1) {
                      const [c] = opponent[zone].splice(idx, 1);
                      this.discardCardFromPlay(opponentId, c);
                      break;
                    }
                  }
                }
                if (retCard) {
                  const zones = ['lessons', 'creatures', 'items', 'locations', 'adventures', 'matches', 'characters'];
                  for (let zone of zones) {
                    const idx = opponent[zone].findIndex(c => c.instanceId === retCard.instanceId);
                    if (idx !== -1) {
                      const [c] = opponent[zone].splice(idx, 1);
                      c.damage = 0;
                      opponent.hand.push(c);
                      this.log(`Scribblifors: Returned ${c.name} to opponent hand.`);
                      break;
                    }
                  }
                }
                this.notifyStateChange();
              }, card);
            } else {
              const discCard = targetCards[0];
              const retCard = targetCards[1];
              const zones = ['lessons', 'creatures', 'items', 'locations', 'adventures', 'matches', 'characters'];
              for (let zone of zones) {
                const idx = opponent[zone].findIndex(c => c.instanceId === discCard.instanceId);
                if (idx !== -1) {
                  const [c] = opponent[zone].splice(idx, 1);
                  this.discardCardFromPlay(opponentId, c);
                  break;
                }
              }
              for (let zone of zones) {
                const idx = opponent[zone].findIndex(c => c.instanceId === retCard.instanceId);
                if (idx !== -1) {
                  const [c] = opponent[zone].splice(idx, 1);
                  c.damage = 0;
                  opponent.hand.push(c);
                  break;
                }
              }
            }
          }, card);
        } else {
          const targetCards = [oppCards[0], oppCards[1]];
          const discCard = targetCards[0];
          const retCard = targetCards[1];
          const zones = ['lessons', 'creatures', 'items', 'locations', 'adventures', 'matches', 'characters'];
          for (let zone of zones) {
            const idx = opponent[zone].findIndex(c => c.instanceId === discCard.instanceId);
            if (idx !== -1) {
              const [c] = opponent[zone].splice(idx, 1);
              this.discardCardFromPlay(opponentId, c);
              break;
            }
          }
          for (let zone of zones) {
            const idx = opponent[zone].findIndex(c => c.instanceId === retCard.instanceId);
            if (idx !== -1) {
              const [c] = opponent[zone].splice(idx, 1);
              c.damage = 0;
              opponent.hand.push(c);
              break;
            }
          }
        }
        break;
      }

      case 'Sleeping Potion': {
        this.dealDamage(opponentId, 4, 'spell');
        opponent.cantPlayAdventuresNextTurn = true;
        this.log(`Sleeping Potion: ${opponent.name} cannot play Adventures on their next turn.`);
        break;
      }

      case 'Switching Spell': {
        const items = [...player.items, ...opponent.items];
        if (items.length === 0) {
          this.log(`No items in play to discard.`);
          break;
        }
        const choices = items.map(i => ({ id: i.instanceId, label: `${i.name} (${this.players[player.items.includes(i) ? player.id : opponent.id].name}'s)`, card: i }));
        if (casterId === 'player' || this.isMultiplayer) {
          this.promptChoice(casterId, "Switching Spell: Choose an Item in play to discard", choices, 1, 1, (selected) => {
            const sel = selected[0];
            const pIdx = player.items.findIndex(i => i.instanceId === sel);
            if (pIdx !== -1) {
              const [i] = player.items.splice(pIdx, 1);
              this.discardCardFromPlay(player.id, i);
            }
            const oIdx = opponent.items.findIndex(i => i.instanceId === sel);
            if (oIdx !== -1) {
              const [i] = opponent.items.splice(oIdx, 1);
              this.discardCardFromPlay(opponent.id, i);
            }
            const eligibleDeckItems = player.deck.filter(c => c.type === 'Item');
            if (eligibleDeckItems.length > 0) {
              const deckChoices = eligibleDeckItems.map(c => ({ id: c.instanceId, label: c.name, card: c }));
              this.promptChoice(casterId, "Switching Spell: Choose an Item from your deck to put in hand", deckChoices, 0, 1, (deckSel) => {
                const deckId = deckSel[0];
                if (deckId) {
                  const idx = player.deck.findIndex(c => c.instanceId === deckId);
                  if (idx !== -1) {
                    const [c] = player.deck.splice(idx, 1);
                    player.hand.push(c);
                    this.log(`Switching Spell: Put ${c.name} into hand from deck.`);
                  }
                }
                this.shuffle(player.deck);
                this.notifyStateChange();
              }, card);
            } else {
              this.shuffle(player.deck);
              this.notifyStateChange();
            }
          }, card);
        } else {
          const sel = items[0];
          const pIdx = player.items.findIndex(i => i.instanceId === sel.instanceId);
          if (pIdx !== -1) {
            const [i] = player.items.splice(pIdx, 1);
            this.discardCardFromPlay(player.id, i);
          }
          const oIdx = opponent.items.findIndex(i => i.instanceId === sel.instanceId);
          if (oIdx !== -1) {
            const [i] = opponent.items.splice(oIdx, 1);
            this.discardCardFromPlay(opponent.id, i);
          }
          const eligibleDeckItems = player.deck.filter(c => c.type === 'Item');
          if (eligibleDeckItems.length > 0) {
            const [c] = player.deck.splice(player.deck.indexOf(eligibleDeckItems[0]), 1);
            player.hand.push(c);
            this.log(`Switching Spell: AI put ${c.name} into hand.`);
          }
          this.shuffle(player.deck);
        }
        break;
      }

      case 'Troll Bogies': {
        const items = [...player.items, ...opponent.items].filter(i => !i.subTypes?.includes('Healing') && i.name !== "Philosopher's Stone" && i.name !== "Hospital Dormitory");
        if (items.length === 0) {
          this.log(`No non-Healing items in play.`);
          break;
        }
        const choices = items.map(i => ({ id: i.instanceId, label: `${i.name} (${this.players[player.items.includes(i) ? player.id : opponent.id].name}'s)`, card: i }));
        if (casterId === 'player' || this.isMultiplayer) {
          this.promptChoice(casterId, "Troll Bogies: Choose a non-Healing Item to return to hand", choices, 1, 1, (selected) => {
            const sel = selected[0];
            const pIdx = player.items.findIndex(i => i.instanceId === sel);
            if (pIdx !== -1) {
              const [i] = player.items.splice(pIdx, 1);
              player.hand.push(i);
              this.log(`Troll Bogies: Returned ${i.name} to ${player.name}'s hand.`);
            }
            const oIdx = opponent.items.findIndex(i => i.instanceId === sel);
            if (oIdx !== -1) {
              const [i] = opponent.items.splice(oIdx, 1);
              opponent.hand.push(i);
              this.log(`Troll Bogies: Returned ${i.name} to ${opponent.name}'s hand.`);
            }
            this.notifyStateChange();
          }, card);
        } else {
          const sel = items[0];
          const pIdx = player.items.findIndex(i => i.instanceId === sel.instanceId);
          if (pIdx !== -1) {
            const [i] = player.items.splice(pIdx, 1);
            player.hand.push(i);
          }
          const oIdx = opponent.items.findIndex(i => i.instanceId === sel.instanceId);
          if (oIdx !== -1) {
            const [i] = opponent.items.splice(oIdx, 1);
            opponent.hand.push(i);
          }
        }
        break;
      }

      case 'Vanishing Step': {
        opponent.fewerActionsNextTurn = (opponent.fewerActionsNextTurn || 0) + 1;
        this.log(`Vanishing Step: ${opponent.name} will have 1 fewer Action on their next turn.`);
        break;
      }
      
      case 'Draught of Living Death': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (12 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 12 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 12 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Draught of Living Death (12 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 12, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 12);
          }
        });
        break;
      }
      
      case 'History of Magic': {
        const advCards = opponent.hand.filter(c => c.type === 'Adventure');
        if (casterId === 'player' || this.isMultiplayer) {
          const choices = opponent.hand.map(c => ({ id: c.instanceId, label: `${c.name} (${c.type})`, card: c, disabled: true }));
          choices.push({ id: 'done', label: `Acknowledge (${advCards.length} Adventure card(s) will be discarded)` });
          this.promptChoice(casterId, `${opponent.name}'s Hand:`, choices, 1, 1, () => {
            advCards.forEach(c => {
              opponent.hand = opponent.hand.filter(h => h.instanceId !== c.instanceId);
              opponent.discardPile.push(c);
              this.log(`${opponent.name}'s Adventure card was discarded: ${c.name}`);
            });
          }, card);
        } else {
          advCards.forEach(c => {
            opponent.hand = opponent.hand.filter(h => h.instanceId !== c.instanceId);
            opponent.discardPile.push(c);
            this.log(`${opponent.name}'s Adventure card was discarded: ${c.name}`);
          });
        }
        break;
      }
      
      case 'Incendio': {
        const charmsCount = player.lessons.filter(l => l.lessonType === 'Charms').length;
        if (charmsCount === 0) {
          this.log(`No Charms Lessons in play; Incendio deals 0 damage.`);
          break;
        }
        const choices = [];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - ${charmsCount} Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - ${charmsCount} Damage)`, card: c }));
        
        if (choices.length === 0) {
          this.log(`No creatures in play to target with Incendio.`);
          break;
        }
        
        this.promptChoice(casterId, `Choose Creature to deal ${charmsCount} damage to`, choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, charmsCount);
          }
        });
        break;
      }
      
      case 'Malevolent Mixture': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (10 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 10 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 10 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Malevolent Mixture (10 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 10, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 10);
          }
        });
        break;
      }
      
      case 'Platform 9 3/4': {
        this.actionsRemaining += 2;
        this.log(`${player.name} gets 2 more Actions this turn.`);
        break;
      }
      
      case 'Raven to Writing Desk': {
        if (opponent.creatures.length < 2) {
          this.log(`Opponent has fewer than 2 Creatures; Raven to Writing Desk has no effect.`);
          break;
        }
        const choices = opponent.creatures.map(c => ({ id: `creature-${opponent.id}-${c.instanceId}`, label: c.name, card: c }));
        this.promptChoice(casterId, "Choose 1 of opponent's Creatures to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel && sel.startsWith('creature-')) {
            const instId = sel.split('-').slice(2).join('-');
            this.discardCreature(opponent.id, instId);
          }
        });
        break;
      }
      
      case 'Shrinking Potion': {
        player.preventAllDamageNextTurn = true;
        player.preventAllDamageSource = 'Shrinking Potion';
        this.log(`During opponent's next turn, all damage done to ${player.name} is prevented.`);
        break;
      }
      
      case 'Titillando': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (3 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 3 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 3 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Titillando (3 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 3, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 3);
          }
          
          const discardCount = Math.min(3, opponent.hand.length);
          if (discardCount > 0) {
            const discChoices = opponent.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(opponentId, `Choose ${discardCount} card(s) to discard (Titillando)`, discChoices, discardCount, discardCount, (discSelected) => {
              discSelected.forEach(instId => {
                const idx = opponent.hand.findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = opponent.hand.splice(idx, 1);
                  opponent.discardPile.push(c);
                  this.log(`${opponent.name} discarded: ${c.name}`);
                }
              });
            });
          }
        });
        break;
      }
      
      case 'Transfiguration Exam': {
        const pCount = player.creatures.length;
        const oCount = opponent.creatures.length;
        player.discardPile.push(...player.creatures);
        player.creatures = [];
        opponent.discardPile.push(...opponent.creatures);
        opponent.creatures = [];
        this.log(`Discarded all Creatures in play (${pCount} player, ${oCount} opponent).`);
        break;
      }
      
      case 'Transfiguration Test': {
        const processTest = (targetPlayer, nextStepCallback) => {
          if (targetPlayer.creatures.length < 2) {
            nextStepCallback();
            return;
          }
          const choices = targetPlayer.creatures.map(c => ({ id: `creature-${targetPlayer.id}-${c.instanceId}`, label: c.name, card: c }));
          this.promptChoice(targetPlayer.id, `Choose 1 Creature to KEEP (all others will be discarded)`, choices, 1, 1, (selected) => {
            const keepSel = selected[0];
            if (keepSel) {
              const keepInstId = keepSel.split('-').slice(2).join('-');
              const kept = targetPlayer.creatures.find(c => c.instanceId === keepInstId);
              targetPlayer.creatures.forEach(c => {
                if (c.instanceId !== keepInstId) {
                  targetPlayer.discardPile.push(c);
                }
              });
              targetPlayer.creatures = kept ? [kept] : [];
              this.log(`${targetPlayer.name} chose to keep ${kept ? kept.name : 'nothing'} and discarded the rest.`);
            }
            nextStepCallback();
          });
        };
        
        processTest(opponent, () => {
          processTest(player, () => {});
        });
        break;
      }
      
      case 'Alchemy': {
        const lessons = player.deck.filter(c => c.type === 'Lesson');
        const choices = lessons.map(c => ({ id: `deck-player-${c.instanceId}`, label: `${c.name} (${c.lessonType})`, card: c }));
        const maxTake = Math.min(2, choices.length);
        if (maxTake === 0) {
          this.log(`No Lessons in deck to find.`);
          break;
        }
        this.promptChoice(casterId, `Choose up to ${maxTake} Lesson cards from your deck`, choices, 0, maxTake, (selected) => {
          selected.forEach(selId => {
            const instId = selId.split('-').slice(2).join('-');
            const idx = player.deck.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = player.deck.splice(idx, 1);
              player.hand.push(c);
              this.log(`Put ${c.name} from deck into hand.`);
            }
          });
          this.shuffle(player.deck);
        });
        break;
      }
      
      case 'Apothecary': {
        const handChoices = player.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        if (handChoices.length < 2) {
          this.log(`Not enough cards in hand to discard as cost for Apothecary.`);
          break;
        }
        this.promptChoice(casterId, "Choose 2 cards from your hand to discard", handChoices, 2, 2, (discarded) => {
          discarded.forEach(instId => {
            const idx = player.hand.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = player.hand.splice(idx, 1);
              player.discardPile.push(c);
              this.log(`Discarded: ${c.name}`);
            }
          });
          
          const potionsCards = player.deck.filter(c => c.lessonCost?.type === 'Potions');
          const choices = potionsCards.map(c => ({ id: `deck-player-${c.instanceId}`, label: `${c.name} (needs Potions)`, card: c }));
          if (choices.length === 0) {
            this.log(`No cards needing Potions Power found in deck.`);
            this.shuffle(player.deck);
            return;
          }
          this.promptChoice(casterId, "Search deck for a card needing Potions Power", choices, 0, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const instId = sel.split('-').slice(2).join('-');
              const idx = player.deck.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.deck.splice(idx, 1);
                player.hand.push(c);
                this.log(`Put ${c.name} from deck into hand.`);
              }
            }
            this.shuffle(player.deck);
          });
        });
        break;
      }
      
      case 'Apparate': {
        if (player.adventures.length > 0) {
          const adv = player.adventures.pop();
          opponent.discardPile.push(adv);
          this.log(`Apparate: Discarded opponent's Adventure from your side: ${adv.name}.`);
        } else {
          this.log(`You have no active Adventure on your side to discard.`);
        }
        break;
      }
      
      case 'Bluebell Flames': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (4 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 4 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 4 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Bluebell Flames (4 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 4, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 4);
          }
        });
        break;
      }
      
      case 'Burning Bitterroot Balm': {
        const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
        const choices = nonHealing.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        const maxTake = Math.min(10, choices.length);
        if (maxTake === 0) {
          this.log(`${player.name} resolved Burning Bitterroot Balm: No non-Healing cards in discard pile.`);
          break;
        }
        this.promptChoice(casterId, `Burning Bitterroot Balm: Choose up to ${maxTake} non-Healing cards to shuffle into deck`, choices, 0, maxTake, (selected) => {
          selected.forEach(instId => {
            const idx = player.discardPile.findIndex(dc => dc.instanceId === instId);
            if (idx !== -1) {
              const [c] = player.discardPile.splice(idx, 1);
              player.deck.push(c);
            }
          });
          this.shuffle(player.deck);
          this.log(`${player.name} shuffled ${selected.length} non-Healing card(s) from discard into deck.`);
          this.notifyStateChange();
        });
        break;
      }
      
      case 'Confundus': {
        const discardCount = Math.min(2, opponent.hand.length);
        if (discardCount > 0) {
          const choices = opponent.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(opponentId, `Choose ${discardCount} card(s) to discard (Confundus)`, choices, discardCount, discardCount, (selected) => {
            selected.forEach(instId => {
              const idx = opponent.hand.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = opponent.hand.splice(idx, 1);
                opponent.discardPile.push(c);
                this.log(`${opponent.name} discarded: ${c.name}`);
              }
            });
          });
        }
        break;
      }
      
      case 'Dogbreath Potion': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (8 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 8 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 8 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Dogbreath Potion (8 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 8, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 8);
          }
        });
        break;
      }
      
      case "Draco's Trick": {
        if (opponent.adventures.length > 0) {
          const adv = opponent.adventures.pop();
          player.discardPile.push(adv);
          this.log(`Discarded own Adventure: ${adv.name}. Resolving reward: Draw 3 cards.`);
          this.drawCards(casterId, 3, false);
        } else {
          this.log(`Opponent has no active Adventure in play.`);
        }
        break;
      }
      
      case 'Fumos': {
        ['player', 'opponent'].forEach(pId => {
          const list = [...this.players[pId].creatures];
          list.forEach(c => {
            this.damageCreature(pId, c.instanceId, 2);
          });
        });
        break;
      }
      
      case 'Logic Puzzle': {
        if (player.adventures.length > 0) {
          const adv = player.adventures.pop();
          opponent.discardPile.push(adv);
          this.log(`Logic Puzzle: Discarded active Adventure ${adv.name} from your side. Resolving reward...`);
          this.applyAdventureReward(casterId, adv);
        } else {
          this.log(`You have no active Adventure in play on your side.`);
        }
        break;
      }
      
      case 'Mysterious Egg': {
        const creatures = player.deck.filter(c => c.type === 'Creature');
        const choices = creatures.map(c => ({ id: `deck-player-${c.instanceId}`, label: c.name, card: c }));
        if (choices.length === 0) {
          this.log(`No Creatures found in deck.`);
          this.shuffle(player.deck);
          break;
        }
        this.promptChoice(casterId, "Search deck for a Creature card", choices, 0, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const instId = sel.split('-').slice(2).join('-');
            const idx = player.deck.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = player.deck.splice(idx, 1);
              player.hand.push(c);
              this.log(`Put ${c.name} from deck into hand.`);
            }
          }
          this.shuffle(player.deck);
        });
        break;
      }
      
      case 'Nurture': {
        player.creatures.forEach(c => {
          c.damage = 0;
        });
        this.log(`Healed all of ${player.name}'s creatures.`);
        break;
      }
      
      case 'Ollivanders': {
        const items = player.discardPile.filter(c => c.type === 'Item');
        const choices = items.map(c => ({ id: `discard-player-${c.instanceId}`, label: c.name, card: c }));
        if (choices.length === 0) {
          this.log(`No Items in discard pile to retrieve.`);
          break;
        }
        this.promptChoice(casterId, "Choose an Item card to retrieve", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const instId = sel.split('-').slice(2).join('-');
            const idx = player.discardPile.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = player.discardPile.splice(idx, 1);
              player.hand.push(c);
              this.log(`Retrieved Item card: ${c.name}`);
            }
          }
        });
        break;
      }
      
      case "Pomfrey's Pick-Me-Up": {
        const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
        const choices = nonHealing.map(c => ({
          id: c.instanceId,
          label: c.name,
          card: c
        }));
        
        const maxTake = Math.min(3, choices.length);
        if (maxTake === 0) {
          this.log(`${player.name} resolved Pomfrey's Pick-Me-Up: No non-Healing cards in discard pile.`);
          this.drawCard(casterId, false);
          break;
        }
        
        this.promptChoice(casterId, `Pomfrey's Pick-Me-Up: Choose up to ${maxTake} non-Healing cards to put on bottom of deck (in order of selection)`, choices, 0, maxTake, (selected) => {
          if (selected.length > 0) {
            selected.forEach(instId => {
              const idx = player.discardPile.findIndex(dc => dc.instanceId === instId);
              if (idx !== -1) {
                player.discardPile.splice(idx, 1);
              }
            });
            // unshift in reverse order so the first chosen is bottom-most
            for (let i = selected.length - 1; i >= 0; i--) {
              const card = nonHealing.find(c => c.instanceId === selected[i]);
              if (card) {
                player.deck.unshift(card);
              }
            }
            const cardNames = selected.map(instId => nonHealing.find(c => c.instanceId === instId)?.name || instId);
            this.log(`${player.name} put ${selected.length} card(s) on the bottom of their deck: ${cardNames.join(', ')}.`);
          } else {
            this.log(`${player.name} put 0 cards on the bottom of their deck.`);
          }
          this.drawCard(casterId, false);
          this.notifyStateChange();
        });
        break;
      }
      
      case 'Potions Exam': {
        const canPrevent = opponent.lessons.some(l => l.lessonType === 'Potions');
        const choices = [];
        if (canPrevent) {
          choices.push({ id: 'prevent', label: 'Discard 1 Potions Lesson (Prevent Penalty)' });
        }
        choices.push({ id: 'penalty', label: 'Discard 3 cards in play' });
        
        this.promptChoice(opponentId, `Potions Exam! Choose defense:`, choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'prevent') {
            const potLesson = opponent.lessons.find(l => l.lessonType === 'Potions');
            if (potLesson) {
              opponent.lessons = opponent.lessons.filter(l => l.instanceId !== potLesson.instanceId);
              opponent.discardPile.push(potLesson);
              this.log(`${opponent.name} discarded 1 Potions Lesson to prevent Potions Exam penalty.`);
            }
          } else {
            const inPlay = [...opponent.lessons, ...opponent.creatures, ...opponent.items, ...opponent.adventures];
            const maxDiscard = Math.min(3, inPlay.length);
            if (maxDiscard > 0) {
              const playChoices = inPlay.map(c => ({ id: `play-${opponentId}-${c.instanceId}`, label: `${c.name} (${c.type})`, card: c }));
              this.promptChoice(opponentId, `Choose ${maxDiscard} card(s) in play to discard`, playChoices, maxDiscard, maxDiscard, (discards) => {
                discards.forEach(selId => {
                  const instId = selId.split('-').slice(2).join('-');
                  let found = false;
                  ['lessons', 'creatures', 'items', 'adventures'].forEach(zone => {
                    if (found) return;
                    const idx = opponent[zone].findIndex(c => c.instanceId === instId);
                    if (idx !== -1) {
                      const [c] = opponent[zone].splice(idx, 1);
                      opponent.discardPile.push(c);
                      this.log(`Discarded: ${c.name}`);
                      found = true;
                    }
                  });
                });
              });
            }
          }
        });
        break;
      }
      
      case 'Snuffling Potion': {
        opponent.discardDrawsNextTurn = true;
        this.log(`During opponent's next turn, whenever they draw a card, they discard it.`);
        break;
      }
      
      case 'Stupefy': {
        this.dealDamage(opponentId, 5, 'spell');
        break;
      }
      
      case 'Take Root': {
        const choices = opponent.creatures.map(c => ({ id: `creature-${opponent.id}-${c.instanceId}`, label: c.name, card: c }));
        if (choices.length === 0) {
          this.log(`Opponent has no Creatures in play to discard.`);
          break;
        }
        this.promptChoice(opponentId, "Choose 1 of your Creatures to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const parts = sel.split('-');
            const ownerId = parts[1];
            const instId = parts.slice(2).join('-');
            this.discardCreature(ownerId, instId);
          }
        });
        break;
      }
      
      case 'Transmogrify': {
        const creatureChoices = player.creatures.map(c => ({ id: `creature-player-${c.instanceId}`, label: c.name, card: c }));
        if (creatureChoices.length === 0) {
          this.log(`You have no Creatures in play to discard.`);
          break;
        }
        this.promptChoice(casterId, "Choose a Creature in play to discard", creatureChoices, 1, 1, (discarded) => {
          const dSel = discarded[0];
          if (dSel) {
            const instId = dSel.split('-').slice(2).join('-');
            const idx = player.creatures.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = player.creatures.splice(idx, 1);
              player.discardPile.push(c);
              this.log(`Discarded Creature: ${c.name}`);
            }
          }
          
          const creatures = player.deck.filter(c => c.type === 'Creature');
          const choices = creatures.map(c => ({ id: `deck-player-${c.instanceId}`, label: c.name, card: c }));
          if (choices.length === 0) {
            this.log(`No Creatures found in deck.`);
            this.shuffle(player.deck);
            return;
          }
          this.promptChoice(casterId, "Search deck for a Creature card", choices, 0, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const instId = sel.split('-').slice(2).join('-');
              const idx = player.deck.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.deck.splice(idx, 1);
                player.hand.push(c);
                this.log(`Put ${c.name} from deck into hand.`);
              }
            }
            this.shuffle(player.deck);
          });
        });
        break;
      }
      
      case 'Vanishing Glass': {
        if (opponent.lessons.length === 0) {
          this.log(`Opponent has no Lessons in play. Vanishing Glass cannot be played.`);
          break;
        }
        const lessonChoices = opponent.lessons.map(l => ({ id: `lesson-opponent-${l.instanceId}`, label: `${l.name} (${l.lessonType})`, card: l }));
        this.promptChoice(casterId, "Choose opponent's Lesson to discard", lessonChoices, 1, 1, (discarded) => {
          const dSel = discarded[0];
          if (dSel) {
            const instId = dSel.split('-').slice(2).join('-');
            const idx = opponent.lessons.findIndex(l => l.instanceId === instId);
            if (idx !== -1) {
              const [l] = opponent.lessons.splice(idx, 1);
              opponent.discardPile.push(l);
              this.log(`Discarded opponent's Lesson: ${l.name}`);
            }
          }
          
          const creatures = player.deck.filter(c => c.type === 'Creature');
          const choices = creatures.map(c => ({ id: `deck-player-${c.instanceId}`, label: c.name, card: c }));
          if (choices.length === 0) {
            this.log(`No Creatures found in deck.`);
            this.shuffle(player.deck);
            return;
          }
          this.promptChoice(casterId, "Search deck for a Creature card", choices, 0, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const instId = sel.split('-').slice(2).join('-');
              const idx = player.deck.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.deck.splice(idx, 1);
                player.hand.push(c);
                this.log(`Put ${c.name} from deck into hand.`);
              }
            }
            this.shuffle(player.deck);
          });
        });
        break;
      }
      
      case 'Accio': {
        const lessons = player.discardPile.filter(c => c.type === 'Lesson');
        const choices = lessons.map(c => ({ id: `discard-${casterId}-${c.instanceId}`, label: `${c.name} (${c.lessonType})`, card: c }));
        const maxTake = Math.min(2, choices.length);
        if (maxTake === 0) {
          this.log(`No Lessons in discard pile.`);
          break;
        }
        this.promptChoice(casterId, `Choose up to ${maxTake} Lesson cards to retrieve`, choices, 0, maxTake, (selected) => {
          selected.forEach(selId => {
            const instId = selId.split('-').slice(2).join('-');
            const idx = player.discardPile.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = player.discardPile.splice(idx, 1);
              player.hand.push(c);
              this.log(`Put ${c.name} from discard into hand.`);
            }
          });
        });
        break;
      }
      
      case 'Avifors': {
        const comLessons = opponent.lessons.filter(l => l.lessonType === 'Care of Magical Creatures');
        const choices = comLessons.map(l => ({ id: `lesson-opponent-${l.instanceId}`, label: l.name, card: l }));
        if (choices.length === 0) {
          this.log(`Opponent has no Care of Magical Creatures Lessons in play.`);
          break;
        }
        this.promptChoice(casterId, "Choose a Care of Magical Creatures Lesson to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const instId = sel.split('-').slice(2).join('-');
            const idx = opponent.lessons.findIndex(l => l.instanceId === instId);
            if (idx !== -1) {
              const [l] = opponent.lessons.splice(idx, 1);
              opponent.discardPile.push(l);
              this.log(`Discarded opponent's Care of Magical Creatures Lesson: ${l.name}`);
              this.notifyStateChange();
            }
          }
        });
        break;
      }
      
      case 'Baubillious': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (1 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 1 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 1 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Baubillious (1 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 1, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 1);
          }
          this.drawCard(casterId, false);
        });
        break;
      }
      
      case 'Boil Cure': {
        const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
        const choices = nonHealing.map(c => ({
          id: c.instanceId,
          label: c.name,
          card: c
        }));
        
        const maxTake = Math.min(4, choices.length);
        if (maxTake === 0) {
          this.log(`${player.name} resolved Boil Cure: No non-Healing cards in discard pile.`);
          break;
        }
        
        this.promptChoice(casterId, `Boil Cure: Choose up to ${maxTake} non-Healing cards to put on bottom of deck (in order of selection)`, choices, 0, maxTake, (selected) => {
          if (selected.length > 0) {
            selected.forEach(instId => {
              const idx = player.discardPile.findIndex(dc => dc.instanceId === instId);
              if (idx !== -1) {
                player.discardPile.splice(idx, 1);
              }
            });
            // unshift in reverse order so the first chosen is bottom-most
            for (let i = selected.length - 1; i >= 0; i--) {
              const card = nonHealing.find(c => c.instanceId === selected[i]);
              if (card) {
                player.deck.unshift(card);
              }
            }
            const cardNames = selected.map(instId => nonHealing.find(c => c.instanceId === instId)?.name || instId);
            this.log(`${player.name} put ${selected.length} card(s) on the bottom of their deck: ${cardNames.join(', ')}.`);
          } else {
            this.log(`${player.name} put 0 cards on the bottom of their deck.`);
          }
          this.notifyStateChange();
        });
        break;
      }
      
      case 'Cauldron to Sieve': {
        const potLessons = opponent.lessons.filter(l => l.lessonType === 'Potions');
        const choices = potLessons.map(l => ({ id: `lesson-${opponent.id}-${l.instanceId}`, label: l.name, card: l }));
        if (choices.length === 0) {
          this.log(`Opponent has no Potions Lessons in play.`);
          break;
        }
        this.promptChoice(casterId, "Choose a Potions Lesson to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const instId = sel.split('-').slice(2).join('-');
            const idx = opponent.lessons.findIndex(l => l.instanceId === instId);
            if (idx !== -1) {
              const [l] = opponent.lessons.splice(idx, 1);
              opponent.discardPile.push(l);
              this.log(`Discarded opponent's Potions Lesson: ${l.name}`);
            }
          }
        });
        break;
      }
      
      case 'Dungbomb': {
        player.preventCreatureAdventureDamageNextTurn = true;
        this.log(`During opponent's next turn, Adventure and Creature damage to ${player.name} is prevented.`);
        break;
      }
      
      case 'Epoximise': {
        const chLessons = opponent.lessons.filter(l => l.lessonType === 'Charms');
        const choices = chLessons.map(l => ({ id: `lesson-${opponent.id}-${l.instanceId}`, label: l.name, card: l }));
        if (choices.length === 0) {
          this.log(`Opponent has no Charms Lessons in play.`);
          break;
        }
        this.promptChoice(casterId, "Choose a Charms Lesson to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const instId = sel.split('-').slice(2).join('-');
            const idx = opponent.lessons.findIndex(l => l.instanceId === instId);
            if (idx !== -1) {
              const [l] = opponent.lessons.splice(idx, 1);
              opponent.discardPile.push(l);
              this.log(`Discarded opponent's Charms Lesson: ${l.name}`);
              this.notifyStateChange();
            }
          }
        });
        break;
      }
      
      case 'Erumpent Potion': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (1 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 1 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 1 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Erumpent Potion (1 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 1, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 1);
          }
        });
        break;
      }
      
      case 'Fluffy Falls Asleep': {
        const choices = [];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature)`, card: c }));
        
        if (choices.length === 0) {
          this.log(`No creatures in play.`);
          break;
        }
        this.promptChoice(casterId, "Choose a Creature to return to hand", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            const targetPlayer = this.players[owner];
            const idx = targetPlayer.creatures.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = targetPlayer.creatures.splice(idx, 1);
              targetPlayer.hand.push(c);
              this.log(`Returned Creature: ${c.name} to ${targetPlayer.name}'s hand.`);
            }
          }
        });
        break;
      }
      
      case 'Forgetfulness Potion': {
        opponent.cantPlayCardsNextTurn = true;
        this.log(`During opponent's next turn, they cannot play any cards.`);
        break;
      }
      
      case 'Foul Brew': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (2 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 2 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 2 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Foul Brew (2 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 2, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 2);
          }
        });
        break;
      }
      
      case 'Hagrid and the Stranger': {
        const creatures = player.discardPile.filter(c => c.type === 'Creature');
        const choices = creatures.map(c => ({ id: `discard-player-${c.instanceId}`, label: c.name, card: c }));
        if (choices.length === 0) {
          this.log(`No Creatures in discard pile to retrieve.`);
          break;
        }
        this.promptChoice(casterId, "Choose a Creature card to retrieve", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const instId = sel.split('-').slice(2).join('-');
            const idx = player.discardPile.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = player.discardPile.splice(idx, 1);
              player.hand.push(c);
              this.log(`Retrieved Creature: ${c.name}`);
            }
          }
        });
        break;
      }
      
      case 'Homework': {
        const lessons = player.hand.filter(c => c.type === 'Lesson');
        const choices = lessons.map(c => ({ id: `hand-player-${c.instanceId}`, label: `${c.name} (${c.lessonType})`, card: c }));
        const maxTake = Math.min(2, choices.length);
        if (maxTake === 0) {
          this.log(`No Lesson cards in hand to play.`);
          break;
        }
        this.promptChoice(casterId, `Choose up to ${maxTake} Lesson card(s) to put in play`, choices, 0, maxTake, (selected) => {
          selected.forEach(selId => {
            const instId = selId.split('-').slice(2).join('-');
            const idx = player.hand.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = player.hand.splice(idx, 1);
              player.lessons.push(c);
              this.log(`Played Lesson from hand: ${c.name}.`);
            }
          });
        });
        break;
      }
      
      case 'Hospital Wing': {
        const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
        const choices = nonHealing.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        const maxTake = Math.min(8, choices.length);
        if (maxTake === 0) {
          this.log(`${player.name} resolved Hospital Wing: No non-Healing cards in discard pile.`);
          break;
        }
        this.promptChoice(casterId, `Hospital Wing: Choose up to ${maxTake} non-Healing cards to shuffle into deck`, choices, 0, maxTake, (selected) => {
          selected.forEach(instId => {
            const idx = player.discardPile.findIndex(dc => dc.instanceId === instId);
            if (idx !== -1) {
              const [c] = player.discardPile.splice(idx, 1);
              player.deck.push(c);
            }
          });
          this.shuffle(player.deck);
          this.log(`${player.name} shuffled ${selected.length} non-Healing card(s) from discard into deck.`);
          this.notifyStateChange();
        });
        break;
      }
      
      case 'Illegibilus': {
        if (opponent.hand.length === 0) {
          this.log(`Opponent has no cards in hand to discard.`);
          break;
        }
        const choices = opponent.hand.map(c => ({ id: `hand-opponent-${c.instanceId}`, label: c.name, card: c }));
        this.promptChoice(casterId, "Choose 1 card in opponent's hand to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const instId = sel.split('-').slice(2).join('-');
            const idx = opponent.hand.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = opponent.hand.splice(idx, 1);
              opponent.discardPile.push(c);
              this.log(`Discarded opponent's hand card: ${c.name}`);
            }
          }
        });
        break;
      }
      
      case 'Incarcifors': {
        const choices = opponent.creatures.map(c => ({ id: `creature-${opponent.id}-${c.instanceId}`, label: c.name, card: c }));
        if (choices.length === 0) {
          this.log(`Opponent has no Creatures in play to discard.`);
          break;
        }
        this.promptChoice(casterId, "Choose opponent's Creature to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const instId = sel.split('-').slice(2).join('-');
            this.discardCreature(opponent.id, instId);
          }
        });
        break;
      }
      
      case 'Lost Notes': {
        const inPlay = [...opponent.items, ...opponent.lessons];
        const choices = inPlay.map(c => ({ id: `${c.type.toLowerCase()}-${opponent.id}-${c.instanceId}`, label: `${c.name} (${c.type})`, card: c }));
        if (choices.length === 0) {
          this.log(`Opponent has no Items or Lessons in play.`);
          break;
        }
        this.promptChoice(casterId, "Choose opponent's Lesson or Item to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const parts = sel.split('-');
            const zone = parts[0] === 'lesson' ? 'lessons' : 'items';
            const instId = parts[2];
            const idx = opponent[zone].findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = opponent[zone].splice(idx, 1);
              opponent.discardPile.push(c);
              this.log(`Discarded opponent's ${c.type}: ${c.name}`);
            }
          }
        });
        break;
      }
      
      case 'Magical Mishap': {
        this.dealDamage(opponentId, 3, 'spell');
        break;
      }
      
      case 'Noxious Poison': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (5 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 5 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 5 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Noxious Poison (5 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 5, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 5);
          }
        });
        break;
      }
      
      case 'Out of the Woods': {
        const creatures = opponent.hand.filter(c => c.type === 'Creature');
        if (casterId === 'player' || this.isMultiplayer) {
          const choices = opponent.hand.map(c => ({ id: c.instanceId, label: `${c.name} (${c.type})`, card: c, disabled: true }));
          choices.push({ id: 'done', label: `Acknowledge (${creatures.length} Creature card(s) will be discarded)` });
          this.promptChoice(casterId, `${opponent.name}'s Hand:`, choices, 1, 1, () => {
            creatures.forEach(c => {
              opponent.hand = opponent.hand.filter(h => h.instanceId !== c.instanceId);
              opponent.discardPile.push(c);
              this.log(`${opponent.name}'s Creature was discarded from hand: ${c.name}`);
            });
          }, card);
        } else {
          creatures.forEach(c => {
            opponent.hand = opponent.hand.filter(h => h.instanceId !== c.instanceId);
            opponent.discardPile.push(c);
            this.log(`${opponent.name}'s Creature was discarded from hand: ${c.name}`);
          });
        }
        break;
      }
      
      case 'Potions Mistake': {
        const inPlay = [...opponent.creatures, ...opponent.items];
        const choices = inPlay.map(c => ({ id: `${c.type.toLowerCase()}-${opponent.id}-${c.instanceId}`, label: `${c.name} (${c.type})`, card: c }));
        if (choices.length === 0) {
          this.log(`Opponent has no Creatures or Items in play.`);
          break;
        }
        this.promptChoice(casterId, "Choose opponent's Creature or Item to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const parts = sel.split('-');
            const zone = parts[0] === 'creature' ? 'creatures' : 'items';
            const instId = parts[2];
            const idx = opponent[zone].findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = opponent[zone].splice(idx, 1);
              opponent.discardPile.push(c);
              this.log(`Discarded opponent's ${c.type}: ${c.name}`);
            }
          }
        });
        break;
      }
      
      case 'Restricted Section': {
        const transLessons = opponent.lessons.filter(l => l.lessonType === 'Transfiguration');
        const choices = transLessons.map(l => ({ id: `lesson-${opponent.id}-${l.instanceId}`, label: l.name, card: l }));
        if (choices.length === 0) {
          this.log(`Opponent has no Transfiguration Lessons in play.`);
          break;
        }
        this.promptChoice(casterId, "Choose a Transfiguration Lesson to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const instId = sel.split('-').slice(2).join('-');
            const idx = opponent.lessons.findIndex(l => l.instanceId === instId);
            if (idx !== -1) {
              const [l] = opponent.lessons.splice(idx, 1);
              opponent.discardPile.push(l);
              this.log(`Discarded opponent's Transfiguration Lesson: ${l.name}`);
            }
          }
        });
        break;
      }
      
      case "Snape's Question": {
        const oppPotLessons = opponent.hand.filter(c => c.type === 'Lesson' && c.lessonType === 'Potions');
        const choices = [];
        if (oppPotLessons.length > 0) {
          choices.push({ id: 'reveal', label: `Reveal 1 Potions Lesson from hand (Prevent Damage)` });
        }
        choices.push({ id: 'damage', label: `Take 4 damage` });
        
        this.promptChoice(opponentId, "Snape's Question: Choose defense", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'reveal') {
            const revealed = oppPotLessons[0];
            this.log(`${opponent.name} revealed Potions Lesson: ${revealed.name} to prevent Snape's Question damage.`);
          } else {
            this.dealDamage(opponentId, 4, 'spell');
          }
        });
        break;
      }
      
      case 'Squiggle Quill': {
        const choices = opponent.items.map(c => ({ id: `item-${opponent.id}-${c.instanceId}`, label: c.name, card: c }));
        if (choices.length === 0) {
          this.log(`Opponent has no Items in play.`);
          break;
        }
        this.promptChoice(casterId, "Choose opponent's Item to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const instId = sel.split('-').slice(2).join('-');
            const idx = opponent.items.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = opponent.items.splice(idx, 1);
              opponent.discardPile.push(c);
              this.log(`Discarded opponent's Item: ${c.name}`);
            }
          }
        });
        break;
      }
      
      case 'Steelclaw': {
        this.log(`Steelclaw: ${player.name}'s creatures attack together!`);
        player.creatures.forEach(c => {
          if (opponent.wingedKeysTargetInstanceId === c.instanceId) {
            this.log(`Winged Keys: Prevented damage from ${c.name} in Steelclaw.`);
            return;
          }
          const dmg = this.getCreatureDamage(playerId, c);
          if (dmg > 0) {
            this.dealDamage(opponentId, dmg, 'creature', c);
          }
        });
        break;
      }
      
      case 'Toe Biter': {
        this.dealDamage(opponentId, 2, 'spell');
        const choices = [];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 2 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 2 Damage)`, card: c }));
        
        if (choices.length > 0) {
          this.promptChoice(casterId, "Choose a Creature to deal 2 damage to (Optional)", choices, 0, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const parts = sel.split('-');
              const owner = parts[1];
              const instId = parts.slice(2).join('-');
              this.damageCreature(owner, instId, 2);
            }
          });
        }
        break;
      }
      
      case 'Vermillious': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (3 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 3 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 3 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Vermillious (3 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 3, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 3);
          }
        });
        break;
      }
      
      case 'Wingardium Leviosa!': {
        player.preventCreatureDamageNextTurn = true;
        player.preventCreatureDamageSource = 'Wingardium Leviosa!';
        this.log(`During opponent's next turn, all Creature damage to ${player.name} is prevented.`);
        break;
      }

      case 'Catch the Snitch': {
        const playerWithMatch = this.players.player.matches.length > 0 ? 'player' : (this.players.opponent.matches.length > 0 ? 'opponent' : null);
        if (playerWithMatch) {
          const matchCard = this.players[playerWithMatch].matches[0];
          this.winMatch(casterId, matchCard, playerWithMatch);
        } else {
          this.log(`Catch the Snitch: No active Match card in play to win.`);
        }
        break;
      }
      case 'Charms Exam': {
        const discardedCount = opponent.hand.length;
        if (discardedCount > 0) {
          opponent.discardPile.push(...opponent.hand);
          opponent.hand = [];
          this.log(`Charms Exam: Discarded ${opponent.name}'s entire hand of ${discardedCount} card(s).`);
          
          if (opponentId === 'player' || this.isMultiplayer) {
            const choices = [];
            for (let i = 1; i <= discardedCount; i++) {
              choices.push({ id: `draw-${i}`, label: `Draw ${i} card(s)` });
            }
            this.promptChoice(opponentId, `Charms Exam: Choose how many cards to draw (up to ${discardedCount})`, choices, 0, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const drawAmount = parseInt(sel.split('-')[1], 10);
                for (let i = 0; i < drawAmount; i++) {
                  this.drawCard(opponentId, false);
                }
                this.log(`${opponent.name} chose to draw ${drawAmount} card(s).`);
                this.notifyStateChange();
              }
            });
          } else {
            for (let i = 0; i < discardedCount; i++) {
              this.drawCard(opponentId, false);
            }
            this.log(`${opponent.name} drew ${discardedCount} card(s).`);
            this.notifyStateChange();
          }
        } else {
          this.log(`Charms Exam: Opponent hand is already empty.`);
        }
        break;
      }
      case 'Halloween Feast': {
        const creatures = player.discardPile.filter(c => c.type === 'Creature');
        if (creatures.length === 0) {
          this.log(`Halloween Feast: No Creatures in discard pile to retrieve.`);
          break;
        }
        const maxRetrieves = Math.min(4, creatures.length);
        if (casterId === 'player' || this.isMultiplayer) {
          const choices = creatures.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(casterId, `Halloween Feast: Choose up to ${maxRetrieves} Creatures to put into hand`, choices, 0, maxRetrieves, (selected) => {
            selected.forEach(instId => {
              const idx = player.discardPile.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.discardPile.splice(idx, 1);
                player.hand.push(c);
              }
            });
            this.log(`Halloween Feast: Added ${selected.length} Creature(s) to hand.`);
            this.notifyStateChange();
          });
        } else {
          const toAdd = creatures.slice(0, maxRetrieves);
          toAdd.forEach(c => {
            const idx = player.discardPile.indexOf(c);
            if (idx !== -1) player.discardPile.splice(idx, 1);
            player.hand.push(c);
          });
          this.log(`Halloween Feast: AI added ${toAdd.length} Creature(s) to hand.`);
          this.notifyStateChange();
        }
        break;
      }
      case 'No Time to Play': {
        const discardZone = (pState) => {
          for (let i = pState.items.length - 1; i >= 0; i--) {
            const item = pState.items[i];
            if (item.lessonCost && item.lessonCost.type === 'Quidditch') {
              pState.items.splice(i, 1);
              pState.discardPile.push(item);
              this.log(`No Time to Play: Discarded ${item.name} from play.`);
            }
          }
          if (pState.matches.length > 0) {
            const [m] = pState.matches.splice(0, 1);
            pState.discardPile.push(m);
            this.log(`No Time to Play: Discarded active Match: ${m.name}.`);
          }
        };
        discardZone(this.players.player);
        discardZone(this.players.opponent);
        this.players.player.matchDamageDealt = 0;
        this.players.opponent.matchDamageDealt = 0;
        break;
      }
      case 'Out of Control': {
        this.dealDamage(opponentId, 6, 'spell');
        const count = opponent.hand.length;
        if (count > 0) {
          const discardCount = Math.min(4, count);
          if (opponentId === 'player' || this.isMultiplayer) {
            const choices = opponent.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(opponentId, `Out of Control: Select ${discardCount} card(s) to discard`, choices, discardCount, discardCount, (selected) => {
              selected.forEach(instId => {
                const idx = opponent.hand.findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = opponent.hand.splice(idx, 1);
                  opponent.discardPile.push(c);
                }
              });
              this.log(`Out of Control: Opponent discarded ${selected.length} card(s) from hand.`);
              this.notifyStateChange();
            });
          } else {
            for (let i = 0; i < discardCount; i++) {
              const idx = Math.floor(Math.random() * opponent.hand.length);
              const [c] = opponent.hand.splice(idx, 1);
              opponent.discardPile.push(c);
            }
            this.log(`Out of Control: AI discarded ${discardCount} card(s) from hand.`);
            this.notifyStateChange();
          }
        }
        break;
      }
      case 'Potions Class Disaster': {
        const getEligible = (pState) => {
          const cards = [];
          pState.hand.forEach(c => cards.push({ id: `hand-${c.instanceId}`, label: `${c.name} (In Hand)`, card: c, source: 'hand' }));
          pState.lessons.forEach(c => cards.push({ id: `lessons-${c.instanceId}`, label: `${c.name} (Lesson)`, card: c, source: 'lessons' }));
          pState.creatures.forEach(c => cards.push({ id: `creatures-${c.instanceId}`, label: `${c.name} (Creature)`, card: c, source: 'creatures' }));
          pState.items.forEach(c => cards.push({ id: `items-${c.instanceId}`, label: `${c.name} (Item)`, card: c, source: 'items' }));
          pState.adventures.forEach(c => cards.push({ id: `adventures-${c.instanceId}`, label: `${c.name} (Adventure)`, card: c, source: 'adventures' }));
          pState.matches.forEach(c => cards.push({ id: `matches-${c.instanceId}`, label: `${c.name} (Match)`, card: c, source: 'matches' }));
          return cards;
        };
        const eligible = getEligible(opponent);
        const maxDiscard = Math.min(5, eligible.length);
        if (maxDiscard === 0) {
          this.log(`Potions Class Disaster: Opponent has no cards to discard.`);
          break;
        }

        if (opponentId === 'player' || this.isMultiplayer) {
          this.promptChoice(opponentId, `Potions Class Disaster: Choose ${maxDiscard} card(s) to discard`, eligible, maxDiscard, maxDiscard, (selected) => {
            selected.forEach(selId => {
              const parts = selId.split('-');
              const type = parts[0];
              const instId = parts.slice(1).join('-');
              const idx = opponent[type].findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = opponent[type].splice(idx, 1);
                opponent.discardPile.push(c);
              }
            });
            this.log(`Potions Class Disaster: Opponent discarded ${selected.length} card(s).`);
            this.notifyStateChange();
          });
        } else {
          const selected = [];
          const handEligible = eligible.filter(e => e.source === 'hand');
          const lessonEligible = eligible.filter(e => e.source === 'lessons');
          const otherEligible = eligible.filter(e => e.source !== 'hand' && e.source !== 'lessons');
          
          const sorted = [...handEligible, ...lessonEligible, ...otherEligible];
          const toDiscard = sorted.slice(0, maxDiscard);
          toDiscard.forEach(item => {
            const idx = opponent[item.source].findIndex(c => c.instanceId === item.card.instanceId);
            if (idx !== -1) {
              const [c] = opponent[item.source].splice(idx, 1);
              opponent.discardPile.push(c);
            }
          });
          this.log(`Potions Class Disaster: AI discarded ${toDiscard.length} card(s).`);
          this.notifyStateChange();
        }
        break;
      }
      case 'Chocolate Frogs': {
        const chars = player.deck.filter(c => c.type === 'Character');
        if (chars.length === 0) {
          this.log(`Chocolate Frogs: No Character cards found in deck.`);
          break;
        }
        if (casterId === 'player' || this.isMultiplayer) {
          const choices = chars.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(casterId, "Chocolate Frogs: Select a Character card to add to hand", choices, 1, 1, (selected) => {
            const sel = selected[0];
            const idx = player.deck.findIndex(c => c.instanceId === sel);
            if (idx !== -1) {
              const [c] = player.deck.splice(idx, 1);
              player.hand.push(c);
              this.log(`Chocolate Frogs: Added ${c.name} to hand.`);
            }
            this.shuffle(player.deck);
            this.notifyStateChange();
          });
        } else {
          const [c] = player.deck.splice(player.deck.indexOf(chars[0]), 1);
          player.hand.push(c);
          this.shuffle(player.deck);
          this.log(`Chocolate Frogs: AI added ${c.name} to hand.`);
          this.notifyStateChange();
        }
        break;
      }
      case 'Defence!': {
        player.preventAllDamageNextTurn = true;
        player.preventAllDamageSource = 'Defence!';
        this.log(`Defence!: During opponent's next turn, prevent all damage done to ${player.name}.`);
        break;
      }
      case 'Diffindo': {
        const getPlayables = (pState) => {
          const cards = [];
          pState.lessons.forEach(c => cards.push({ id: `lessons-${c.instanceId}`, label: `${c.name} (Lesson)`, card: c, source: 'lessons' }));
          pState.creatures.forEach(c => cards.push({ id: `creatures-${c.instanceId}`, label: `${c.name} (Creature)`, card: c, source: 'creatures' }));
          pState.items.forEach(c => cards.push({ id: `items-${c.instanceId}`, label: `${c.name} (Item)`, card: c, source: 'items' }));
          pState.adventures.forEach(c => cards.push({ id: `adventures-${c.instanceId}`, label: `${c.name} (Adventure)`, card: c, source: 'adventures' }));
          pState.matches.forEach(c => cards.push({ id: `matches-${c.instanceId}`, label: `${c.name} (Match)`, card: c, source: 'matches' }));
          return cards;
        };
        const eligible = getPlayables(opponent);
        if (eligible.length === 0) {
          this.log(`Diffindo: Opponent has no cards in play.`);
          break;
        }
        if (casterId === 'player' || this.isMultiplayer) {
          this.promptChoice(casterId, "Diffindo: Choose 1 opponent's card in play to discard", eligible, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const parts = sel.split('-');
              const type = parts[0];
              const instId = parts.slice(1).join('-');
              const idx = opponent[type].findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = opponent[type].splice(idx, 1);
                opponent.discardPile.push(c);
                this.log(`Diffindo: Discarded opponent's ${c.name} from play.`);
                this.notifyStateChange();
              }
            }
          });
        } else {
          const item = eligible[Math.floor(Math.random() * eligible.length)];
          const idx = opponent[item.source].findIndex(c => c.instanceId === item.card.instanceId);
          if (idx !== -1) {
            const [c] = opponent[item.source].splice(idx, 1);
            opponent.discardPile.push(c);
            this.log(`Diffindo: AI discarded your ${c.name} from play.`);
            this.notifyStateChange();
          }
        }
        break;
      }
      case 'Jawbind Potion': {
        this.dealDamage(opponentId, 2, 'spell');
        opponent.cantPlaySpellsNextTurn = true;
        this.log(`Jawbind Potion: Opponent takes 2 damage and cannot play Spell cards next turn.`);
        break;
      }
      case 'Missing Parchment': {
        const spells = opponent.hand.filter(c => c.type === 'Spell');
        if (spells.length === 0) {
          this.log(`Missing Parchment: No Spell cards in opponent's hand.`);
          break;
        }
        if (casterId === 'player' || this.isMultiplayer) {
          const choices = spells.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(casterId, "Missing Parchment: Choose 1 spell to discard from opponent's hand", choices, 1, 1, (selected) => {
            const sel = selected[0];
            const idx = opponent.hand.findIndex(c => c.instanceId === sel);
            if (idx !== -1) {
              const [c] = opponent.hand.splice(idx, 1);
              opponent.discardPile.push(c);
              this.log(`Missing Parchment: Discarded ${c.name} from opponent's hand.`);
              this.notifyStateChange();
            }
          });
        } else {
          const [c] = opponent.hand.splice(opponent.hand.indexOf(spells[0]), 1);
          opponent.discardPile.push(c);
          this.log(`Missing Parchment: AI discarded ${c.name} from your hand.`);
          this.notifyStateChange();
        }
        break;
      }
      case 'Petrificus Totalus': {
        const getTargets = () => {
          const targets = [];
          this.players.player.creatures.forEach(c => targets.push({ id: `creature-player-${c.instanceId}`, label: `${c.name} (Your Creature)`, card: c, ownerId: 'player' }));
          this.players.opponent.creatures.forEach(c => targets.push({ id: `creature-opponent-${c.instanceId}`, label: `${c.name} (Opponent's Creature)`, card: c, ownerId: 'opponent' }));
          return targets;
        };
        const targets = getTargets();
        if (targets.length === 0) {
          this.log(`Petrificus Totalus: No Creatures in play.`);
          break;
        }

        const resolvePetrificus = (selCreature, ownerId) => {
          const ownerState = this.players[ownerId];
          this.discardCreature(ownerId, selCreature.instanceId);
          const lessons = ownerState.discardPile.filter(c => c.type === 'Lesson');
          if (lessons.length > 0) {
            if (casterId === 'player' || this.isMultiplayer) {
              const choices = lessons.map(c => ({ id: c.instanceId, label: c.name, card: c }));
              this.promptChoice(casterId, `Petrificus Totalus: Select a Lesson card from ${ownerState.name}'s discard pile to put in play`, choices, 1, 1, (selected) => {
                const selLessonId = selected[0];
                const lessonIdx = ownerState.discardPile.findIndex(c => c.instanceId === selLessonId);
                if (lessonIdx !== -1) {
                  const [lesson] = ownerState.discardPile.splice(lessonIdx, 1);
                  ownerState.lessons.push(lesson);
                  this.log(`Petrificus Totalus: Put ${lesson.name} in play.`);
                  this.notifyStateChange();
                }
              });
            } else {
              const [lesson] = ownerState.discardPile.splice(ownerState.discardPile.indexOf(lessons[0]), 1);
              ownerState.lessons.push(lesson);
              this.log(`Petrificus Totalus: AI put ${lesson.name} in play.`);
              this.notifyStateChange();
            }
          } else {
            this.log(`Petrificus Totalus: No lessons in ${ownerState.name}'s discard to put in play.`);
            this.notifyStateChange();
          }
        };

        if (casterId === 'player' || this.isMultiplayer) {
          this.promptChoice(casterId, "Petrificus Totalus: Choose a Creature to discard", targets, 1, 1, (selected) => {
            const sel = selected[0];
            const found = targets.find(t => t.id === sel);
            if (found) {
              resolvePetrificus(found.card, found.ownerId);
            }
          });
        } else {
          const pCreature = targets.find(t => t.ownerId === 'player');
          const found = pCreature || targets[0];
          resolvePetrificus(found.card, found.ownerId);
        }
        break;
      }
      case 'Start-of-Term Feast': {
        const lessons = player.discardPile.filter(c => c.type === 'Lesson');
        const choices = lessons.map(c => ({ id: `discard-${casterId}-${c.instanceId}`, label: `${c.name} (${c.lessonType})`, card: c }));
        const maxTake = Math.min(4, choices.length);
        if (maxTake === 0) {
          this.log(`Start-of-Term Feast: No Lesson cards in discard pile.`);
          break;
        }
        this.promptChoice(casterId, `Start-of-Term Feast: Choose up to ${maxTake} Lesson card(s) to retrieve`, choices, 0, maxTake, (selected) => {
          selected.forEach(selId => {
            const instId = selId.split('-').slice(2).join('-');
            const idx = player.discardPile.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = player.discardPile.splice(idx, 1);
              player.hand.push(c);
              this.log(`Start-of-Term Feast: Returned ${c.name} to hand.`);
            }
          });
          this.notifyStateChange();
        });
        break;
      }

      case 'Strategy Session': {
        const qLessonsInHand = player.hand.filter(c => c.type === 'Lesson' && c.lessonType === 'Quidditch');
        if (qLessonsInHand.length === 0) {
          this.log(`Strategy Session: No Quidditch Lessons in hand.`);
          break;
        }
        
        const maxChoice = Math.min(3, qLessonsInHand.length);
        const choices = qLessonsInHand.map(c => ({ id: `hand-${casterId}-${c.instanceId}`, label: c.name, card: c }));
        
        this.promptChoice(casterId, `Strategy Session: Choose up to ${maxChoice} Quidditch Lesson(s) to put into play`, choices, 0, maxChoice, (selected) => {
          selected.forEach(selId => {
            const instId = selId.split('-').slice(2).join('-');
            const idx = player.hand.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [lessonCard] = player.hand.splice(idx, 1);
              player.lessons.push(lessonCard);
              this.log(`Strategy Session: Put Quidditch Lesson ${lessonCard.name} into play.`);
            }
          });
          this.notifyStateChange();
        });
        break;
      }

      case 'Weakness Potion': {
        this.dealDamage(opponentId, 5, 'spell');
        player.preventCreatureDamageNextTurn = true;
        player.preventCreatureDamageSource = 'Weakness Potion';
        this.log(`Weakness Potion: Opponent takes 5 damage and opponent's Creatures can't deal damage next turn.`);
        break;
      }
      case 'Bloodroot Poison': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (4 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 4 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 4 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Bloodroot Poison: Choose target (deals 4 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 4, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 4);
          }
        });
        break;
      }
      case 'Bravado': {
        player.bravadoActiveThisTurn = true;
        this.log(`Bravado: For the rest of this turn, your Spell cards need 5 less Power to play (min 1).`);
        break;
      }
      case 'Bruisewort Balm': {
        const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing') && !c.healing);
        if (nonHealing.length === 0) {
          this.log(`Bruisewort Balm: No eligible non-Healing cards in discard.`);
          break;
        }
        const maxShuffle = Math.min(5, nonHealing.length);
        if (casterId === 'player' || this.isMultiplayer) {
          const choices = nonHealing.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(casterId, `Bruisewort Balm: Select up to ${maxShuffle} non-Healing cards to shuffle into deck`, choices, 0, maxShuffle, (selected) => {
            selected.forEach(instId => {
              const idx = player.discardPile.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.discardPile.splice(idx, 1);
                player.deck.push(c);
              }
            });
            this.shuffle(player.deck);
            this.log(`Bruisewort Balm: Shuffled ${selected.length} card(s) into deck.`);
            this.notifyStateChange();
          });
        } else {
          const toAdd = nonHealing.slice(0, maxShuffle);
          toAdd.forEach(c => {
            const idx = player.discardPile.indexOf(c);
            if (idx !== -1) player.discardPile.splice(idx, 1);
            player.deck.push(c);
          });
          this.shuffle(player.deck);
          this.log(`Bruisewort Balm: AI shuffled ${toAdd.length} card(s) into deck.`);
          this.notifyStateChange();
        }
        break;
      }
      case 'Power Play': {
        this.dealDamage(opponentId, 7, 'spell', card);
        break;
      }
      case 'Cobbing': {
        this.dealDamage(opponentId, 4, 'spell', card);
        const getPlayables = (pState) => {
          const cards = [];
          pState.lessons.forEach(c => cards.push({ id: `lessons-${c.instanceId}`, label: `${c.name} (Lesson)`, card: c, source: 'lessons' }));
          pState.creatures.forEach(c => cards.push({ id: `creatures-${c.instanceId}`, label: `${c.name} (Creature)`, card: c, source: 'creatures' }));
          pState.items.forEach(c => cards.push({ id: `items-${c.instanceId}`, label: `${c.name} (Item)`, card: c, source: 'items' }));
          pState.adventures.forEach(c => cards.push({ id: `adventures-${c.instanceId}`, label: `${c.name} (Adventure)`, card: c, source: 'adventures' }));
          pState.matches.forEach(c => cards.push({ id: `matches-${c.instanceId}`, label: `${c.name} (Match)`, card: c, source: 'matches' }));
          return cards;
        };
        const eligible = getPlayables(opponent);
        if (eligible.length === 0) {
          this.log(`Cobbing: Opponent has no cards in play to discard.`);
          break;
        }
        if (opponentId === 'player' || this.isMultiplayer) {
          this.promptChoice(opponentId, "Cobbing: Choose 1 card in play to discard", eligible, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const parts = sel.split('-');
              const type = parts[0];
              const instId = parts.slice(1).join('-');
              const idx = opponent[type].findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = opponent[type].splice(idx, 1);
                opponent.discardPile.push(c);
                this.log(`Cobbing: Opponent discarded ${c.name} from play.`);
                this.notifyStateChange();
              }
            }
          });
        } else {
          const item = eligible[Math.floor(Math.random() * eligible.length)];
          const idx = opponent[item.source].findIndex(c => c.instanceId === item.card.instanceId);
          if (idx !== -1) {
            const [c] = opponent[item.source].splice(idx, 1);
            opponent.discardPile.push(c);
            this.log(`Cobbing: AI discarded your ${c.name} from play.`);
            this.notifyStateChange();
          }
        }
        break;
      }
      case 'Desk Into Pig': {
        const creatures = player.deck.filter(c => c.type === 'Creature');
        if (creatures.length === 0) {
          this.log(`Desk Into Pig: No Creatures in deck.`);
          break;
        }
        const maxTake = Math.min(3, creatures.length);
        if (casterId === 'player' || this.isMultiplayer) {
          const choices = creatures.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(casterId, `Desk Into Pig: Select up to ${maxTake} Creatures to put in hand`, choices, 0, maxTake, (selected) => {
            selected.forEach(instId => {
              const idx = player.deck.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.deck.splice(idx, 1);
                player.hand.push(c);
              }
            });
            this.shuffle(player.deck);
            this.log(`Desk Into Pig: Added ${selected.length} Creature(s) to hand.`);
            this.notifyStateChange();
          });
        } else {
          const toAdd = creatures.slice(0, maxTake);
          toAdd.forEach(c => {
            const idx = player.deck.indexOf(c);
            if (idx !== -1) player.deck.splice(idx, 1);
            player.hand.push(c);
          });
          this.shuffle(player.deck);
          this.log(`Desk Into Pig: AI added ${toAdd.length} Creature(s) to hand.`);
          this.notifyStateChange();
        }
        break;
      }
      case 'Drowsiness Draught': {
        this.dealDamage(opponentId, 3, 'spell', card);
        opponent.cantPlayLessonsNextTurn = true;
        this.log(`Drowsiness Draught: Opponent takes 3 damage and cannot play Lessons next turn.`);
        break;
      }
      case 'Fouled!': {
        this.dealDamage(opponentId, 4, 'spell', card);
        opponent.fewerActionsNextTurn = (opponent.fewerActionsNextTurn || 0) + 1;
        this.log(`Fouled!: Opponent takes 4 damage and will have 1 fewer Action in their next turn.`);
        break;
      }
      case 'Gone!': {
        const creatures = opponent.hand.filter(c => c.type === 'Creature');
        if (creatures.length === 0) {
          this.log(`Gone!: No Creatures in opponent's hand.`);
          break;
        }
        if (casterId === 'player' || this.isMultiplayer) {
          const choices = creatures.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(casterId, "Gone!: Choose 1 Creature to discard from opponent's hand", choices, 1, 1, (selected) => {
            const sel = selected[0];
            const idx = opponent.hand.findIndex(c => c.instanceId === sel);
            if (idx !== -1) {
              const [c] = opponent.hand.splice(idx, 1);
              opponent.discardPile.push(c);
              this.log(`Gone!: Discarded ${c.name} from opponent's hand.`);
              this.notifyStateChange();
            }
          });
        } else {
          const [c] = opponent.hand.splice(opponent.hand.indexOf(creatures[0]), 1);
          opponent.discardPile.push(c);
          this.log(`Gone!: AI discarded ${c.name} from your hand.`);
          this.notifyStateChange();
        }
        break;
      }
      case 'Mice to Snuffboxes': {
        const allCreatures = [
          ...player.creatures.map(c => ({ id: `creatures-${player.id}-${c.instanceId}`, label: `${c.name} (${player.name}'s Creature)`, card: c, ownerId: player.id })),
          ...opponent.creatures.map(c => ({ id: `creatures-${opponent.id}-${c.instanceId}`, label: `${c.name} (${opponent.name}'s Creature)`, card: c, ownerId: opponent.id }))
        ];
        if (allCreatures.length === 0) {
          this.log(`Mice to Snuffboxes: No Creatures in play.`);
          break;
        }
        const maxReturn = Math.min(2, allCreatures.length);
        if (casterId === 'player' || this.isMultiplayer) {
          this.promptChoice(casterId, `Mice to Snuffboxes: Choose up to ${maxReturn} Creatures to return to hand`, allCreatures, 0, maxReturn, (selected) => {
            selected.forEach(sel => {
              const found = allCreatures.find(t => t.id === sel);
              if (found) {
                const ownerState = this.players[found.ownerId];
                const idx = ownerState.creatures.findIndex(c => c.instanceId === found.card.instanceId);
                if (idx !== -1) {
                  ownerState.creatures.splice(idx, 1);
                  ownerState.hand.push(found.card);
                }
              }
            });
            this.log(`Mice to Snuffboxes: Returned ${selected.length} Creature(s) to hand.`);
            this.notifyStateChange();
          });
        } else {
          const pCreatures = allCreatures.filter(t => t.ownerId === 'player');
          const toReturn = pCreatures.slice(0, maxReturn);
          toReturn.forEach(item => {
            const idx = this.players.player.creatures.findIndex(c => c.instanceId === item.card.instanceId);
            if (idx !== -1) {
              this.players.player.creatures.splice(idx, 1);
              this.players.player.hand.push(item.card);
            }
          });
          this.log(`Mice to Snuffboxes: AI returned ${toReturn.length} Creature(s) to hand.`);
          this.notifyStateChange();
        }
        break;
      }
      case 'Mopsus Potion': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (3 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 3 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 3 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Mopsus Potion: Choose target (deals 3 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 3, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 3);
          }
        });
        break;
      }
      case 'Ouch!': {
        this.dealDamage(opponentId, 5, 'spell', card);
        const count = opponent.hand.length;
        if (count > 0) {
          if (opponentId === 'player' || this.isMultiplayer) {
            const choices = opponent.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(opponentId, "Ouch!: Select 1 card to discard from hand", choices, 1, 1, (selected) => {
              const sel = selected[0];
              const idx = opponent.hand.findIndex(c => c.instanceId === sel);
              if (idx !== -1) {
                const [c] = opponent.hand.splice(idx, 1);
                opponent.discardPile.push(c);
                this.log(`Ouch!: Opponent discarded ${c.name} from hand.`);
                this.notifyStateChange();
              }
            });
          } else {
            const idx = Math.floor(Math.random() * opponent.hand.length);
            const [c] = opponent.hand.splice(idx, 1);
            opponent.discardPile.push(c);
            this.log(`Ouch!: AI discarded ${c.name} from your hand.`);
            this.notifyStateChange();
          }
        }
        break;
      }
      case 'Penalty Shot': {
        this.drawCard(casterId, false);
        this.drawCard(casterId, false);
        this.drawCard(casterId, false);
        this.log(`Penalty Shot: Drew 3 cards.`);
        break;
      }

      case 'Pulling Up': {
        this.dealDamage(opponentId, 2, 'spell', card);
        this.drawCard(casterId, false);
        this.drawCard(casterId, false);
        this.log(`Pulling Up: Drew 2 cards.`);
        break;
      }
      case 'Research': {
        const lessons = player.deck.filter(c => c.type === 'Lesson');
        if (lessons.length === 0) {
          this.log(`Research: No Lessons in deck.`);
          break;
        }
        const maxTake = Math.min(2, lessons.length);
        if (casterId === 'player' || this.isMultiplayer) {
          const choices = lessons.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(casterId, `Research: Select up to ${maxTake} Lessons to put in play`, choices, 0, maxTake, (selected) => {
            selected.forEach(instId => {
              const idx = player.deck.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.deck.splice(idx, 1);
                player.lessons.push(c);
              }
            });
            this.shuffle(player.deck);
            this.log(`Research: Put ${selected.length} Lesson(s) in play.`);
            this.notifyStateChange();
          }, card);
        } else {
          const toAdd = lessons.slice(0, maxTake);
          toAdd.forEach(c => {
            const idx = player.deck.indexOf(c);
            if (idx !== -1) player.deck.splice(idx, 1);
            player.lessons.push(c);
          });
          this.shuffle(player.deck);
          this.log(`Research: AI put ${toAdd.length} Lesson(s) in play.`);
          this.notifyStateChange();
        }
        break;
      }
      case 'Rope Bind': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (2 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 2 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 2 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Rope Bind: Choose target (deals 2 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 2, 'spell', card);
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 2);
          }
          this.drawCard(casterId, false);
          this.log(`Rope Bind: Drew a card.`);
          this.notifyStateChange();
        });
        break;
      }
      case 'Searching for the Snitch': {
        const matches = player.deck.filter(c => {
          const costType = c.lessonCost?.type;
          return c.type === 'Lesson' && c.lessonType === 'Quidditch' || costType === 'Quidditch';
        });
        if (matches.length === 0) {
          this.log(`Searching for the Snitch: No Quidditch cards in deck.`);
          break;
        }
        if (casterId === 'player' || this.isMultiplayer) {
          const choices = matches.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(casterId, "Searching for the Snitch: Choose 1 Quidditch card to add to hand", choices, 1, 1, (selected) => {
            const sel = selected[0];
            const idx = player.deck.findIndex(c => c.instanceId === sel);
            if (idx !== -1) {
              const [c] = player.deck.splice(idx, 1);
              player.hand.push(c);
              this.log(`Searching for the Snitch: Added ${c.name} to hand.`);
            }
            this.shuffle(player.deck);
            this.notifyStateChange();
          }, card);
        } else {
          const [c] = player.deck.splice(player.deck.indexOf(matches[0]), 1);
          player.hand.push(c);
          this.shuffle(player.deck);
          this.log(`Searching for the Snitch: AI added ${c.name} to hand.`);
          this.notifyStateChange();
        }
        break;
      }
      case 'Smash!': {
        const items = opponent.items;
        if (items.length === 0) {
          this.log(`Smash!: Opponent has no Items in play.`);
          break;
        }
        if (casterId === 'player' || this.isMultiplayer) {
          const choices = items.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(casterId, "Smash!: Choose 1 opponent's Item to discard", choices, 1, 1, (selected) => {
            const sel = selected[0];
            const idx = opponent.items.findIndex(c => c.instanceId === sel);
            if (idx !== -1) {
              const [c] = opponent.items.splice(idx, 1);
              opponent.discardPile.push(c);
              this.log(`Smash!: Discarded ${c.name} from play.`);
              this.notifyStateChange();
            }
          }, card);
        } else {
          const [c] = opponent.items.splice(0, 1);
          opponent.discardPile.push(c);
          this.log(`Smash!: AI discarded ${c.name} from play.`);
          this.notifyStateChange();
        }
        break;
      }
      case 'Stream of Flames': {
        this.dealDamage(opponentId, 3, 'spell', card);
        const allCreatures = [...player.creatures, ...opponent.creatures];
        if (allCreatures.length === 0) {
          this.log(`Stream of Flames: No Creatures in play to damage.`);
          break;
        }
        const choices = [];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 3 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 3 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Stream of Flames: Choose creature target (deals 3 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts.slice(2).join('-');
            this.damageCreature(owner, instId, 3);
          }
        });
        break;
      }
      case 'Swarm!': {
        const creaturesCount = player.creatures.length + opponent.creatures.length;
        this.log(`Swarm!: Found ${creaturesCount} Creature(s) in play.`);
        if (creaturesCount > 0) {
          this.dealDamage(opponentId, creaturesCount, 'spell');
        }
        break;
      }
      case 'Time Out': {
        if (player.deck.length === 0) {
          this.log(`Time Out: No cards in deck.`);
          break;
        }
        const lookCount = Math.min(6, player.deck.length);
        const topCards = [];
        for (let i = 0; i < lookCount; i++) {
          topCards.push(player.deck.pop());
        }
        if (casterId === 'player' || this.isMultiplayer) {
          const choices = topCards.map((c, idx) => ({ id: `${idx}`, label: c.name, card: c }));
          this.promptChoice(casterId, `Time Out: Choose the order to return cards to deck (First selected will be on top)`, choices, lookCount, lookCount, (selected) => {
            selected.forEach(idxStr => {
              const cardIdx = parseInt(idxStr, 10);
              player.deck.push(topCards[cardIdx]);
            });
            this.log(`Time Out: Returned ${lookCount} card(s) to top of deck.`);
            this.notifyStateChange();
          }, card);
        } else {
          for (let i = lookCount - 1; i >= 0; i--) {
            player.deck.push(topCards[i]);
          }
          this.log(`Time Out: AI returned ${lookCount} card(s) to top of deck.`);
          this.notifyStateChange();
        }
        break;
      }
      case 'Vanish': {
        const choices = [];
        opponent.creatures.forEach(c => choices.push({ id: `creatures-opponent-${c.instanceId}`, label: `${c.name} (Creature)`, card: c, type: 'creatures' }));
        opponent.characters.slice(1).forEach(c => choices.push({ id: `characters-opponent-${c.instanceId}`, label: `${c.name} (Character)`, card: c, type: 'characters' }));
        
        if (choices.length === 0) {
          this.log(`Vanish: Opponent has no Creatures or non-starting Characters in play.`);
          break;
        }

        if (casterId === 'player' || this.isMultiplayer) {
          this.promptChoice(casterId, "Vanish: Choose 1 Creature or non-starting Character to put on bottom of deck", choices, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const found = choices.find(t => t.id === sel);
              if (found) {
                const idx = opponent[found.type].findIndex(c => c.instanceId === found.card.instanceId);
                if (idx !== -1) {
                  opponent[found.type].splice(idx, 1);
                  opponent.deck.unshift(found.card);
                  this.log(`Vanish: Put opponent's ${found.card.name} on the bottom of their deck.`);
                  this.notifyStateChange();
                }
              }
            }
          }, card);
        } else {
          const found = choices[0];
          const idx = opponent[found.type].findIndex(c => c.instanceId === found.card.instanceId);
          if (idx !== -1) {
            opponent[found.type].splice(idx, 1);
            opponent.deck.unshift(found.card);
            this.log(`Vanish: AI put your ${found.card.name} on the bottom of your deck.`);
            this.notifyStateChange();
          }
        }
        break;
      }
      
      case 'Wizard Crackers': {
        if (player.deck.length === 0) {
          this.log(`No cards in deck to reveal.`);
          break;
        }
        const card = player.deck.pop();
        this.log(`Revealed card: ${card.name}`);
        if (card.type === 'Lesson') {
          player.lessons.push(card);
          this.log(`Put Lesson into play: ${card.name}`);
        } else {
          player.hand.push(card);
          this.log(`Put ${card.name} into hand.`);
        }
        break;
      }
      case 'Beater Grabs the Snitch': {
        const matchesInPlay = [];
        if (player.matches.length > 0) {
          matchesInPlay.push({ id: `match-player`, label: `${player.matches[0].name} (Your Match)`, card: player.matches[0], ownerId: playerId });
        }
        if (opponent.matches.length > 0) {
          matchesInPlay.push({ id: `match-opponent`, label: `${opponent.matches[0].name} (Opponent's Match)`, card: opponent.matches[0], ownerId: opponentId });
        }
        if (matchesInPlay.length > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            this.promptChoice(casterId, "Beater Grabs the Snitch: Choose a Match in play to return to hand", matchesInPlay, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const found = matchesInPlay.find(t => t.id === sel);
                if (found) {
                  const owner = this.players[found.ownerId];
                  owner.matches = [];
                  owner.hand.push(found.card);
                  this.log(`Beater Grabs the Snitch: Returned ${found.card.name} to ${owner.name}'s hand.`);
                  this.notifyStateChange();
                }
              }
            });
          } else {
            const target = matchesInPlay[0];
            const owner = this.players[target.ownerId];
            owner.matches = [];
            owner.hand.push(target.card);
            this.log(`Beater Grabs the Snitch: AI returned ${target.card.name} to ${owner.name}'s hand.`);
          }
        }
        break;
      }

      case 'Christmas Feast': {
        const nonHealingItems = player.discardPile.filter(c => c.type === 'Item' && !c.subTypes?.includes('Healing'));
        const maxTake = Math.min(4, nonHealingItems.length);
        if (nonHealingItems.length > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            const choices = nonHealingItems.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(casterId, `Christmas Feast: Choose up to ${maxTake} non-Healing Item cards to return to hand`, choices, 0, maxTake, (selected) => {
              selected.forEach(selId => {
                const idx = player.discardPile.findIndex(c => c.instanceId === selId);
                if (idx !== -1) {
                  const [retrieved] = player.discardPile.splice(idx, 1);
                  player.hand.push(retrieved);
                  this.log(`Christmas Feast: Returned ${retrieved.name} to hand.`);
                }
              });
              this.notifyStateChange();
            });
          } else {
            const toMove = nonHealingItems.slice(0, maxTake);
            toMove.forEach(c => {
              player.discardPile.splice(player.discardPile.indexOf(c), 1);
              player.hand.push(c);
              this.log(`Christmas Feast: AI returned ${c.name} to hand.`);
            });
          }
        }
        break;
      }

      case "Good Night's Sleep": {
        const eligible = player.characters.filter(c => player.usedOncePerGameAbilities && player.usedOncePerGameAbilities[c.name]);
        if (eligible.length > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            const choices = eligible.map(c => ({ id: c.instanceId, label: `${c.name} (Reset once-per-game ability)`, card: c }));
            this.promptChoice(casterId, "Good Night's Sleep: Choose a Character to reset their once-per-game ability", choices, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const found = eligible.find(c => c.instanceId === sel);
                if (found) {
                  player.usedOncePerGameAbilities[found.name] = false;
                  this.log(`Good Night's Sleep: Reset once-per-game ability of ${found.name}.`);
                  this.notifyStateChange();
                }
              }
            });
          } else {
            const target = eligible[0];
            player.usedOncePerGameAbilities[target.name] = false;
            this.log(`Good Night's Sleep: AI reset once-per-game ability of ${target.name}.`);
          }
        }
        break;
      }

      case 'Gringotts Vault Key': {
        if (player.deck.length > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            const choices = player.deck.map(c => ({ id: c.instanceId, label: `${c.name} (${c.type})`, card: c }));
            this.promptChoice(casterId, "Gringotts Vault Key: Choose any card from your deck to take", choices, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const idx = player.deck.findIndex(c => c.instanceId === sel);
                if (idx !== -1) {
                  const [c] = player.deck.splice(idx, 1);
                  player.hand.push(c);
                  this.log(`Gringotts Vault Key: Took ${c.name} from deck.`);
                }
              }
              this.shuffle(player.deck);
              this.notifyStateChange();
            });
          } else {
            const [c] = player.deck.splice(0, 1);
            player.hand.push(c);
            this.log(`Gringotts Vault Key: AI took a card from deck.`);
            this.shuffle(player.deck);
          }
        }
        break;
      }

      case 'Table Trouble': {
        const pItems = player.items.splice(0);
        const oItems = opponent.items.splice(0);
        player.discardPile.push(...pItems);
        opponent.discardPile.push(...oItems);
        this.log(`Table Trouble: Discarded all Items from play (${pItems.length + oItems.length} total).`);
        break;
      }

      case 'Vanishing Referee': {
        const eligible = [];
        player.characters.forEach(c => {
          if (c.instanceId !== 'player-starting-char' && !c.subTypes?.includes('Healing')) {
            eligible.push({ id: `char-player-${c.instanceId}`, label: `${c.name} (Your Character)`, card: c, ownerId: playerId });
          }
        });
        opponent.characters.forEach(c => {
          if (c.instanceId !== 'opponent-starting-char' && !c.subTypes?.includes('Healing')) {
            eligible.push({ id: `char-opponent-${c.instanceId}`, label: `${c.name} (Opponent's Character)`, card: c, ownerId: opponentId });
          }
        });
        if (eligible.length > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            this.promptChoice(casterId, "Vanishing Referee: Choose a Character to shuffle into deck", eligible, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const found = eligible.find(t => t.id === sel);
                if (found) {
                  const owner = this.players[found.ownerId];
                  owner.characters = owner.characters.filter(c => c.instanceId !== found.card.instanceId);
                  owner.deck.push(found.card);
                  this.shuffle(owner.deck);
                  this.log(`Vanishing Referee: Shuffled ${found.card.name} into ${owner.name}'s deck.`);
                  this.notifyStateChange();
                }
              }
            });
          } else {
            const target = eligible[0];
            const owner = this.players[target.ownerId];
            owner.characters = owner.characters.filter(c => c.instanceId !== target.card.instanceId);
            owner.deck.push(target.card);
            this.shuffle(owner.deck);
            this.log(`Vanishing Referee: AI shuffled ${target.card.name} into ${owner.name}'s deck.`);
          }
        }
        break;
      }

      case 'Alihotsy Draught': {
        const choices = [{ id: 'damage', label: 'Deal 6 damage to opponent' }];
        opponent.items.forEach(i => {
          choices.push({ id: `item-${i.instanceId}`, label: `Discard ${i.name}`, card: i });
        });
        if (casterId === 'player' || this.isMultiplayer) {
          this.promptChoice(casterId, "Alihotsy Draught: Choose effect", choices, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel === 'damage') {
              this.dealDamage(opponentId, 6, 'spell');
            } else if (sel && sel.startsWith('item-')) {
              const instId = sel.split('-').slice(1).join('-');
              const idx = opponent.items.findIndex(i => i.instanceId === instId);
              if (idx !== -1) {
                const [itemCard] = opponent.items.splice(idx, 1);
                opponent.discardPile.push(itemCard);
                this.log(`Alihotsy Draught: Discarded ${itemCard.name} from play.`);
              }
            }
          });
        } else {
          if (opponent.items.length > 0) {
            const [itemCard] = opponent.items.splice(0, 1);
            opponent.discardPile.push(itemCard);
            this.log(`Alihotsy Draught: AI discarded ${itemCard.name} from play.`);
          } else {
            this.dealDamage(opponentId, 6, 'spell');
          }
        }
        break;
      }

      case 'Biased Commentary': {
        player.biasedCommentaryActive = true;
        this.log(`Biased Commentary: Next Quidditch spell deals +5 damage.`);
        break;
      }

      case 'Colloshoo': {
        const itemsInHand = opponent.hand.filter(c => c.type === 'Item');
        if (casterId === 'player' || this.isMultiplayer) {
          const choices = opponent.hand.map(c => ({ id: c.instanceId, label: `${c.name} (${c.type})`, card: c, disabled: c.type !== 'Item' }));
          if (itemsInHand.length > 0) {
            this.promptChoice(casterId, `Colloshoo: Choose 1 Item card from ${opponent.name}'s hand to discard`, choices, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const idx = opponent.hand.findIndex(c => c.instanceId === sel);
                if (idx !== -1) {
                  const [discarded] = opponent.hand.splice(idx, 1);
                  opponent.discardPile.push(discarded);
                  this.log(`Colloshoo: Discarded ${discarded.name} from opponent's hand.`);
                  this.notifyStateChange();
                }
              }
            });
          } else {
            choices.push({ id: 'done', label: 'Acknowledge (Opponent has no Items in hand)' });
            this.promptChoice(casterId, `${opponent.name}'s Hand:`, choices, 1, 1, () => {});
          }
        } else {
          if (itemsInHand.length > 0) {
            const [discarded] = opponent.hand.splice(opponent.hand.indexOf(itemsInHand[0]), 1);
            opponent.discardPile.push(discarded);
            this.log(`Colloshoo: AI discarded ${discarded.name} from hand.`);
          }
        }
        break;
      }

      case 'Frog-Spawn': {
        player.preventAllCreatureDamageNextTurn = true;
        this.log(`Frog-Spawn: All damage to ${player.name}'s creatures will be prevented during opponent's turn.`);
        break;
      }

      case 'Injured': {
        const quidCards = opponent.hand.filter(c => c.lessonCost && c.lessonCost.type === 'Quidditch');
        if (casterId === 'player' || this.isMultiplayer) {
          const choices = opponent.hand.map(c => ({ id: c.instanceId, label: `${c.name} (${c.type})`, card: c, disabled: true }));
          choices.push({ id: 'done', label: `Acknowledge (${quidCards.length} Quidditch card(s) will be discarded)` });
          this.promptChoice(casterId, `${opponent.name}'s Hand:`, choices, 1, 1, () => {
            quidCards.forEach(c => {
              opponent.hand = opponent.hand.filter(h => h.instanceId !== c.instanceId);
              opponent.discardPile.push(c);
              this.log(`Injured: Discarded ${c.name} from opponent's hand.`);
            });
            this.notifyStateChange();
          });
        } else {
          quidCards.forEach(c => {
            opponent.hand = opponent.hand.filter(h => h.instanceId !== c.instanceId);
            opponent.discardPile.push(c);
            this.log(`Injured: AI discarded ${c.name} from your hand.`);
          });
        }
        break;
      }

      case 'Lapifors': {
        if (opponent.creatures.length > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            const choices = opponent.creatures.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(casterId, "Lapifors: Choose opponent's Creature to discard", choices, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const idx = opponent.creatures.findIndex(c => c.instanceId === sel);
                if (idx !== -1) {
                  const [c] = opponent.creatures.splice(idx, 1);
                  opponent.discardPile.push(c);
                  this.log(`Lapifors: Discarded opponent's creature ${c.name}.`);
                }
                const creaturesInDeck = player.deck.filter(c => c.type === 'Creature');
                if (creaturesInDeck.length > 0) {
                  const searchChoices = creaturesInDeck.map(c => ({ id: c.instanceId, label: c.name, card: c }));
                  this.promptChoice(casterId, "Lapifors: Search deck for a Creature card to take", searchChoices, 0, 1, (deckSel) => {
                    const dSel = deckSel[0];
                    if (dSel) {
                      const dIdx = player.deck.findIndex(c => c.instanceId === dSel);
                      if (dIdx !== -1) {
                        const [cInDeck] = player.deck.splice(dIdx, 1);
                        player.hand.push(cInDeck);
                        this.log(`Lapifors: Took Creature ${cInDeck.name} from deck.`);
                      }
                    }
                    this.shuffle(player.deck);
                    this.notifyStateChange();
                  });
                } else {
                  this.shuffle(player.deck);
                  this.notifyStateChange();
                }
              }
            });
          } else {
            const [c] = opponent.creatures.splice(0, 1);
            opponent.discardPile.push(c);
            this.log(`Lapifors: AI discarded creature ${c.name}.`);
            
            const creaturesInDeck = player.deck.filter(c => c.type === 'Creature');
            if (creaturesInDeck.length > 0) {
              const [cInDeck] = player.deck.splice(player.deck.indexOf(creaturesInDeck[0]), 1);
              player.hand.push(cInDeck);
              this.log(`Lapifors: AI took Creature ${cInDeck.name} from deck.`);
            }
            this.shuffle(player.deck);
          }
        }
        break;
      }

      case 'Practical Joke': {
        const count = player.items.length + opponent.items.length;
        this.log(`Practical Joke: Dealing ${count} damage to opponent (based on ${count} Items in play).`);
        this.dealDamage(opponentId, count, 'spell');
        break;
      }

      case 'Spiral Dive': {
        if (player.hand.length > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            const choices = player.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(casterId, "Spiral Dive: Choose any number of cards from hand to discard to deal that much damage", choices, 0, choices.length, (selected) => {
              selected.forEach(selId => {
                const idx = player.hand.findIndex(c => c.instanceId === selId);
                if (idx !== -1) {
                  const [c] = player.hand.splice(idx, 1);
                  player.discardPile.push(c);
                }
              });
              const dmg = selected.length;
              this.log(`Spiral Dive: Discarded ${dmg} card(s) to deal ${dmg} damage.`);
              if (dmg > 0) {
                this.dealDamage(opponentId, dmg, 'spell');
              }
              this.notifyStateChange();
            });
          } else {
            const count = Math.ceil(player.hand.length / 2);
            for (let i = 0; i < count; i++) {
              const [c] = player.hand.splice(0, 1);
              player.discardPile.push(c);
            }
            this.log(`Spiral Dive: AI discarded ${count} card(s) to deal ${count} damage.`);
            this.dealDamage(opponentId, count, 'spell');
          }
        }
        break;
      }

      case 'Verdillious': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (5 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 5 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 5 Damage)`, card: c }));
        if (casterId === 'player' || this.isMultiplayer) {
          this.promptChoice(casterId, "Verdillious: Choose target for 5 damage", choices, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel === 'opponent') {
              this.dealDamage(opponentId, 5, 'spell');
            } else if (sel && sel.startsWith('creature-')) {
              const parts = sel.split('-');
              const owner = parts[1];
              const instId = parts.slice(2).join('-');
              this.damageCreature(owner, instId, 5);
            }
          });
        } else {
          this.dealDamage(opponentId, 5, 'spell');
        }
        break;
      }

      case 'Bludger in the Stands': {
        this.log(`Bludger in the Stands: Dealing 4 damage to opponent.`);
        this.dealDamage(opponentId, 4, 'spell');
        if (opponent.items.length > 0) {
          if (opponentId === 'player' || this.isMultiplayer) {
            const choices = opponent.items.map(i => ({ id: i.instanceId, label: i.name, card: i }));
            this.promptChoice(opponentId, "Bludger in the Stands: Choose 1 of your Items in play to discard", choices, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const idx = opponent.items.findIndex(i => i.instanceId === sel);
                if (idx !== -1) {
                  const [c] = opponent.items.splice(idx, 1);
                  opponent.discardPile.push(c);
                  this.log(`Bludger in the Stands: Opponent discarded ${c.name}.`);
                  this.notifyStateChange();
                }
              }
            });
          } else {
            const [c] = opponent.items.splice(0, 1);
            opponent.discardPile.push(c);
            this.log(`Bludger in the Stands: AI discarded ${c.name}.`);
          }
        }
        break;
      }

      case 'Blue Wig': {
        this.dealDamage(opponentId, 4, 'spell');
        this.drawCard(casterId);
        break;
      }

      case 'Butterfly Weed Balm': {
        const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
        const maxTake = Math.min(9, nonHealing.length);
        if (nonHealing.length > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            const choices = nonHealing.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(casterId, `Butterfly Weed Balm: Choose up to ${maxTake} non-Healing cards to shuffle into deck`, choices, 0, maxTake, (selected) => {
              selected.forEach(selId => {
                const idx = player.discardPile.findIndex(c => c.instanceId === selId);
                if (idx !== -1) {
                  const [c] = player.discardPile.splice(idx, 1);
                  player.deck.push(c);
                }
              });
              this.shuffle(player.deck);
              this.log(`Butterfly Weed Balm: Shuffled ${selected.length} cards into deck.`);
              this.notifyStateChange();
            });
          } else {
            const toShuffle = nonHealing.slice(0, maxTake);
            toShuffle.forEach(c => {
              player.discardPile.splice(player.discardPile.indexOf(c), 1);
              player.deck.push(c);
            });
            this.shuffle(player.deck);
            this.log(`Butterfly Weed Balm: AI shuffled ${toShuffle.length} cards into deck.`);
          }
        }
        break;
      }

      case 'Cancelled Practice': {
        const qLessons = opponent.lessons.filter(l => (l.provides?.type || l.lessonType) === 'Quidditch');
        if (qLessons.length > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            const choices = qLessons.map(l => ({ id: `lesson-${opponentId}-${l.instanceId}`, label: l.name, card: l }));
            this.promptChoice(casterId, "Cancelled Practice: Choose opponent's Quidditch Lesson to discard", choices, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const instId = sel.split('-').slice(2).join('-');
                const idx = opponent.lessons.findIndex(l => l.instanceId === instId);
                if (idx !== -1) {
                  const [l] = opponent.lessons.splice(idx, 1);
                  opponent.discardPile.push(l);
                  this.log(`Cancelled Practice: Discarded opponent's ${l.name} from play.`);
                  this.notifyStateChange();
                }
              }
            });
          } else {
            const [l] = opponent.lessons.splice(opponent.lessons.indexOf(qLessons[0]), 1);
            opponent.discardPile.push(l);
            this.log(`Cancelled Practice: AI discarded opponent's ${l.name}.`);
          }
        }
        break;
      }

      case 'Dogbane Potion': {
        if (opponent.creatures.length > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            const choices = opponent.creatures.map(c => ({ id: c.instanceId, label: `${c.name} (3 damage)`, card: c }));
            this.promptChoice(casterId, "Dogbane Potion: Choose opponent's creature to deal 3 damage to", choices, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                this.damageCreature(opponentId, sel, 3);
                this.notifyStateChange();
              }
            });
          } else {
            const [c] = opponent.creatures;
            this.damageCreature(opponentId, c.instanceId, 3);
          }
        }
        break;
      }

      case 'Dog Biscuits': {
        const creaturesWithDmg = player.creatures.filter(c => c.damage > 0);
        if (creaturesWithDmg.length > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            const choices = creaturesWithDmg.map(c => ({ id: c.instanceId, label: `${c.name} (${c.damage} damage)`, card: c }));
            this.promptChoice(casterId, "Dog Biscuits: Choose 1 of your Creatures to heal", choices, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const found = player.creatures.find(c => c.instanceId === sel);
                if (found) {
                  found.damage = 0;
                  this.log(`Dog Biscuits: Healed all damage on ${found.name}.`);
                }
              }
              this.drawCard(casterId);
              this.notifyStateChange();
            });
          } else {
            const c = creaturesWithDmg[0];
            c.damage = 0;
            this.log(`Dog Biscuits: AI healed all damage on ${c.name}.`);
            this.drawCard(casterId);
          }
        } else {
          this.log(`Dog Biscuits: No damaged creatures in play.`);
          this.drawCard(casterId);
        }
        break;
      }

      case 'Flipendo': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (2 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature - 2 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 2 Damage)`, card: c }));
        if (casterId === 'player' || this.isMultiplayer) {
          this.promptChoice(casterId, "Flipendo: Choose target for 2 damage", choices, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel === 'opponent') {
              this.dealDamage(opponentId, 2, 'spell');
            } else if (sel && sel.startsWith('creature-')) {
              const parts = sel.split('-');
              const owner = parts[1];
              const instId = parts.slice(2).join('-');
              this.damageCreature(owner, instId, 2);
            }
          });
        } else {
          this.dealDamage(opponentId, 2, 'spell');
        }
        break;
      }

      case 'Freeze!': {
        if (opponent.creatures.length > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            const choices = opponent.creatures.map(c => ({ id: c.instanceId, label: `${c.name} (4 damage)`, card: c }));
            this.promptChoice(casterId, "Freeze!: Choose opponent's creature to deal 4 damage to", choices, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                this.damageCreature(opponentId, sel, 4);
                this.notifyStateChange();
              }
            });
          } else {
            const [c] = opponent.creatures;
            this.damageCreature(opponentId, c.instanceId, 4);
          }
        }
        break;
      }

      case 'Mid-air Collision': {
        this.dealDamage(opponentId, 10, 'spell');
        const eligible = [];
        player.lessons.forEach(l => eligible.push({ id: `lessons-${l.instanceId}`, label: `${l.name} (Lesson)`, card: l, source: 'lessons' }));
        player.creatures.forEach(c => eligible.push({ id: `creatures-${c.instanceId}`, label: `${c.name} (Creature)`, card: c, source: 'creatures' }));
        player.items.forEach(i => eligible.push({ id: `items-${i.instanceId}`, label: `${i.name} (Item)`, card: i, source: 'items' }));
        player.locations.forEach(l => eligible.push({ id: `locations-${l.instanceId}`, label: `${l.name} (Location)`, card: l, source: 'locations' }));
        player.characters.forEach(c => {
          if (c.instanceId !== 'player-starting-char') {
            eligible.push({ id: `characters-${c.instanceId}`, label: `${c.name} (Character)`, card: c, source: 'characters' });
          }
        });
        player.adventures.forEach(a => eligible.push({ id: `adventures-${a.instanceId}`, label: `${a.name} (Adventure)`, card: a, source: 'adventures' }));
        player.matches.forEach(m => eligible.push({ id: `matches-${m.instanceId}`, label: `${m.name} (Match)`, card: m, source: 'matches' }));
        
        if (eligible.length > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            this.promptChoice(casterId, "Mid-air Collision: Choose 1 of your cards in play to discard", eligible, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const parts = sel.split('-');
                const type = parts[0];
                const instId = parts.slice(1).join('-');
                const idx = player[type].findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = player[type].splice(idx, 1);
                  player.discardPile.push(c);
                  this.log("Mid-air Collision: Discarded " + c.name + " from play.");
                  this.notifyStateChange();
                }
              }
            });
          } else {
            const target = eligible[0];
            const idx = player[target.source].findIndex(c => c.instanceId === target.card.instanceId);
            if (idx !== -1) {
              const [c] = player[target.source].splice(idx, 1);
              player.discardPile.push(c);
              this.log("Mid-air Collision: AI discarded " + c.name + " from play.");
            }
          }
        }
        break;
      }

      case 'Picking on Neville': {
        const eligible = [];
        opponent.lessons.forEach(l => eligible.push({ id: `lessons-${l.instanceId}`, label: `${l.name} (Lesson)`, card: l, source: 'lessons' }));
        opponent.creatures.forEach(c => eligible.push({ id: `creatures-${c.instanceId}`, label: `${c.name} (Creature)`, card: c, source: 'creatures' }));
        opponent.items.forEach(i => eligible.push({ id: `items-${i.instanceId}`, label: `${i.name} (Item)`, card: i, source: 'items' }));
        opponent.locations.forEach(l => eligible.push({ id: `locations-${l.instanceId}`, label: `${l.name} (Location)`, card: l, source: 'locations' }));
        opponent.characters.forEach(c => {
          if (c.instanceId !== 'opponent-starting-char' && c.instanceId !== 'player-starting-char') {
            eligible.push({ id: `characters-${c.instanceId}`, label: `${c.name} (Character)`, card: c, source: 'characters' });
          }
        });
        opponent.adventures.forEach(a => eligible.push({ id: `adventures-${a.instanceId}`, label: `${a.name} (Adventure)`, card: a, source: 'adventures' }));
        opponent.matches.forEach(m => eligible.push({ id: `matches-${m.instanceId}`, label: `${m.name} (Match)`, card: m, source: 'matches' }));

        if (eligible.length > 0) {
          const handleTargetSelection = (selected) => {
            const sel = selected[0];
            if (!sel) return;
            const parts = sel.split('-');
            const type = parts[0];
            const instId = parts.slice(1).join('-');
            const targetCard = opponent[type].find(c => c.instanceId === instId);
            if (!targetCard) return;

            const preventEligible = eligible.filter(e => e.card.instanceId !== targetCard.instanceId);

            const oppChoices = [
              { id: 'allow', label: "Allow " + targetCard.name + " to be discarded" }
            ];
            if (preventEligible.length >= 2) {
              oppChoices.push({ id: 'discard2', label: 'Discard 2 other cards from play to prevent' });
            }

            this.promptChoice(opponentId, "Picking on Neville! Prevent discard of " + targetCard.name + "?", oppChoices, 1, 1, (oppSel) => {
              if (oppSel[0] === 'discard2') {
                this.promptChoice(opponentId, "Picking on Neville: Choose 2 of your cards to discard to prevent", preventEligible, 2, 2, (toDisc) => {
                  toDisc.forEach(discId => {
                    const dParts = discId.split('-');
                    const dType = dParts[0];
                    const dInstId = dParts.slice(1).join('-');
                    const dIdx = opponent[dType].findIndex(c => c.instanceId === dInstId);
                    if (dIdx !== -1) {
                      const [c] = opponent[dType].splice(dIdx, 1);
                      opponent.discardPile.push(c);
                      this.log("Picking on Neville: " + opponent.name + " discarded " + c.name + " to prevent.");
                    }
                  });
                  this.notifyStateChange();
                });
              } else {
                const idx = opponent[type].findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = opponent[type].splice(idx, 1);
                  opponent.discardPile.push(c);
                  this.log("Picking on Neville: Discarded " + c.name + " from " + opponent.name + "'s playmat.");
                  this.notifyStateChange();
                }
              }
            });
          };

          if (casterId === 'player' || this.isMultiplayer) {
            this.promptChoice(casterId, "Picking on Neville: Choose opponent's card in play to discard", eligible, 1, 1, handleTargetSelection);
          } else {
            const selected = this.aiChoose(eligible, 1, 1);
            handleTargetSelection(selected);
          }
        }
        break;
      }

      case 'Pigley Dudley': {
        const eligible = [];
        opponent.creatures.forEach(c => eligible.push({ id: `creatures-${c.instanceId}`, label: `${c.name} (Creature)`, card: c, source: 'creatures' }));
        opponent.characters.forEach(c => {
          if (c.instanceId !== 'opponent-starting-char') {
            eligible.push({ id: `characters-${c.instanceId}`, label: `${c.name} (Character)`, card: c, source: 'characters' });
          }
        });
        if (eligible.length > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            this.promptChoice(casterId, "Pigley Dudley: Choose Creature/Character to put on top of deck", eligible, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const parts = sel.split('-');
                const type = parts[0];
                const instId = parts.slice(1).join('-');
                const idx = opponent[type].findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = opponent[type].splice(idx, 1);
                  if (c.damage) c.damage = 0;
                  opponent.deck.push(c);
                  this.log(`Pigley Dudley: Put ${c.name} on top of opponent's deck.`);
                  this.notifyStateChange();
                }
              }
            });
          } else {
            const target = eligible[0];
            const idx = opponent[target.source].findIndex(c => c.instanceId === target.card.instanceId);
            if (idx !== -1) {
              const [c] = opponent[target.source].splice(idx, 1);
              if (c.damage) c.damage = 0;
              opponent.deck.push(c);
              this.log("Pigley Dudley: AI put your " + c.name + " on top of your deck.");
            }
          }
        }
        break;
      }

      case 'Quick Thinking': {
        const choices = [
          { id: 'damage', label: 'Deal 3 damage to opponent' },
          { id: 'draw', label: 'Draw 3 cards' }
        ];
        if (casterId === 'player' || this.isMultiplayer) {
          this.promptChoice(casterId, "Quick Thinking: Choose effect", choices, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel === 'damage') {
              this.dealDamage(opponentId, 3, 'spell');
            } else {
              this.drawCard(casterId);
              this.drawCard(casterId);
              this.drawCard(casterId);
            }
            this.notifyStateChange();
          });
        } else {
          this.drawCard(casterId);
          this.drawCard(casterId);
          this.drawCard(casterId);
        }
        break;
      }

      case 'Sloth Grip': {
        player.slothGripActive = true;
        this.log(`Sloth Grip: Prevent all but the first 3 damage to ${player.name} during opponent's turn.`);
        break;
      }

      case 'Spongify': {
        const eligible = [];
        player.items.forEach(i => {
          if (!i.subTypes?.includes('Healing')) {
            eligible.push({ id: `item-player-${i.instanceId}`, label: `${i.name} (Your Item)`, card: i, ownerId: playerId });
          }
        });
        opponent.items.forEach(i => {
          if (!i.subTypes?.includes('Healing')) {
            eligible.push({ id: `item-opponent-${i.instanceId}`, label: `${i.name} (Opponent's Item)`, card: i, ownerId: opponentId });
          }
        });
        if (eligible.length > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            this.promptChoice(casterId, "Spongify: Choose a non-Healing Item to return to hand", eligible, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const found = eligible.find(t => t.id === sel);
                if (found) {
                  const owner = this.players[found.ownerId];
                  owner.items = owner.items.filter(i => i.instanceId !== found.card.instanceId);
                  owner.hand.push(found.card);
                  this.log("Spongify: Returned " + found.card.name + " to " + owner.name + "'s hand.");
                }
              }
              this.drawCard(casterId);
              this.notifyStateChange();
            });
          } else {
            const target = eligible[0];
            const owner = this.players[target.ownerId];
            owner.items = owner.items.filter(i => i.instanceId !== target.card.instanceId);
            owner.hand.push(target.card);
            this.log("Spongify: AI returned " + target.card.name + " to " + owner.name + "'s hand.");
            this.drawCard(casterId);
          }
        } else {
          this.log(`Spongify: No eligible Items in play to return.`);
          this.drawCard(casterId);
        }
        break;
      }

      case 'Swelling Potion': {
        this.dealDamage(opponentId, 5, 'spell');
        opponent.cantPlayItemsNextTurn = true;
        this.log(`Swelling Potion: Opponent cannot play Item cards during their next turn.`);
        break;
      }

      case 'Teacup to Rat': {
        if (opponent.items.length > 0) {
          if (casterId === 'player' || this.isMultiplayer) {
            const choices = opponent.items.map(i => ({ id: i.instanceId, label: i.name, card: i }));
            this.promptChoice(casterId, "Teacup to Rat: Choose opponent's Item to discard", choices, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const idx = opponent.items.findIndex(i => i.instanceId === sel);
                if (idx !== -1) {
                  const [c] = opponent.items.splice(idx, 1);
                  opponent.discardPile.push(c);
                  this.log("Teacup to Rat: Discarded opponent's " + c.name + ".");
                }
              }
              this.drawCard(casterId);
              this.notifyStateChange();
            });
          } else {
            const [c] = opponent.items.splice(0, 1);
            opponent.discardPile.push(c);
            this.log("Teacup to Rat: AI discarded opponent's " + c.name + ".");
            this.drawCard(casterId);
          }
        } else {
          this.log(`Teacup to Rat: Opponent has no Items in play.`);
          this.drawCard(casterId);
        }
        break;
      }
    }

      this.notifyStateChange();
    } finally {
      this.currentlyResolvingSpell = null;
    }
  }

  // Discard a creature from play (with Scabbers return-to-hand check)
  discardCreature(ownerId, creatureInstanceId) {
    const owner = this.players[ownerId];
    const index = owner.creatures.findIndex(c => c.instanceId === creatureInstanceId);
    if (index === -1) return null;
    const [creature] = owner.creatures.splice(index, 1);
    
    // Clear damage when leaving play
    creature.damage = 0;

    const opponentId = ownerId === 'player' ? 'opponent' : 'player';
    if (creature.name === 'Scabbers' && this.activePlayerId === opponentId) {
      owner.hand.push(creature);
      this.log(`Scabbers: Returned to ${owner.name}'s hand because it was discarded from play during opponent's turn.`);
    } else {
      this.discardCardFromPlay(ownerId, creature);
    }
    return creature;
  }

  // Deal damage to a creature
  damageCreature(ownerId, creatureInstanceId, amount) {
    const targetPlayer = this.players[ownerId];
    if (targetPlayer.preventAllCreatureDamageNextTurn && this.activePlayerId !== ownerId) {
      this.log(`Frog-Spawn: All damage to ${targetPlayer.name}'s creatures is prevented.`);
      return;
    }
    const index = targetPlayer.creatures.findIndex(c => c.instanceId === creatureInstanceId);
    if (index === -1) return;
    const creature = targetPlayer.creatures[index];
    const isMadamMalkinActive = this.players.player.locations.some(l => l.name === "Madam Malkin's Robes") ||
                                 this.players.opponent.locations.some(l => l.name === "Madam Malkin's Robes");
    if (isMadamMalkinActive && amount > 0) {
      amount = Math.max(0, amount - 1);
      this.log(`Madam Malkin's Robes: Creature damage reduced by 1 (deals ${amount} total).`);
    }
    const maxHealth = this.getCreatureHealth ? this.getCreatureHealth(creature) : creature.health;
    creature.damage = (creature.damage || 0) + amount;
    this.log(`${creature.name} takes ${amount} damage! (${creature.damage}/${maxHealth})`, 'damage');
    
    if (creature.damage >= maxHealth) {
      this.log(`${creature.name} was defeated!`, 'damage');
      this.discardCreature(ownerId, creatureInstanceId);
    }
    this.notifyStateChange();
  }

  // Set pending spell for targeting choice
  promptChoice(casterId, title, choices, minChoices, maxChoices, callback, card = null) {
    if (!card && this.currentlyResolvingSpell) {
      card = this.currentlyResolvingSpell;
    }
    if (casterId === 'player' || (this.isMultiplayer && casterId === 'opponent')) {
      this.pendingSpell = {
        casterId,
        title,
        choices,
        minChoices,
        maxChoices,
        callback,
        card
      };
      this.notifyStateChange();
    } else {
      const selected = this.aiChoose(choices, minChoices, maxChoices);
      callback(selected);
    }
  }

  // Simple AI target selection
  aiChoose(choices, minChoices, maxChoices) {
    if (!choices || choices.length === 0) return [];
    
    // Special case: Draw reward maximum select
    const drawOpt = choices.find(c => c.id && c.id.startsWith('draw-'));
    if (drawOpt) {
      let maxDrawOpt = drawOpt;
      let maxVal = -1;
      choices.forEach(c => {
        if (c.id && c.id.startsWith('draw-')) {
          const val = parseInt(c.id.split('-')[1], 10);
          if (val > maxVal) {
            maxVal = val;
            maxDrawOpt = c;
          }
        }
      });
      return [maxDrawOpt.id];
    }
    
    // Special case: Prevent spell damage using cloak or ingredients
    const preventOpt = choices.find(c => c.id && c.id.startsWith('prevent-'));
    if (preventOpt) {
      return [preventOpt.id];
    }

    // Special case: Redirect spell damage to creature
    const redirectOpt = choices.find(c => c.id && c.id.startsWith('redirect-'));
    if (redirectOpt) {
      return [redirectOpt.id];
    }

    // Sort or filter: prefer opponent or opponent's cards
    const opponentOpt = choices.find(c => c.id === 'opponent');
    const result = [];
    if (opponentOpt) {
      result.push(opponentOpt.id);
    }
    
    const targetCount = maxChoices || minChoices || 1;
    for (let i = 0; i < choices.length; i++) {
      if (result.length >= targetCount) break;
      const id = choices[i].id;
      if (!result.includes(id)) {
        result.push(id);
      }
    }
    return result;
  }

  // Resolve pending spell targets from UI
  resolvePendingSpell(selectedIds) {
    if (!this.pendingSpell) return;
    const { callback, card } = this.pendingSpell;
    this.currentlyResolvingSpell = card;
    try {
      this.pendingSpell = null;
      callback(selectedIds);
      this.notifyStateChange();
    } finally {
      this.currentlyResolvingSpell = null;
    }
  }

  cancelPendingSpell(playerId) {
    if (!this.pendingSpell) return;
    const { casterId, card } = this.pendingSpell;
    if (casterId === playerId && card) {
      const player = this.players[playerId];
      player.discardPile = player.discardPile.filter(c => c.instanceId !== card.instanceId);
      player.hand.push(card);
      this.actionsRemaining++;
      this.log(`Canceled casting ${card.name}. Card and action refunded.`);
    }
    this.pendingSpell = null;
    this.notifyStateChange();
  }

  // Check if a character card's ability can be activated
  canActivateCharacterAbility(playerId, character) {
    if (this.gameOver) return false;
    if (this.activePlayerId !== playerId) return false;
    if (this.actionsRemaining < 0) return false;
    
    const player = this.players[playerId];
    if (player.mustDrawFirstAction) return false;
    if (player.adventures.some(a => a.name === 'Letters From No One')) return false;
    
    // Once per game checks
    const oncePerGameAbilities = ['Dean Thomas', 'Hannah Abbott', 'Nearly Headless Nick', 'Professor Filius Flitwick', 'Professor Severus Snape', 'Marcus Flint', 'Madam Rolanda Hooch', 'Prof. Minerva McGonagall', 'Griphook', 'Hermione, Top Student', 'Professor Quirinus Quirrell', 'Madam Pomfrey', 'Peeves'];
    if (oncePerGameAbilities.includes(character.name) && player.usedOncePerGameAbilities[character.name]) {
      return false;
    }

    if (character.name === 'Draco Malfoy') {
      return this.actionsRemaining >= 1 && player.hand.length >= 1;
    }

    if (character.name === 'Hannah Abbott') {
      const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
      return player.hand.length >= 2 && nonHealing.length >= 2;
    }

    if (character.name === 'Professor Filius Flitwick') {
      const charmsCards = player.discardPile.filter(c => c.lessonCost?.type === 'Charms');
      return player.hand.length >= 2 && charmsCards.length >= 1;
    }

    if (character.name === 'Marcus Flint') {
      return true;
    }

    if (character.name === 'Madam Rolanda Hooch') {
      return player.deck.some(c => c.subTypes?.includes('Broom'));
    }

    if (character.name === 'Prof. Minerva McGonagall') {
      return player.adventures.length > 0;
    }

    if (character.name === 'Seamus Finnigan') {
      return !player.usedOncePerTurnAbilities?.[character.name] && player.hand.length >= 2;
    }

    if (character.name === 'Griphook') {
      return this.actionsRemaining >= 1;
    }

    if (character.name === 'Hagrid, Keeper of Keys') {
      return this.actionsRemaining >= 1 && player.deck.length > 0;
    }

    if (character.name === 'Hermione, Top Student') {
      return this.actionsRemaining >= 1 && player.deck.length > 0;
    }

    if (character.name === 'Lee Jordan') {
      return this.actionsRemaining >= 1 && player.deck.length > 0;
    }

    if (character.name === 'Madam Irma Pince') {
      const booksInDiscard = player.discardPile.filter(c => c.subTypes && c.subTypes.includes('Book') && c.type !== 'Lesson');
      return this.actionsRemaining >= 1 && booksInDiscard.length > 0;
    }

    if (character.name === 'Professor Quirinus Quirrell') {
      return this.actionsRemaining >= 1;
    }

    if (character.name === 'Argus Filch') {
      const adventuresInPlay = [...this.players.player.adventures, ...this.players.opponent.adventures];
      return this.actionsRemaining >= 1 && adventuresInPlay.length > 0;
    }

    if (character.name === 'Crabbe & Goyle') {
      return this.actionsRemaining >= 1 && player.hand.length >= 2;
    }

    if (character.name === 'Madam Pomfrey') {
      const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
      return this.actionsRemaining >= 1 && nonHealing.length > 0;
    }

    if (character.name === 'Peeves') {
      return this.actionsRemaining >= 1;
    }

    if (character.name === 'The Fat Lady') {
      const gryffindorInDeck = player.deck.some(c => c.subTypes?.includes('Gryffindor') || c.text?.includes('Gryffindor') || c.name.includes('Gryffindor'));
      return this.actionsRemaining >= 1 && gryffindorInDeck;
    }

    const activeAbilities = ['Dean Thomas', 'Draco Malfoy', 'Hannah Abbott', 'Nearly Headless Nick', 'Professor Filius Flitwick', 'Professor Severus Snape', 'Marcus Flint', 'Madam Rolanda Hooch', 'Prof. Minerva McGonagall', 'Seamus Finnigan', 'Griphook', 'Hagrid, Keeper of Keys', 'Hermione, Top Student', 'Lee Jordan', 'Madam Irma Pince', 'Professor Quirinus Quirrell', 'Argus Filch', 'Crabbe & Goyle', 'Madam Pomfrey', 'Peeves', 'The Fat Lady'];
    return activeAbilities.includes(character.name);
  }

  // Activate a character card's ability
  activateCharacterAbility(playerId, characterInstanceId) {
    const player = this.players[playerId];
    const opponent = this.players[playerId === 'player' ? 'opponent' : 'player'];
    const opponentId = opponent.id;

    const charCard = player.characters.find(c => c.instanceId === characterInstanceId);
    if (!charCard || !this.canActivateCharacterAbility(playerId, charCard)) return;

    switch (charCard.name) {
      case 'Argus Filch': {
        const adventuresInPlay = [];
        player.adventures.forEach(a => adventuresInPlay.push({ id: `${playerId}-adventures-${a.instanceId}`, label: `${a.name} (Your Adventure)`, card: a, ownerId: playerId }));
        opponent.adventures.forEach(a => adventuresInPlay.push({ id: `${opponentId}-adventures-${a.instanceId}`, label: `${a.name} (Opponent's Adventure)`, card: a, ownerId: opponentId }));
        
        if (playerId === 'player' || this.isMultiplayer) {
          this.promptChoice(playerId, "Argus Filch: Choose an Adventure in play to discard", adventuresInPlay, 1, 1, (selected) => {
            const sel = selected[0];
            const item = adventuresInPlay.find(x => x.id === sel);
            if (item) {
              const targetPlayer = this.players[item.ownerId];
              const idx = targetPlayer.adventures.findIndex(a => a.instanceId === item.card.instanceId);
              if (idx !== -1) {
                const [c] = targetPlayer.adventures.splice(idx, 1);
                targetPlayer.discardPile.push(c);
                this.actionsRemaining--;
                this.log(`Argus Filch: Discarded ${c.name} from play without reward.`);
              }
            }
            this.notifyStateChange();
          }, charCard);
        } else {
          const item = adventuresInPlay[0];
          if (item) {
            const targetPlayer = this.players[item.ownerId];
            const idx = targetPlayer.adventures.findIndex(a => a.instanceId === item.card.instanceId);
            if (idx !== -1) {
              const [c] = targetPlayer.adventures.splice(idx, 1);
              targetPlayer.discardPile.push(c);
              this.actionsRemaining--;
              this.log(`Argus Filch: AI discarded ${c.name} from play.`);
            }
          }
        }
        break;
      }

      case 'Crabbe & Goyle': {
        const handChoices = player.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        if (playerId === 'player' || this.isMultiplayer) {
          this.promptChoice(playerId, "Crabbe & Goyle: Choose 2 cards from hand to discard", handChoices, 2, 2, (selected) => {
            if (selected.length === 2) {
              selected.forEach(instId => {
                const idx = player.hand.findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = player.hand.splice(idx, 1);
                  player.discardPile.push(c);
                }
              });
              this.actionsRemaining--;
              this.log(`Crabbe & Goyle: Discarded 2 cards and dealt 3 damage to ${opponent.name}.`);
              this.dealDamage(opponentId, 3, 'spell');
              this.notifyStateChange();
            }
          }, charCard);
        } else {
          for (let i = 0; i < 2; i++) {
            const idx = Math.floor(Math.random() * player.hand.length);
            const [c] = player.hand.splice(idx, 1);
            player.discardPile.push(c);
          }
          this.actionsRemaining--;
          this.log(`Crabbe & Goyle: AI discarded 2 cards and dealt 3 damage to you.`);
          this.dealDamage(opponentId, 3, 'spell');
        }
        break;
      }

      case 'Madam Pomfrey': {
        player.usedOncePerGameAbilities[charCard.name] = true;
        const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
        const choices = nonHealing.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        const maxTake = Math.min(12, choices.length);
        if (playerId === 'player' || this.isMultiplayer) {
          this.promptChoice(playerId, `Madam Pomfrey: Choose up to ${maxTake} non-Healing cards to shuffle into deck`, choices, 0, maxTake, (selected) => {
            selected.forEach(instId => {
              const idx = player.discardPile.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.discardPile.splice(idx, 1);
                player.deck.push(c);
              }
            });
            this.shuffle(player.deck);
            this.actionsRemaining--;
            this.log(`Madam Pomfrey: Shuffled ${selected.length} cards into deck.`);
            this.notifyStateChange();
          }, charCard);
        } else {
          for (let i = 0; i < maxTake; i++) {
            const [c] = player.discardPile.splice(player.discardPile.indexOf(nonHealing[i]), 1);
            player.deck.push(c);
          }
          this.shuffle(player.deck);
          this.actionsRemaining--;
          this.log(`Madam Pomfrey: AI shuffled ${maxTake} cards into deck.`);
        }
        break;
      }

      case 'Peeves': {
        player.usedOncePerGameAbilities[charCard.name] = true;
        this.actionsRemaining--;
        
        const discPlayer = player.hand.length;
        player.discardPile.push(...player.hand);
        player.hand = [];
        this.log(`Peeves: ${player.name} discarded hand of ${discPlayer} card(s).`);
        this.drawCards(playerId, 7, false);

        const discOpponent = opponent.hand.length;
        opponent.discardPile.push(...opponent.hand);
        opponent.hand = [];
        this.log(`Peeves: ${opponent.name} discarded hand of ${discOpponent} card(s).`);
        this.drawCards(opponentId, 7, false);
        
        this.notifyStateChange();
        break;
      }

      case 'The Fat Lady': {
        const gryffindorCards = player.deck.filter(c => c.subTypes?.includes('Gryffindor') || c.text?.includes('Gryffindor') || c.name.includes('Gryffindor'));
        if (playerId === 'player' || this.isMultiplayer) {
          const choices = gryffindorCards.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(playerId, "The Fat Lady: Choose a Gryffindor card from deck", choices, 0, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const idx = player.deck.findIndex(c => c.instanceId === sel);
              if (idx !== -1) {
                const [c] = player.deck.splice(idx, 1);
                player.hand.push(c);
                this.log(`The Fat Lady: Added ${c.name} to hand from deck.`);
              }
            }
            this.shuffle(player.deck);
            this.actionsRemaining--;
            this.notifyStateChange();
          }, charCard);
        } else {
          const [c] = player.deck.splice(player.deck.indexOf(gryffindorCards[0]), 1);
          player.hand.push(c);
          this.shuffle(player.deck);
          this.actionsRemaining--;
          this.log(`The Fat Lady: AI added Gryffindor ${c.name} to hand.`);
        }
        break;
      }

      case 'Dean Thomas': {
        player.usedOncePerGameAbilities[charCard.name] = true;
        this.log(`${player.name} activated Dean Thomas: Drew 3 cards.`);
        this.drawCards(playerId, 3, false);
        break;
      }

      case 'Draco Malfoy': {
        const handChoices = player.hand.map(c => ({ id: `hand-${playerId}-${c.instanceId}`, label: c.name, card: c }));
        this.promptChoice(playerId, "Draco Malfoy: Choose 1 card from hand to discard as cost", handChoices, 1, 1, (discarded) => {
          const dSel = discarded[0];
          if (dSel) {
            const instId = dSel.split('-').slice(2).join('-');
            const idx = player.hand.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = player.hand.splice(idx, 1);
              player.discardPile.push(c);
              this.log(`${player.name} discarded: ${c.name}`);
            }
          }
          
          this.actionsRemaining--;

          if (opponent.hand.length > 0) {
            const oppChoices = opponent.hand.map(c => ({ id: `hand-${opponentId}-${c.instanceId}`, label: c.name, card: c }));
            this.promptChoice(playerId, `Draco Malfoy: Choose 1 card in ${opponent.name}'s hand to discard`, oppChoices, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const instId = sel.split('-').slice(2).join('-');
                const idx = opponent.hand.findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = opponent.hand.splice(idx, 1);
                  opponent.discardPile.push(c);
                  this.log(`Draco Malfoy: Discarded ${opponent.name}'s card: ${c.name}`);
                  this.notifyStateChange();
                }
              }
            });
          } else {
            this.log(`Opponent has no cards in hand.`);
            this.notifyStateChange();
          }
        });
        break;
      }

      case 'Hannah Abbott': {
        const handChoices = player.hand.map(c => ({ id: `hand-${playerId}-${c.instanceId}`, label: c.name, card: c }));
        this.promptChoice(playerId, "Hannah Abbott: Choose 2 cards in hand to discard", handChoices, 2, 2, (discarded) => {
          discarded.forEach(selId => {
            const instId = selId.split('-').slice(2).join('-');
            const idx = player.hand.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = player.hand.splice(idx, 1);
              player.discardPile.push(c);
              this.log(`Discarded: ${c.name}`);
            }
          });

          player.usedOncePerGameAbilities[charCard.name] = true;

          const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
          const discChoices = nonHealing.map(c => ({ id: `discard-${playerId}-${c.instanceId}`, label: c.name, card: c }));
          const maxTake = Math.min(2, discChoices.length);
          
          this.promptChoice(playerId, `Hannah Abbott: Retrieve ${maxTake} non-Healing card(s) from discard`, discChoices, maxTake, maxTake, (retrieved) => {
            retrieved.forEach(selId => {
              const instId = selId.split('-').slice(2).join('-');
              const idx = player.discardPile.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.discardPile.splice(idx, 1);
                player.hand.push(c);
                this.log(`Hannah Abbott: Put ${c.name} from discard into hand.`);
              }
            });
            this.notifyStateChange();
          });
        });
        break;
      }

      case 'Nearly Headless Nick': {
        player.usedOncePerGameAbilities[charCard.name] = true;
        const items = player.deck.filter(c => c.type === 'Item');
        const choices = items.map(c => ({ id: `deck-${playerId}-${c.instanceId}`, label: c.name, card: c }));
        const maxTake = Math.min(2, choices.length);
        if (maxTake === 0) {
          this.log(`No Items in deck to find.`);
          this.shuffle(player.deck);
          break;
        }
        this.promptChoice(playerId, `Nearly Headless Nick: Choose up to ${maxTake} Item cards from deck`, choices, 0, maxTake, (selected) => {
          selected.forEach(selId => {
            const instId = selId.split('-').slice(2).join('-');
            const idx = player.deck.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = player.deck.splice(idx, 1);
              player.hand.push(c);
              this.log(`Nearly Headless Nick: Put ${c.name} from deck into hand.`);
            }
          });
          this.shuffle(player.deck);
          this.notifyStateChange();
        });
        break;
      }

      case 'Professor Filius Flitwick': {
        const handChoices = player.hand.map(c => ({ id: `hand-${playerId}-${c.instanceId}`, label: c.name, card: c }));
        this.promptChoice(playerId, "Professor Flitwick: Choose 2 cards in hand to discard", handChoices, 2, 2, (discarded) => {
          discarded.forEach(selId => {
            const instId = selId.split('-').slice(2).join('-');
            const idx = player.hand.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = player.hand.splice(idx, 1);
              player.discardPile.push(c);
              this.log(`Discarded: ${c.name}`);
            }
          });

          player.usedOncePerGameAbilities[charCard.name] = true;

          const charmsCards = player.discardPile.filter(c => c.lessonCost?.type === 'Charms');
          const choices = charmsCards.map(c => ({ id: `discard-${playerId}-${c.instanceId}`, label: c.name, card: c }));
          
          this.promptChoice(playerId, "Professor Flitwick: Choose 1 Charms card in discard to put in hand", choices, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const instId = sel.split('-').slice(2).join('-');
              const idx = player.discardPile.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.discardPile.splice(idx, 1);
                player.hand.push(c);
                this.log(`Professor Flitwick: Put Charms card ${c.name} into hand.`);
              }
            }
            this.notifyStateChange();
          });
        });
        break;
      }

      case 'Professor Severus Snape': {
        const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
        const choices = nonHealing.map(c => ({ id: `discard-${playerId}-${c.instanceId}`, label: c.name, card: c }));
        const maxTake = Math.min(7, choices.length);
        if (maxTake === 0) {
          player.usedOncePerGameAbilities[charCard.name] = true;
          this.log(`${player.name} activated Severus Snape's ability: No non-Healing cards in discard pile.`);
          break;
        }
        this.promptChoice(playerId, `Professor Severus Snape: Choose up to ${maxTake} non-Healing cards to shuffle into deck`, choices, 0, maxTake, (selected) => {
          player.usedOncePerGameAbilities[charCard.name] = true;
          selected.forEach(selId => {
            const instId = selId.split('-').slice(2).join('-');
            const idx = player.discardPile.findIndex(dc => dc.instanceId === instId);
            if (idx !== -1) {
              const [c] = player.discardPile.splice(idx, 1);
              player.deck.push(c);
            }
          });
          this.shuffle(player.deck);
          this.log(`${player.name} activated Severus Snape's ability: Shuffled ${selected.length} non-Healing card(s) from discard into deck.`);
          this.notifyStateChange();
        }, charCard);
        break;
      }
      case 'Marcus Flint': {
        player.usedOncePerGameAbilities[charCard.name] = true;
        this.log(`${player.name} activated Marcus Flint.`);
        const count = opponent.hand.length;
        const maxDiscard = Math.min(3, count);
        if (maxDiscard > 0) {
          if (opponentId === 'player' || this.isMultiplayer) {
            const choices = opponent.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(opponentId, `Marcus Flint: Choose ${maxDiscard} cards to discard`, choices, maxDiscard, maxDiscard, (selected) => {
              selected.forEach(instId => {
                const idx = opponent.hand.findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = opponent.hand.splice(idx, 1);
                  opponent.discardPile.push(c);
                }
              });
              this.log(`Marcus Flint: Opponent discarded ${selected.length} card(s).`);
              this.notifyStateChange();
            });
          } else {
            for (let i = 0; i < maxDiscard; i++) {
              const idx = Math.floor(Math.random() * opponent.hand.length);
              const [c] = opponent.hand.splice(idx, 1);
              opponent.discardPile.push(c);
            }
            this.log(`Marcus Flint: AI discarded ${maxDiscard} card(s) from hand.`);
            this.notifyStateChange();
          }
        } else {
          this.log(`Marcus Flint: Opponent hand is already empty.`);
        }
        break;
      }
      case 'Madam Rolanda Hooch': {
        player.usedOncePerGameAbilities[charCard.name] = true;
        this.log(`${player.name} activated Madam Rolanda Hooch.`);
        const brooms = player.deck.filter(c => c.subTypes?.includes('Broom'));
        if (brooms.length === 0) {
          this.log(`Madam Rolanda Hooch: No Broom cards found in deck.`);
          this.shuffle(player.deck);
          break;
        }
        if (playerId === 'player' || this.isMultiplayer) {
          const choices = brooms.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(playerId, "Madam Rolanda Hooch: Choose a Broom card to add to hand", choices, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const idx = player.deck.findIndex(c => c.instanceId === sel);
              if (idx !== -1) {
                const [broom] = player.deck.splice(idx, 1);
                player.hand.push(broom);
                this.log(`Madam Rolanda Hooch: Added ${broom.name} to hand.`);
              }
            }
            this.shuffle(player.deck);
            this.notifyStateChange();
          });
        } else {
          const [broom] = player.deck.splice(player.deck.indexOf(brooms[0]), 1);
          player.hand.push(broom);
          this.shuffle(player.deck);
          this.log(`Madam Rolanda Hooch: AI added ${broom.name} to hand.`);
          this.notifyStateChange();
        }
        break;
      }
      case 'Prof. Minerva McGonagall': {
        player.usedOncePerGameAbilities[charCard.name] = true;
        this.log(`${player.name} activated Prof. Minerva McGonagall.`);
        if (player.adventures.length > 0) {
          const [adv] = player.adventures.splice(0, 1);
          player.discardPile.push(adv);
          this.log(`Prof. Minerva McGonagall: Discarded active Adventure: ${adv.name}`);
        }
        break;
      }
      case 'Seamus Finnigan': {
        player.usedOncePerTurnAbilities = player.usedOncePerTurnAbilities || {};
        player.usedOncePerTurnAbilities[charCard.name] = true;
        this.log(`${player.name} activated Seamus Finnigan.`);
        if (playerId === 'player' || this.isMultiplayer) {
          const choices = player.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(playerId, "Seamus Finnigan: Select 2 cards to discard to gain 1 Action", choices, 2, 2, (selected) => {
            selected.forEach(instId => {
              const idx = player.hand.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.hand.splice(idx, 1);
                player.discardPile.push(c);
              }
            });
            this.actionsRemaining++;
            this.log(`Seamus Finnigan: Discarded 2 cards and gained 1 Action.`);
            this.notifyStateChange();
          });
        } else {
          for (let i = 0; i < 2; i++) {
            const idx = Math.floor(Math.random() * player.hand.length);
            const [c] = player.hand.splice(idx, 1);
            player.discardPile.push(c);
          }
          this.actionsRemaining++;
          this.log(`Seamus Finnigan: AI discarded 2 cards and gained 1 Action.`);
          this.notifyStateChange();
        }
        break;
      }
      case 'Griphook': {
        player.usedOncePerGameAbilities[charCard.name] = true;
        this.actionsRemaining--;
        this.log(`${player.name} activated Griphook.`);
        const discCount = opponent.hand.length;
        if (discCount > 0) {
          opponent.discardPile.push(...opponent.hand);
          opponent.hand = [];
          this.log(`Griphook: ${opponent.name} discarded their hand of ${discCount} card(s).`);
          this.drawCards(opponent.id, discCount, false);
          this.log(`Griphook: ${opponent.name} drew ${discCount} card(s).`);
        } else {
          this.log(`Griphook: Opponent hand was empty.`);
        }
        break;
      }
      case 'Hagrid, Keeper of Keys': {
        this.actionsRemaining--;
        this.log(`${player.name} activated Hagrid, Keeper of Keys: Searching deck for a Location.`);
        const locationsInDeck = player.deck.filter(c => c.type === 'Location');
        if (locationsInDeck.length > 0) {
          if (playerId === 'player' || this.isMultiplayer) {
            const choices = locationsInDeck.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(playerId, "Hagrid, Keeper of Keys: Choose a Location card from deck to put into hand", choices, 0, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const idx = player.deck.findIndex(c => c.instanceId === sel);
                if (idx !== -1) {
                  const [loc] = player.deck.splice(idx, 1);
                  player.hand.push(loc);
                  this.log(`Hagrid, Keeper of Keys: Added Location ${loc.name} to hand.`);
                }
              }
              this.shuffle(player.deck);
              this.notifyStateChange();
            }, charCard);
          } else {
            const [loc] = player.deck.splice(player.deck.indexOf(locationsInDeck[0]), 1);
            player.hand.push(loc);
            this.shuffle(player.deck);
            this.log(`Hagrid, Keeper of Keys: AI added Location ${loc.name} to hand.`);
            this.notifyStateChange();
          }
        } else {
          this.log(`Hagrid, Keeper of Keys: No Location cards found in deck.`);
          this.shuffle(player.deck);
        }
        break;
      }
      case 'Hermione, Top Student': {
        player.usedOncePerGameAbilities[charCard.name] = true;
        this.actionsRemaining--;
        this.log(`${player.name} activated Hermione, Top Student: Searching deck for up to 2 Lessons.`);
        const lessonsInDeck = player.deck.filter(c => c.type === 'Lesson');
        const maxLessons = Math.min(2, lessonsInDeck.length);
        if (maxLessons > 0) {
          if (playerId === 'player' || this.isMultiplayer) {
            const choices = lessonsInDeck.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(playerId, `Hermione, Top Student: Choose up to ${maxLessons} Lesson card(s) from deck`, choices, 0, maxLessons, (selected) => {
              selected.forEach(selId => {
                const idx = player.deck.findIndex(c => c.instanceId === selId);
                if (idx !== -1) {
                  const [lesson] = player.deck.splice(idx, 1);
                  player.hand.push(lesson);
                  this.log(`Hermione, Top Student: Added Lesson ${lesson.name} to hand.`);
                }
              });
              this.shuffle(player.deck);
              this.notifyStateChange();
            }, charCard);
          } else {
            for (let i = 0; i < maxLessons; i++) {
              const idx = player.deck.indexOf(lessonsInDeck[i]);
              if (idx !== -1) {
                const [lesson] = player.deck.splice(idx, 1);
                player.hand.push(lesson);
                this.log(`Hermione, Top Student: AI added Lesson ${lesson.name} to hand.`);
              }
            }
            this.shuffle(player.deck);
            this.notifyStateChange();
          }
        } else {
          this.log(`Hermione, Top Student: No Lesson cards found in deck.`);
          this.shuffle(player.deck);
        }
        break;
      }
      case 'Lee Jordan': {
        this.actionsRemaining--;
        this.log(`${player.name} activated Lee Jordan.`);
        const revealCount = Math.min(3, player.deck.length);
        const revealed = [];
        for (let i = 0; i < revealCount; i++) {
          revealed.push(player.deck.pop());
        }
        const quidditchNeeded = revealed.filter(c => c.lessonCost && c.lessonCost.type === 'Quidditch');
        const nonQuidditch = revealed.filter(c => !c.lessonCost || c.lessonCost.type !== 'Quidditch');
        
        this.log(`Lee Jordan revealed: ${revealed.map(c => c.name).join(', ')}.`);
        
        quidditchNeeded.forEach(c => {
          player.hand.push(c);
          this.log(`Lee Jordan: Added ${c.name} (requires [Q] Power) to hand.`);
        });
        
        if (nonQuidditch.length > 0) {
          if (playerId === 'player' || this.isMultiplayer) {
            const choices = nonQuidditch.map((c, idx) => ({ id: `${idx}`, label: c.name, card: c }));
            this.promptChoice(playerId, "Lee Jordan: Choose order of cards to put on bottom of deck (First selected will be at the bottom)", choices, nonQuidditch.length, nonQuidditch.length, (selected) => {
              selected.forEach(idxStr => {
                const cardIdx = parseInt(idxStr, 10);
                player.deck.unshift(nonQuidditch[cardIdx]);
              });
              this.log(`Lee Jordan: Placed ${nonQuidditch.length} card(s) on the bottom of the deck.`);
              this.notifyStateChange();
            }, charCard);
          } else {
            nonQuidditch.forEach(c => {
              player.deck.unshift(c);
            });
            this.log(`Lee Jordan: AI placed ${nonQuidditch.length} card(s) on the bottom of the deck.`);
            this.notifyStateChange();
          }
        } else {
          this.notifyStateChange();
        }
        break;
      }
      case 'Madam Irma Pince': {
        this.actionsRemaining--;
        this.log(`${player.name} activated Madam Irma Pince.`);
        const booksInDiscard = player.discardPile.filter(c => c.subTypes && c.subTypes.includes('Book') && c.type !== 'Lesson');
        if (booksInDiscard.length > 0) {
          if (playerId === 'player' || this.isMultiplayer) {
            const choices = booksInDiscard.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(playerId, "Madam Irma Pince: Choose a Book card from discard to put into hand", choices, 0, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const idx = player.discardPile.findIndex(c => c.instanceId === sel);
                if (idx !== -1) {
                  const [book] = player.discardPile.splice(idx, 1);
                  player.hand.push(book);
                  this.log(`Madam Irma Pince: Added Book ${book.name} to hand.`);
                }
              }
              this.notifyStateChange();
            }, charCard);
          } else {
            const [book] = player.discardPile.splice(player.discardPile.indexOf(booksInDiscard[0]), 1);
            player.hand.push(book);
            this.log(`Madam Irma Pince: AI added Book ${book.name} to hand.`);
            this.notifyStateChange();
          }
        }
        break;
      }
      case 'Professor Quirinus Quirrell': {
        player.usedOncePerGameAbilities[charCard.name] = true;
        this.actionsRemaining--;
        this.log(`${player.name} activated Professor Quirinus Quirrell.`);
        
        let returnedCount = 0;
        ['player', 'opponent'].forEach(pId => {
          const p = this.players[pId];
          const creatures = p.creatures.splice(0);
          const items = p.items.splice(0);
          
          creatures.forEach(c => {
            c.damage = 0;
            p.hand.push(c);
          });
          items.forEach(i => {
            p.hand.push(i);
          });
          returnedCount += creatures.length + items.length;
        });
        
        this.log(`Professor Quirinus Quirrell: Returned all Creatures and Items in play (${returnedCount} total) to owners' hands.`);
        break;
      }
    }

    this.notifyStateChange();
  }

  // Check if an item card's ability can be activated
  canActivateItemAbility(playerId, item) {
    if (this.gameOver) return false;
    if (this.activePlayerId !== playerId) return false;
    const player = this.players[playerId];
    if (player.mustDrawFirstAction) return false;
    if (player.adventures.some(a => a.name === 'Letters From No One')) return false;
    const opponent = this.players[playerId === 'player' ? 'opponent' : 'player'];

    switch (item.name) {
      case 'Cage':
        return this.actionsRemaining >= 1 && (player.creatures.length > 0 || opponent.creatures.length > 0);
      case 'Winged Keys':
        return !item.usedThisTurn && opponent.creatures.length > 0;
      case 'Remembrall':
        return this.actionsRemaining >= 1 && player.discardPile.some(c => c.type === 'Lesson');
      case 'Hospital Bed':
        return this.actionsRemaining >= 1 && player.deck.some(c => c.subTypes?.includes('Healing') || c.healing || c.name === 'Bruisewort Balm' || c.name === 'Elixir of Life');
      case 'Put-Outer':
        return this.actionsRemaining >= 2 && (opponent.lessons.length > 0 || opponent.creatures.length > 0 || opponent.items.length > 0 || opponent.adventures.length > 0 || opponent.matches.length > 0);
      case 'The Sorting Hat': {
        const charactersInPlayNames = [...player.characters, ...opponent.characters].map(c => c.name);
        const charactersInDeck = player.deck.filter(c => c.type === 'Character' && !charactersInPlayNames.includes(c.name));
        return this.actionsRemaining >= 2 && charactersInDeck.length > 0;
      }
      case "A Beginner's Guide to Transfiguration":
      case "Fantastic Beasts & Where to Find Them":
      case "Magical Drafts and Potions":
      case "Quidditch Through the Ages":
      case "The Standard Book of Spells (Grade 1)":
      case "Bulgeye Potion":
      case "Colour-Changing Ink":
      case "Moonseed Poison":
        return this.actionsRemaining >= 1;
      case "Hagrid's Umbrella":
        return this.actionsRemaining >= 1 && player.deck.some(c => c.type === 'Location');
      case "Silver Unicorn Horn":
        return this.actionsRemaining >= 1 && player.discardPile.some(c => !c.subTypes?.includes('Healing'));
      case "Beetle Eyes":
      case "Eel Eyes": {
        const hasBeetle = player.items.some(i => i.name === 'Beetle Eyes');
        const hasEel = player.items.some(i => i.name === 'Eel Eyes');
        const bulgeyeInDeck = player.deck.some(c => c.name === 'Bulgeye Potion');
        return this.actionsRemaining >= 1 && hasBeetle && hasEel && bulgeyeInDeck;
      }
      case "Bluebottle Broom":
        return this.actionsRemaining >= 1 && player.discardPile.some(c => !c.subTypes?.includes('Healing'));
      case "Mirror of Erised":
        return this.actionsRemaining >= 1;
      case "Philosopher's Stone":
        return this.actionsRemaining >= 2;
      default:
        return false;
    }
  }

  // Activate an item card's ability
  activateItemAbility(playerId, itemInstanceId) {
    const player = this.players[playerId];
    const opponent = this.players[playerId === 'player' ? 'opponent' : 'player'];
    const item = player.items.find(i => i.instanceId === itemInstanceId);
    
    if (!item || !this.canActivateItemAbility(playerId, item)) return;

    switch (item.name) {
      case 'Mirror of Erised': {
        this.actionsRemaining--;
        const itemIdx = player.items.findIndex(i => i.instanceId === itemInstanceId);
        if (itemIdx !== -1) {
          player.items.splice(itemIdx, 1);
          player.discardPile.push(item);
        }

        const handCount = player.hand.length;
        this.log(`Mirror of Erised: Discarding hand of ${handCount} cards.`);
        player.discardPile.push(...player.hand);
        player.hand = [];

        if (player.deck.length > 0 && handCount > 0) {
          const maxTake = Math.min(handCount, player.deck.length);
          if (playerId === 'player' || this.isMultiplayer) {
            const choices = player.deck.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(playerId, `Mirror of Erised: Choose up to ${maxTake} cards from deck to put in hand`, choices, 0, maxTake, (selected) => {
              selected.forEach(instId => {
                const idx = player.deck.findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = player.deck.splice(idx, 1);
                  player.hand.push(c);
                }
              });
              this.shuffle(player.deck);
              this.log(`Mirror of Erised: Added ${selected.length} card(s) to hand.`);
              this.notifyStateChange();
            }, item);
          } else {
            for (let i = 0; i < maxTake; i++) {
              const [c] = player.deck.splice(0, 1);
              player.hand.push(c);
            }
            this.shuffle(player.deck);
            this.log(`Mirror of Erised: AI added ${maxTake} card(s) to hand.`);
            this.notifyStateChange();
          }
        } else {
          this.notifyStateChange();
        }
        break;
      }

      case "Philosopher's Stone": {
        this.actionsRemaining -= 2;
        const itemIdx = player.items.findIndex(i => i.instanceId === itemInstanceId);
        if (itemIdx !== -1) {
          player.items.splice(itemIdx, 1);
          player.discardPile.push(item);
        }

        const lessonsInDiscard = player.discardPile.filter(c => c.type === 'Lesson');
        lessonsInDiscard.forEach(c => {
          const idx = player.discardPile.indexOf(c);
          if (idx !== -1) {
            player.discardPile.splice(idx, 1);
            player.lessons.push(c);
          }
        });
        this.log(`Philosopher's Stone: Put all ${lessonsInDiscard.length} Lesson cards from discard pile into play.`);

        const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing') && c.name !== "Philosopher's Stone");
        nonHealing.forEach(c => {
          const idx = player.discardPile.indexOf(c);
          if (idx !== -1) {
            player.discardPile.splice(idx, 1);
            player.deck.push(c);
          }
        });
        this.shuffle(player.deck);
        this.log(`Philosopher's Stone: Shuffled all ${nonHealing.length} non-Healing cards from discard into deck.`);
        this.notifyStateChange();
        break;
      }

      case 'Cage': {
        const choices = [];
        player.creatures.forEach(c => choices.push({ id: `creature-${player.id}-${c.instanceId}`, label: `${c.name} (Your Creature)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-${opponent.id}-${c.instanceId}`, label: `${c.name} (Opponent's Creature)`, card: c }));

        this.promptChoice(playerId, "Cage: Choose a Creature to return to its owner's hand", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            this.actionsRemaining--;
            const cageIdx = player.items.findIndex(i => i.instanceId === itemInstanceId);
            if (cageIdx !== -1) {
              player.items.splice(cageIdx, 1);
              player.discardPile.push(item);
            }

            const parts = sel.split('-');
            const ownerId = parts[1];
            const creatureInstId = parts.slice(2).join('-');
            const owner = this.players[ownerId];
            const cIdx = owner.creatures.findIndex(c => c.instanceId === creatureInstId);
            if (cIdx !== -1) {
              const [creature] = owner.creatures.splice(cIdx, 1);
              creature.damage = 0;
              owner.hand.push(creature);
              this.log(`Cage: Returned ${creature.name} to ${owner.name}'s hand and discarded Cage.`);
            }
          }
        }, item);
        break;
      }

      case 'The Sorting Hat': {
        const charactersInPlayNames = [...player.characters, ...opponent.characters].map(c => c.name);
        const charactersInDeck = player.deck.filter(c => c.type === 'Character' && !charactersInPlayNames.includes(c.name));
        const choices = charactersInDeck.map(c => ({ id: `deck-player-${c.instanceId}`, label: c.name, card: c }));
        
        this.promptChoice(playerId, "The Sorting Hat: Choose a Character to put into play", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            this.actionsRemaining -= 2;
            const instId = sel.split('-').slice(2).join('-');
            const idx = player.deck.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [charCard] = player.deck.splice(idx, 1);
              player.characters.push(charCard);
              this.log(`The Sorting Hat: Put Character ${charCard.name} into play from deck.`);
              this.shuffle(player.deck);
              this.log(`${player.name} shuffled their deck.`);
              this.notifyStateChange();
            }
          }
        }, item);
        break;
      }

      case 'Winged Keys': {
        const choices = opponent.creatures.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        this.promptChoice(playerId, "Winged Keys: Choose an opponent's Creature to prevent its damage", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            player.wingedKeysTargetInstanceId = sel;
            item.usedThisTurn = true;
            this.log(`Winged Keys: Prevented damage done by ${opponent.creatures.find(c => c.instanceId === sel)?.name || 'selected creature'} until the end of ${opponent.name}'s next turn.`);
            this.notifyStateChange();
          }
        }, item);
        break;
      }

      case 'Remembrall': {
        const choices = player.discardPile
          .filter(c => c.type === 'Lesson')
          .map(c => ({ id: c.instanceId, label: c.name, card: c }));

        this.promptChoice(playerId, "Remembrall: Choose a Lesson to retrieve into play", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            this.actionsRemaining--;
            const idx = player.discardPile.findIndex(c => c.instanceId === sel);
            if (idx !== -1) {
              const [lesson] = player.discardPile.splice(idx, 1);
              player.lessons.push(lesson);
              this.log(`Remembrall: Put ${lesson.name} from discard pile into play.`);
            }
            this.notifyStateChange();
          }
        }, item);
        break;
      }
      case 'Hospital Bed': {
        const heals = player.deck.filter(c => c.subTypes?.includes('Healing') || c.healing || c.name === 'Bruisewort Balm' || c.name === 'Elixir of Life');
        if (heals.length === 0) {
          this.log(`Hospital Bed: No healing cards found in deck.`);
          break;
        }
        if (playerId === 'player' || this.isMultiplayer) {
          const choices = heals.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(playerId, "Hospital Bed: Choose a healing card to add to hand", choices, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              this.actionsRemaining--;
              const idx = player.deck.findIndex(c => c.instanceId === sel);
              if (idx !== -1) {
                const [c] = player.deck.splice(idx, 1);
                player.hand.push(c);
                this.log(`Hospital Bed: Found and added ${c.name} to hand.`);
              }
              this.shuffle(player.deck);
              this.notifyStateChange();
            }
          }, item);
        } else {
          this.actionsRemaining--;
          const c = heals[0];
          player.deck.splice(player.deck.indexOf(c), 1);
          player.hand.push(c);
          this.shuffle(player.deck);
          this.log(`Hospital Bed: AI added ${c.name} to hand.`);
          this.notifyStateChange();
        }
        break;
      }
      case 'Put-Outer': {
        const getPlayables = (pState) => {
          const cards = [];
          pState.lessons.forEach(c => cards.push({ id: `lessons-${c.instanceId}`, label: `${c.name} (Lesson)`, card: c, source: 'lessons' }));
          pState.creatures.forEach(c => cards.push({ id: `creatures-${c.instanceId}`, label: `${c.name} (Creature)`, card: c, source: 'creatures' }));
          pState.items.forEach(c => cards.push({ id: `items-${c.instanceId}`, label: `${c.name} (Item)`, card: c, source: 'items' }));
          pState.adventures.forEach(c => cards.push({ id: `adventures-${c.instanceId}`, label: `${c.name} (Adventure)`, card: c, source: 'adventures' }));
          pState.matches.forEach(c => cards.push({ id: `matches-${c.instanceId}`, label: `${c.name} (Match)`, card: c, source: 'matches' }));
          return cards;
        };
        const eligible = getPlayables(opponent);
        if (eligible.length === 0) {
          this.log(`Put-Outer: Opponent has no cards in play.`);
          break;
        }
        if (playerId === 'player' || this.isMultiplayer) {
          this.promptChoice(playerId, "Put-Outer: Choose 1 card of opponent's in play to return to hand", eligible, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              this.actionsRemaining -= 2;
              const parts = sel.split('-');
              const type = parts[0];
              const instId = parts.slice(1).join('-');
              const idx = opponent[type].findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = opponent[type].splice(idx, 1);
                if (c.damage) c.damage = 0;
                opponent.hand.push(c);
                this.log(`Put-Outer: Returned opponent's ${c.name} from play to hand.`);
              }
              this.notifyStateChange();
            }
          }, item);
        } else {
          this.actionsRemaining -= 2;
          const target = eligible[0];
          const idx = opponent[target.source].findIndex(c => c.instanceId === target.card.instanceId);
          if (idx !== -1) {
            const [c] = opponent[target.source].splice(idx, 1);
            if (c.damage) c.damage = 0;
            opponent.hand.push(c);
            this.log(`Put-Outer: AI returned your ${c.name} from play to hand.`);
          }
          this.notifyStateChange();
        }
        break;
      }
      case "A Beginner's Guide to Transfiguration":
      case "Fantastic Beasts & Where to Find Them":
      case "Magical Drafts and Potions":
      case "Quidditch Through the Ages":
      case "The Standard Book of Spells (Grade 1)": {
        this.actionsRemaining--;
        const itemIdx = player.items.findIndex(i => i.instanceId === itemInstanceId);
        if (itemIdx !== -1) {
          player.items.splice(itemIdx, 1);
          player.discardPile.push(item);
        }
        this.drawCard(playerId);
        this.drawCard(playerId);
        this.drawCard(playerId);
        this.log(`${player.name} discarded ${item.name} from play and drew 3 cards.`);
        this.notifyStateChange();
        break;
      }
      case "Bulgeye Potion": {
        this.actionsRemaining--;
        const itemIdx = player.items.findIndex(i => i.instanceId === itemInstanceId);
        if (itemIdx !== -1) {
          player.items.splice(itemIdx, 1);
          player.discardPile.push(item);
        }
        this.log(`${player.name} discarded Bulgeye Potion from play to deal 13 damage to opponent.`);
        this.dealDamage(playerId === 'player' ? 'opponent' : 'player', 13, 'item', item);
        this.notifyStateChange();
        break;
      }
      case "Colour-Changing Ink": {
        this.actionsRemaining--;
        const handSize = player.hand.length;
        if (handSize > 0) {
          if (playerId === 'player' || this.isMultiplayer) {
            const choices = player.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(playerId, "Colour-Changing Ink: Choose order of cards to put on bottom of deck (First selected will be at the bottom)", choices, handSize, handSize, (selected) => {
              selected.forEach(selId => {
                const idx = player.hand.findIndex(c => c.instanceId === selId);
                if (idx !== -1) {
                  const [c] = player.hand.splice(idx, 1);
                  player.deck.unshift(c);
                }
              });
              for (let i = 0; i < handSize; i++) {
                this.drawCard(playerId);
              }
              this.log(`${player.name} used Colour-Changing Ink: placed hand on bottom of deck and drew ${handSize} cards.`);
              this.notifyStateChange();
            }, item);
          } else {
            const tempHand = [...player.hand];
            player.hand = [];
            tempHand.forEach(c => player.deck.unshift(c));
            for (let i = 0; i < handSize; i++) {
              this.drawCard(playerId);
            }
            this.log(`Colour-Changing Ink: AI placed hand on bottom of deck and drew ${handSize} cards.`);
            this.notifyStateChange();
          }
        } else {
          this.log(`${player.name} used Colour-Changing Ink but had 0 cards in hand.`);
        }
        break;
      }
      case "Hagrid's Umbrella": {
        this.actionsRemaining--;
        const itemIdx = player.items.findIndex(i => i.instanceId === itemInstanceId);
        if (itemIdx !== -1) {
          player.items.splice(itemIdx, 1);
          player.discardPile.push(item);
        }
        const locationsInDeck = player.deck.filter(c => c.type === 'Location');
        if (locationsInDeck.length > 0) {
          if (playerId === 'player' || this.isMultiplayer) {
            const choices = locationsInDeck.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(playerId, "Hagrid's Umbrella: Choose a Location card from your deck to take", choices, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const idx = player.deck.findIndex(c => c.instanceId === sel);
                if (idx !== -1) {
                  const [loc] = player.deck.splice(idx, 1);
                  player.hand.push(loc);
                  this.log(`Hagrid's Umbrella: Took ${loc.name} from deck.`);
                }
              }
              this.shuffle(player.deck);
              this.notifyStateChange();
            }, item);
          } else {
            const [loc] = player.deck.splice(player.deck.indexOf(locationsInDeck[0]), 1);
            player.hand.push(loc);
            this.log(`Hagrid's Umbrella: AI took ${loc.name} from deck.`);
            this.shuffle(player.deck);
            this.notifyStateChange();
          }
        }
        break;
      }
      case "Silver Unicorn Horn": {
        this.actionsRemaining--;
        const itemIdx = player.items.findIndex(i => i.instanceId === itemInstanceId);
        if (itemIdx !== -1) {
          player.items.splice(itemIdx, 1);
          player.discardPile.push(item);
        }
        const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
        const maxTake = Math.min(6, nonHealing.length);
        if (nonHealing.length > 0) {
          if (playerId === 'player' || this.isMultiplayer) {
            const choices = nonHealing.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(playerId, `Silver Unicorn Horn: Choose up to 6 non-Healing cards to shuffle into deck`, choices, 0, maxTake, (selected) => {
              selected.forEach(selId => {
                const idx = player.discardPile.findIndex(c => c.instanceId === selId);
                if (idx !== -1) {
                  const [c] = player.discardPile.splice(idx, 1);
                  player.deck.push(c);
                }
              });
              this.shuffle(player.deck);
              this.log(`${player.name} shuffled ${selected.length} card(s) from discard into deck.`);
              this.notifyStateChange();
            }, item);
          } else {
            const toShuffle = nonHealing.slice(0, maxTake);
            toShuffle.forEach(c => {
              player.discardPile.splice(player.discardPile.indexOf(c), 1);
              player.deck.push(c);
            });
            this.shuffle(player.deck);
            this.log(`Silver Unicorn Horn: AI shuffled ${toShuffle.length} card(s) from discard into deck.`);
            this.notifyStateChange();
          }
        }
        break;
      }
      case "Beetle Eyes":
      case "Eel Eyes": {
        this.actionsRemaining--;
        const bIdx = player.items.findIndex(i => i.name === 'Beetle Eyes');
        let bItem = null;
        if (bIdx !== -1) {
          [bItem] = player.items.splice(bIdx, 1);
          player.discardPile.push(bItem);
        }
        const eIdx = player.items.findIndex(i => i.name === 'Eel Eyes');
        let eItem = null;
        if (eIdx !== -1) {
          [eItem] = player.items.splice(eIdx, 1);
          player.discardPile.push(eItem);
        }
        this.log(`${player.name} discarded Beetle Eyes and Eel Eyes from play to search deck for Bulgeye Potion.`);
        
        const bulgeyeCard = player.deck.find(c => c.name === 'Bulgeye Potion');
        if (bulgeyeCard) {
          const idx = player.deck.indexOf(bulgeyeCard);
          player.deck.splice(idx, 1);
          
          const inst = { ...bulgeyeCard, instanceId: bulgeyeCard.instanceId || `item-${Date.now()}` };
          player.items.push(inst);
          this.log(`Put Bulgeye Potion into play from deck.`);
        }
        this.shuffle(player.deck);
        this.notifyStateChange();
        break;
      }
      case "Bluebottle Broom": {
        this.actionsRemaining--;
        const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
        if (nonHealing.length > 0) {
          if (playerId === 'player' || this.isMultiplayer) {
            const choices = nonHealing.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(playerId, "Bluebottle Broom: Choose a non-Healing card from discard to put on bottom of deck", choices, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const idx = player.discardPile.findIndex(c => c.instanceId === sel);
                if (idx !== -1) {
                  const [c] = player.discardPile.splice(idx, 1);
                  player.deck.unshift(c);
                  this.log(`Bluebottle Broom: Put ${c.name} on bottom of deck.`);
                }
              }
              this.notifyStateChange();
            }, item);
          } else {
            const [c] = player.discardPile.splice(player.discardPile.indexOf(nonHealing[0]), 1);
            player.deck.unshift(c);
            this.log(`Bluebottle Broom: AI put ${c.name} on bottom of deck.`);
            this.notifyStateChange();
          }
        }
        break;
      }
      case "Moonseed Poison": {
        this.actionsRemaining--;
        const itemIdx = player.items.findIndex(i => i.instanceId === itemInstanceId);
        if (itemIdx !== -1) {
          player.items.splice(itemIdx, 1);
          player.discardPile.push(item);
        }
        this.log(`${player.name} discarded Moonseed Poison from play to deal 6 damage to opponent.`);
        this.dealDamage(playerId === 'player' ? 'opponent' : 'player', 6, 'item', item);
        this.notifyStateChange();
        break;
      }
    }
  }

  getPrintedPower(card) {
    return parseInt(card.lessonCost?.total ?? card.cost ?? '0', 10);
  }

  isHealingCard(card) {
    if (!card) return false;
    return (
      card.healing === true ||
      (card.subTypes && card.subTypes.some(s => s.includes('Healing'))) ||
      card.name === 'Bruisewort Balm' ||
      card.name === 'Elixir of Life' ||
      card.name === 'Star Grass Salve' ||
      card.name === 'Cauldron Cakes'
    );
  }

  // Check if an adventure card can be solved
  getCardsInPlay(playerId) {
    const player = this.players[playerId];
    const cards = [
      ...player.lessons,
      ...player.creatures,
      ...player.items,
      ...player.locations,
      ...player.adventures,
      ...player.matches
    ];
    player.characters.forEach(c => {
      if (c.instanceId !== 'player-starting-char' && c.instanceId !== 'opponent-starting-char') {
        cards.push(c);
      }
    });
    return cards;
  }

  canSolveAdventure(playerId, adventure) {
    if (this.gameOver) return false;
    if (this.activePlayerId !== playerId) return false;
    const player = this.players[playerId];

    switch (adventure.name) {
      case "Dragon's Escape":
        return player.lessons.length >= 3;
      case "Gringotts' Cart Ride":
        return this.actionsRemaining >= 1;
      case "Human Chess Game": {
        const eligibleCharacters = player.characters.filter(c => c.instanceId !== 'player-starting-char' && c.instanceId !== 'opponent-starting-char');
        return eligibleCharacters.length >= 1 || player.hand.length >= 8;
      }
      case "Troll in the Bathroom":
        return player.hand.length >= 7;
      case "Harry Hunting":
        return player.hand.length >= 7;
      case "Meet the Centaurs":
        return true;
      case "4 Privet Drive":
        return player.hand.length >= 6;
      case "Diagon Alley":
        return this.actionsRemaining >= 1;
      case "Hiding From Snape":
        return player.hand.filter(c => c.type === 'Item').length >= 4;
      case "Peeves Causes Trouble":
        return this.actionsRemaining >= 1;
      case "Reptile House":
        return player.lessons.length >= 4;
      case "Unusual Pets":
        return player.creatures.length >= 2;
      case "Gaze into the Mirror":
        return player.hand.filter(c => c.type === 'Spell').length >= 5;
      case "Hagrid Needs Help":
        return this.actionsRemaining >= 1;
      case "Letters From No One":
        return player.hand.length >= 5;
      case "Through the Arch":
        return this.actionsRemaining >= 1;
      case "In the Stands":
        return player.hand.filter(c => c.type === 'Creature').length >= 4;
      case "Into the Forbidden Forest":
        return this.actionsRemaining >= 1;
      case "Pep Talk":
        return player.hand.some(c => this.getPrintedPower(c) >= 8);
      case "Race for the Snitch":
        return true;
      case "Snape's Bias":
        return true;
      case "Sticking Up for Neville":
        return true;
      case "Detention!":
        return player.hand.filter(c => c.type === 'Adventure').length >= 2;
      case "Finding the Platform":
        return this.actionsRemaining >= 1;
      case "Hut on the Rock":
        return this.actionsRemaining >= 1;
      case "Meeting Fluffy":
        return this.actionsRemaining >= 1 && this.getCardsInPlay(playerId).length >= 3;
      case "Midnight Duel":
        return this.actionsRemaining >= 1 && this.getCardsInPlay(playerId).length >= 4;
      case "Riding the Centaur":
        return this.actionsRemaining >= 1 && this.getCardsInPlay(playerId).length >= 4;
      case "Stoat Sandwiches":
        return this.actionsRemaining >= 1 && this.getCardsInPlay(playerId).length >= 5;
      case "Voldemort Revealed":
        return this.actionsRemaining >= 1;
      case "5 Points from Gryffindor":
        return this.actionsRemaining >= 1 && player.hand.length >= 5;
      case "Candy Cart":
        return this.actionsRemaining >= 1;
      case "Flying Practice": {
        const quidCards = player.hand.filter(c => c.lessonCost?.type === 'Quidditch');
        return this.actionsRemaining >= 1 && quidCards.length >= 4;
      }
      case "Looking for Trevor":
        return this.actionsRemaining >= 1 && player.lessons.length >= 2;
      case "Running from Filch":
        return this.actionsRemaining >= 1;
      case "Through the Trapdoor":
        return false; // auto-solved, not manually solvable
      default:
        return false;
    }
  }

  // Solve an adventure card
  solveAdventure(playerId, adventureInstanceId) {
    const player = this.players[playerId];
    const opponent = this.players[playerId === 'player' ? 'opponent' : 'player'];
    const advIndex = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
    if (advIndex === -1) return;
    const adventure = player.adventures[advIndex];

    if (!this.canSolveAdventure(playerId, adventure)) return;

    if (adventure.name === "Gringotts' Cart Ride" || adventure.name === "Diagon Alley" || adventure.name === "Peeves Causes Trouble" || adventure.name === "Into the Forbidden Forest" || adventure.name === "Through the Arch") {
      const targetSkips = adventure.name === "Diagon Alley" ? 7 : (adventure.name === "Through the Arch" ? 4 : 5);
      this.actionsRemaining--;
      adventure.skipCount = (adventure.skipCount || 0) + 1;
      this.log(`${player.name} skipped an action to work on ${adventure.name} (Progress: ${adventure.skipCount}/${targetSkips}).`);

      if (adventure.skipCount >= targetSkips) {
        player.adventures.splice(advIndex, 1);
        opponent.discardPile.push(adventure);
        this.log(`${adventure.name} is solved!`);
        this.applyAdventureReward(playerId, adventure);
      } else {
        this.notifyStateChange();
      }
      return;
    }

    switch (adventure.name) {
      case "Dragon's Escape": {
        const choices = player.lessons.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        this.promptChoice(playerId, "Dragon's Escape: Choose 3 Lessons in play to discard", choices, 3, 3, (selected) => {
          if (selected.length === 3) {
            selected.forEach(instId => {
              const idx = player.lessons.findIndex(l => l.instanceId === instId);
              if (idx !== -1) {
                const [l] = player.lessons.splice(idx, 1);
                player.discardPile.push(l);
              }
            });
            this.log(`${player.name} discarded 3 Lessons from play.`);
            
            const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
            if (idx !== -1) {
              player.adventures.splice(idx, 1);
              opponent.discardPile.push(adventure);
              this.log(`${adventure.name} is solved!`);
              this.applyAdventureReward(playerId, adventure);
            }
          }
        }, adventure);
        break;
      }

      case "Human Chess Game": {
        const eligibleCharacters = player.characters.filter(c => c.instanceId !== 'player-starting-char' && c.instanceId !== 'opponent-starting-char');
        const choices = [];
        eligibleCharacters.forEach(c => choices.push({ id: `char-${c.instanceId}`, label: `Discard Character: ${c.name}`, card: c }));
        if (player.hand.length >= 8) {
          choices.push({ id: 'discard-8-hand', label: "Discard 8 cards from hand" });
        }

        this.promptChoice(playerId, "Human Chess Game: Choose how to solve", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'discard-8-hand') {
            const handChoices = player.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(playerId, "Human Chess Game: Choose 8 cards from hand to discard", handChoices, 8, 8, (handSel) => {
              if (handSel.length === 8) {
                handSel.forEach(instId => {
                  const idx = player.hand.findIndex(c => c.instanceId === instId);
                  if (idx !== -1) {
                    const [c] = player.hand.splice(idx, 1);
                    player.discardPile.push(c);
                  }
                });
                this.log(`${player.name} discarded 8 cards from hand.`);

                const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
                if (idx !== -1) {
                  player.adventures.splice(idx, 1);
                  opponent.discardPile.push(adventure);
                  this.log(`${adventure.name} is solved!`);
                  this.applyAdventureReward(playerId, adventure);
                }
              }
            }, adventure);
          } else if (sel && sel.startsWith('char-')) {
            const charInstId = sel.split('-').slice(1).join('-');
            const idx = player.characters.findIndex(c => c.instanceId === charInstId);
            if (idx !== -1) {
              const [c] = player.characters.splice(idx, 1);
              player.discardPile.push(c);
              this.log(`${player.name} discarded Character from play: ${c.name}.`);

              const advIdx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
              if (advIdx !== -1) {
                player.adventures.splice(advIdx, 1);
                opponent.discardPile.push(adventure);
                this.log(`${adventure.name} is solved!`);
                this.applyAdventureReward(playerId, adventure);
              }
            }
          }
        }, adventure);
        break;
      }

      case "Troll in the Bathroom":
      case "Harry Hunting":
      case "4 Privet Drive": {
        const count = adventure.name === "4 Privet Drive" ? 6 : 7;
        const handChoices = player.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        this.promptChoice(playerId, `${adventure.name}: Choose ${count} cards from hand to discard`, handChoices, count, count, (selected) => {
          if (selected.length === count) {
            selected.forEach(instId => {
              const idx = player.hand.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.hand.splice(idx, 1);
                player.discardPile.push(c);
              }
            });
            this.log(`${player.name} discarded ${count} cards from hand.`);

            const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
            if (idx !== -1) {
              player.adventures.splice(idx, 1);
              opponent.discardPile.push(adventure);
              this.log(`${adventure.name} is solved!`);
              this.applyAdventureReward(playerId, adventure);
            }
          }
        }, adventure);
        break;
      }

      case "Meet the Centaurs": {
        const discardedCount = player.hand.length;
        player.discardPile.push(...player.hand);
        player.hand = [];
        this.log(`${player.name} discarded hand (${discardedCount} card(s)).`);

        player.adventures.splice(advIndex, 1);
        opponent.discardPile.push(adventure);
        this.log(`${adventure.name} is solved!`);
        this.applyAdventureReward(playerId, adventure);
        break;
      }

      case "Letters From No One": {
        const handChoices = player.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        this.promptChoice(playerId, "Letters From No One: Choose 5 cards from hand to discard", handChoices, 5, 5, (selected) => {
          if (selected.length === 5) {
            selected.forEach(instId => {
              const idx = player.hand.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.hand.splice(idx, 1);
                player.discardPile.push(c);
              }
            });
            this.log(`${player.name} discarded 5 cards from hand.`);

            const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
            if (idx !== -1) {
              player.adventures.splice(idx, 1);
              opponent.discardPile.push(adventure);
              this.log(`${adventure.name} is solved!`);
              this.applyAdventureReward(playerId, adventure);
            }
          }
        }, adventure);
        break;
      }

      case "Through the Arch": {
        // Handled in multi-turn skipped actions solver block
        break;
      }

      case "Hiding From Snape": {
        const itemChoices = player.hand.filter(c => c.type === 'Item').map(c => ({ id: c.instanceId, label: c.name, card: c }));
        this.promptChoice(playerId, "Hiding From Snape: Choose 4 Item cards from hand to discard", itemChoices, 4, 4, (selected) => {
          if (selected.length === 4) {
            selected.forEach(instId => {
              const idx = player.hand.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.hand.splice(idx, 1);
                player.discardPile.push(c);
              }
            });
            this.log(`${player.name} discarded 4 Item cards from hand.`);

            const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
            if (idx !== -1) {
              player.adventures.splice(idx, 1);
              opponent.discardPile.push(adventure);
              this.log(`${adventure.name} is solved!`);
              this.applyAdventureReward(playerId, adventure);
            }
          }
        }, adventure);
        break;
      }

      case "Reptile House": {
        const choices = player.lessons.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        this.promptChoice(playerId, "Reptile House: Choose 4 Lessons in play to discard", choices, 4, 4, (selected) => {
          if (selected.length === 4) {
            selected.forEach(instId => {
              const idx = player.lessons.findIndex(l => l.instanceId === instId);
              if (idx !== -1) {
                const [l] = player.lessons.splice(idx, 1);
                player.discardPile.push(l);
              }
            });
            this.log(`${player.name} discarded 4 Lessons from play.`);

            const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
            if (idx !== -1) {
              player.adventures.splice(idx, 1);
              opponent.discardPile.push(adventure);
              this.log(`${adventure.name} is solved!`);
              this.applyAdventureReward(playerId, adventure);
            }
          }
        }, adventure);
        break;
      }

      case "Unusual Pets": {
        const choices = player.creatures.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        this.promptChoice(playerId, "Unusual Pets: Choose 2 Creatures in play to discard", choices, 2, 2, (selected) => {
          if (selected.length === 2) {
            selected.forEach(instId => {
              this.discardCreature(playerId, instId);
            });

            const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
            if (idx !== -1) {
              player.adventures.splice(idx, 1);
              opponent.discardPile.push(adventure);
              this.log(`${adventure.name} is solved!`);
              this.applyAdventureReward(playerId, adventure);
            }
          }
        }, adventure);
        break;
      }

      case "Gaze into the Mirror": {
        const spellChoices = player.hand.filter(c => c.type === 'Spell').map(c => ({ id: c.instanceId, label: c.name, card: c }));
        if (playerId === 'player' || this.isMultiplayer) {
          this.promptChoice(playerId, "Gaze into the Mirror: Choose 5 Spell cards from hand to discard", spellChoices, 5, 5, (selected) => {
            if (selected.length === 5) {
              selected.forEach(instId => {
                const idx = player.hand.findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = player.hand.splice(idx, 1);
                  player.discardPile.push(c);
                }
              });
              this.log(`Gaze into the Mirror: Discarded 5 Spell cards.`);
              
              const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
              if (idx !== -1) {
                player.adventures.splice(idx, 1);
                opponent.discardPile.push(adventure);
                this.log(`Gaze into the Mirror is solved!`);
                this.applyAdventureReward(playerId, adventure);
              }
              this.notifyStateChange();
            }
          }, adventure);
        } else {
          for (let i = 0; i < 5; i++) {
            const c = spellChoices[i].card;
            player.hand.splice(player.hand.indexOf(c), 1);
            player.discardPile.push(c);
          }
          this.log(`Gaze into the Mirror: AI discarded 5 Spell cards.`);
          player.adventures.splice(advIndex, 1);
          opponent.discardPile.push(adventure);
          this.log(`Gaze into the Mirror is solved!`);
          this.applyAdventureReward(playerId, adventure);
          this.notifyStateChange();
        }
        break;
      }

      case "Hagrid Needs Help": {
        this.actionsRemaining--;
        this.log(`${player.name} chose to solve Hagrid Needs Help by taking 8 damage.`);
        player.adventures.splice(advIndex, 1);
        opponent.discardPile.push(adventure);
        this.log(`Hagrid Needs Help is solved!`);
        this.dealDamage(playerId, 8, 'adventure', adventure);
        this.applyAdventureReward(playerId, adventure);
        this.notifyStateChange();
        break;
      }

      case "In the Stands": {
        const creatureChoices = player.hand.filter(c => c.type === 'Creature').map(c => ({ id: c.instanceId, label: c.name, card: c }));
        if (playerId === 'player' || this.isMultiplayer) {
          this.promptChoice(playerId, "In the Stands: Choose 4 Creature cards from hand to discard", creatureChoices, 4, 4, (selected) => {
            if (selected.length === 4) {
              selected.forEach(instId => {
                const idx = player.hand.findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = player.hand.splice(idx, 1);
                  player.discardPile.push(c);
                }
              });
              this.log(`In the Stands: Discarded 4 Creature cards.`);
              const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
              if (idx !== -1) {
                player.adventures.splice(idx, 1);
                opponent.discardPile.push(adventure);
                this.log(`In the Stands is solved!`);
                this.applyAdventureReward(playerId, adventure);
              }
              this.notifyStateChange();
            }
          }, adventure);
        } else {
          for (let i = 0; i < 4; i++) {
            const c = creatureChoices[i].card;
            player.hand.splice(player.hand.indexOf(c), 1);
            player.discardPile.push(c);
          }
          this.log(`In the Stands: AI discarded 4 Creature cards.`);
          player.adventures.splice(advIndex, 1);
          opponent.discardPile.push(adventure);
          this.log(`In the Stands is solved!`);
          this.applyAdventureReward(playerId, adventure);
          this.notifyStateChange();
        }
        break;
      }

      case "Pep Talk": {
        const eligible = player.hand.filter(c => this.getPrintedPower(c) >= 8);
        if (playerId === 'player' || this.isMultiplayer) {
          const choices = eligible.map(c => ({ id: c.instanceId, label: `${c.name} (Power: ${this.getPrintedPower(c)})`, card: c }));
          this.promptChoice(playerId, "Pep Talk: Select 1 card in hand with power 8+ to show opponent", choices, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const found = eligible.find(c => c.instanceId === sel);
              this.log(`Pep Talk: Player showed ${found.name} (Power: ${this.getPrintedPower(found)}).`);
              const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
              if (idx !== -1) {
                player.adventures.splice(idx, 1);
                opponent.discardPile.push(adventure);
                this.log(`Pep Talk is solved!`);
                player.mustDrawFirstAction = false;
                this.applyAdventureReward(playerId, adventure);
              }
              this.notifyStateChange();
            }
          }, adventure);
        } else {
          const found = eligible[0];
          this.log(`Pep Talk: AI showed ${found.name} (Power: ${this.getPrintedPower(found)}).`);
          player.adventures.splice(advIndex, 1);
          opponent.discardPile.push(adventure);
          this.log(`Pep Talk is solved!`);
          player.mustDrawFirstAction = false;
          this.applyAdventureReward(playerId, adventure);
          this.notifyStateChange();
        }
        break;
      }

      case "Race for the Snitch": {
        const count = player.hand.length;
        player.discardPile.push(...player.hand);
        player.hand = [];
        this.log(`${player.name} discarded their hand (${count} card(s)) to solve Race for the Snitch.`);
        player.adventures.splice(advIndex, 1);
        opponent.discardPile.push(adventure);
        this.log(`Race for the Snitch is solved!`);
        this.applyAdventureReward(playerId, adventure);
        break;
      }

      case "Snape's Bias": {
        const searchPlayerId = opponent.id;
        const searchPlayer = opponent;
        if (searchPlayerId === 'player') {
          const choices = searchPlayer.deck.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          const maxTake = Math.min(2, choices.length);
          if (maxTake > 0) {
            this.promptChoice(searchPlayerId, `Snape's Bias: Choose up to ${maxTake} card(s) from deck to add to hand`, choices, 0, maxTake, (selected) => {
              selected.forEach(instId => {
                const idx = searchPlayer.deck.findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = searchPlayer.deck.splice(idx, 1);
                  searchPlayer.hand.push(c);
                }
              });
              this.shuffle(searchPlayer.deck);
              this.log(`Snape's Bias: Player added ${selected.length} card(s) to hand.`);
              
              const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
              if (idx !== -1) {
                player.adventures.splice(idx, 1);
                opponent.discardPile.push(adventure);
                this.log(`Snape's Bias is solved!`);
                this.applyAdventureReward(playerId, adventure);
              }
              this.notifyStateChange();
            }, adventure);
          } else {
            this.log(`Snape's Bias: No cards in opponent's deck.`);
            player.adventures.splice(advIndex, 1);
            opponent.discardPile.push(adventure);
            this.log(`Snape's Bias is solved!`);
            this.applyAdventureReward(playerId, adventure);
            this.notifyStateChange();
          }
        } else {
          const maxTake = Math.min(2, searchPlayer.deck.length);
          for (let i = 0; i < maxTake; i++) {
            const [c] = searchPlayer.deck.splice(0, 1);
            searchPlayer.hand.push(c);
          }
          this.shuffle(searchPlayer.deck);
          this.log(`Snape's Bias: AI added ${maxTake} card(s) to hand.`);
          player.adventures.splice(advIndex, 1);
          opponent.discardPile.push(adventure);
          this.log(`Snape's Bias is solved!`);
          this.applyAdventureReward(playerId, adventure);
          this.notifyStateChange();
        }
        break;
      }

      case "Sticking Up for Neville": {
        const count = player.hand.length;
        player.discardPile.push(...player.hand);
        player.hand = [];
        this.log(`${player.name} discarded their hand (${count} card(s)) to solve Sticking Up for Neville.`);
        player.adventures.splice(advIndex, 1);
        opponent.discardPile.push(adventure);
        this.log(`Sticking Up for Neville is solved!`);
        this.applyAdventureReward(playerId, adventure);
        break;
      }

      case "Detention!": {
        const advChoices = player.hand.filter(c => c.type === 'Adventure').map(c => ({ id: c.instanceId, label: c.name, card: c }));
        if (playerId === 'player' || this.isMultiplayer) {
          this.promptChoice(playerId, "Detention!: Choose 2 Adventure cards from hand to discard", advChoices, 2, 2, (selected) => {
            if (selected.length === 2) {
              selected.forEach(instId => {
                const idx = player.hand.findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = player.hand.splice(idx, 1);
                  player.discardPile.push(c);
                }
              });
              this.log(`Detention!: Discarded 2 Adventure cards from hand.`);
              const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
              if (idx !== -1) {
                player.adventures.splice(idx, 1);
                opponent.discardPile.push(adventure);
                this.log(`Detention! is solved!`);
                this.applyAdventureReward(playerId, adventure);
              }
              this.notifyStateChange();
            }
          }, adventure);
        } else {
          for (let i = 0; i < 2; i++) {
            const c = advChoices[i].card;
            player.hand.splice(player.hand.indexOf(c), 1);
            player.discardPile.push(c);
          }
          this.log(`Detention!: AI discarded 2 Adventure cards.`);
          player.adventures.splice(advIndex, 1);
          opponent.discardPile.push(adventure);
          this.log(`Detention! is solved!`);
          this.applyAdventureReward(playerId, adventure);
          this.notifyStateChange();
        }
        break;
      }

      case "Finding the Platform": {
        const locations = opponent.deck.filter(c => c.type === 'Location');
        if (locations.length > 0) {
          if (opponent.id === 'player' || this.isMultiplayer) {
            const choices = locations.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            const maxTake = Math.min(2, choices.length);
            this.promptChoice(opponent.id, `Finding the Platform: Choose up to ${maxTake} Location card(s) from your deck`, choices, 0, maxTake, (selected) => {
              selected.forEach(instId => {
                const idx = opponent.deck.findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = opponent.deck.splice(idx, 1);
                  opponent.hand.push(c);
                  this.log(`Finding the Platform: Controller added Location ${c.name} to hand.`);
                }
              });
              this.shuffle(opponent.deck);
              
              const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
              if (idx !== -1) {
                player.adventures.splice(idx, 1);
                opponent.discardPile.push(adventure);
                this.log(`Finding the Platform is solved!`);
                this.applyAdventureReward(playerId, adventure);
              }
              this.notifyStateChange();
            }, adventure);
          } else {
            const maxTake = Math.min(2, locations.length);
            for (let i = 0; i < maxTake; i++) {
              const c = locations[i];
              opponent.deck.splice(opponent.deck.indexOf(c), 1);
              opponent.hand.push(c);
              this.log(`Finding the Platform: AI Controller added Location ${c.name} to hand.`);
            }
            this.shuffle(opponent.deck);
            player.adventures.splice(advIndex, 1);
            opponent.discardPile.push(adventure);
            this.log(`Finding the Platform is solved!`);
            this.applyAdventureReward(playerId, adventure);
            this.notifyStateChange();
          }
        } else {
          this.log(`Finding the Platform: No Location cards in controller's deck.`);
          player.adventures.splice(advIndex, 1);
          opponent.discardPile.push(adventure);
          this.log(`Finding the Platform is solved!`);
          this.applyAdventureReward(playerId, adventure);
          this.notifyStateChange();
        }
        break;
      }

      case "Hut on the Rock":
      case "Running from Filch": {
        const count = player.hand.length;
        player.discardPile.push(...player.hand);
        player.hand = [];
        this.log(`${player.name} discarded their hand (${count} card(s)) to solve ${adventure.name}.`);
        player.adventures.splice(advIndex, 1);
        opponent.discardPile.push(adventure);
        this.log(`${adventure.name} is solved!`);
        this.applyAdventureReward(playerId, adventure);
        this.notifyStateChange();
        break;
      }

      case "Meeting Fluffy": {
        const eligible = this.getCardsInPlay(player.id);
        if (opponent.id === 'player' || this.isMultiplayer) {
          const choices = eligible.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(opponent.id, `Meeting Fluffy: Choose 3 of ${player.name}'s cards in play to discard`, choices, 3, 3, (selected) => {
            if (selected.length === 3) {
              selected.forEach(instId => {
                const zone = ['lessons', 'creatures', 'items', 'locations', 'adventures', 'matches', 'characters'].find(z => player[z] && player[z].some(c => c.instanceId === instId));
                if (zone) {
                  const idx = player[zone].findIndex(c => c.instanceId === instId);
                  if (idx !== -1) {
                    const [c] = player[zone].splice(idx, 1);
                    this.discardCardFromPlay(player.id, c, zone);
                  }
                }
              });
              const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
              if (idx !== -1) {
                player.adventures.splice(idx, 1);
                opponent.discardPile.push(adventure);
                this.log(`Meeting Fluffy is solved!`);
                this.applyAdventureReward(playerId, adventure);
              }
              this.notifyStateChange();
            }
          }, adventure);
        } else {
          for (let i = 0; i < Math.min(3, eligible.length); i++) {
            const c = eligible[i];
            const zone = ['lessons', 'creatures', 'items', 'locations', 'adventures', 'matches', 'characters'].find(z => player[z] && player[z].some(card => card.instanceId === c.instanceId));
            if (zone) {
              const idx = player[zone].findIndex(card => card.instanceId === c.instanceId);
              if (idx !== -1) {
                player[zone].splice(idx, 1);
                this.discardCardFromPlay(player.id, c, zone);
              }
            }
          }
          player.adventures.splice(advIndex, 1);
          opponent.discardPile.push(adventure);
          this.log(`Meeting Fluffy is solved!`);
          this.applyAdventureReward(playerId, adventure);
          this.notifyStateChange();
        }
        break;
      }

      case "Midnight Duel":
      case "Stoat Sandwiches": {
        const count = adventure.name === "Midnight Duel" ? 4 : 5;
        const eligible = this.getCardsInPlay(player.id);
        if (playerId === 'player' || this.isMultiplayer) {
          const choices = eligible.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(playerId, `${adventure.name}: Choose ${count} of your cards in play to discard`, choices, count, count, (selected) => {
            if (selected.length === count) {
              selected.forEach(instId => {
                const zone = ['lessons', 'creatures', 'items', 'locations', 'adventures', 'matches', 'characters'].find(z => player[z] && player[z].some(c => c.instanceId === instId));
                if (zone) {
                  const idx = player[zone].findIndex(c => c.instanceId === instId);
                  if (idx !== -1) {
                    const [c] = player[zone].splice(idx, 1);
                    this.discardCardFromPlay(player.id, c, zone);
                  }
                }
              });
              const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
              if (idx !== -1) {
                player.adventures.splice(idx, 1);
                opponent.discardPile.push(adventure);
                this.log(`${adventure.name} is solved!`);
                this.applyAdventureReward(playerId, adventure);
              }
              this.notifyStateChange();
            }
          }, adventure);
        } else {
          for (let i = 0; i < Math.min(count, eligible.length); i++) {
            const c = eligible[i];
            const zone = ['lessons', 'creatures', 'items', 'locations', 'adventures', 'matches', 'characters'].find(z => player[z] && player[z].some(card => card.instanceId === c.instanceId));
            if (zone) {
              const idx = player[zone].findIndex(card => card.instanceId === c.instanceId);
              if (idx !== -1) {
                player[zone].splice(idx, 1);
                this.discardCardFromPlay(player.id, c, zone);
              }
            }
          }
          player.adventures.splice(advIndex, 1);
          opponent.discardPile.push(adventure);
          this.log(`${adventure.name} is solved!`);
          this.applyAdventureReward(playerId, adventure);
          this.notifyStateChange();
        }
        break;
      }

      case "Riding the Centaur": {
        const eligible = this.getCardsInPlay(player.id);
        if (playerId === 'player' || this.isMultiplayer) {
          const choices = eligible.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(playerId, "Riding the Centaur: Choose 4 of your cards in play to return to hand", choices, 4, 4, (selected) => {
            if (selected.length === 4) {
              selected.forEach(instId => {
                const zone = ['lessons', 'creatures', 'items', 'locations', 'adventures', 'matches', 'characters'].find(z => player[z] && player[z].some(c => c.instanceId === instId));
                if (zone) {
                  const idx = player[zone].findIndex(c => c.instanceId === instId);
                  if (idx !== -1) {
                    const [c] = player[zone].splice(idx, 1);
                    player.hand.push(c);
                    this.log(`Riding the Centaur: Returned ${c.name} from play to hand.`);
                  }
                }
              });
              const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
              if (idx !== -1) {
                player.adventures.splice(idx, 1);
                opponent.discardPile.push(adventure);
                this.log(`Riding the Centaur is solved!`);
                this.applyAdventureReward(playerId, adventure);
              }
              this.notifyStateChange();
            }
          }, adventure);
        } else {
          for (let i = 0; i < Math.min(4, eligible.length); i++) {
            const c = eligible[i];
            const zone = ['lessons', 'creatures', 'items', 'locations', 'adventures', 'matches', 'characters'].find(z => player[z] && player[z].some(card => card.instanceId === c.instanceId));
            if (zone) {
              const idx = player[zone].findIndex(card => card.instanceId === c.instanceId);
              if (idx !== -1) {
                player[zone].splice(idx, 1);
                player.hand.push(c);
                this.log(`Riding the Centaur: AI returned ${c.name} from play to hand.`);
              }
            }
          }
          player.adventures.splice(advIndex, 1);
          opponent.discardPile.push(adventure);
          this.log(`Riding the Centaur is solved!`);
          this.applyAdventureReward(playerId, adventure);
          this.notifyStateChange();
        }
        break;
      }

      case "Voldemort Revealed":
      case "Candy Cart": {
        const damage = adventure.name === "Voldemort Revealed" ? 7 : 10;
        this.log(`${player.name} takes ${damage} damage to solve ${adventure.name}.`);
        this.dealDamage(player.id, damage, 'adventure', adventure);
        player.adventures.splice(advIndex, 1);
        opponent.discardPile.push(adventure);
        this.log(`${adventure.name} is solved!`);
        this.applyAdventureReward(playerId, adventure);
        this.notifyStateChange();
        break;
      }

      case "5 Points from Gryffindor": {
        const handChoices = player.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        if (playerId === 'player' || this.isMultiplayer) {
          this.promptChoice(playerId, "5 Points from Gryffindor: Choose 5 cards from hand to discard", handChoices, 5, 5, (selected) => {
            if (selected.length === 5) {
              selected.forEach(instId => {
                const idx = player.hand.findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = player.hand.splice(idx, 1);
                  player.discardPile.push(c);
                }
              });
              this.log(`5 Points from Gryffindor: Discarded 5 cards from hand.`);
              const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
              if (idx !== -1) {
                player.adventures.splice(idx, 1);
                opponent.discardPile.push(adventure);
                this.log(`5 Points from Gryffindor is solved!`);
                this.applyAdventureReward(playerId, adventure);
              }
              this.notifyStateChange();
            }
          }, adventure);
        } else {
          for (let i = 0; i < 5; i++) {
            const idx = Math.floor(Math.random() * player.hand.length);
            const [c] = player.hand.splice(idx, 1);
            player.discardPile.push(c);
          }
          this.log(`5 Points from Gryffindor: AI discarded 5 cards from hand.`);
          player.adventures.splice(advIndex, 1);
          opponent.discardPile.push(adventure);
          this.log(`5 Points from Gryffindor is solved!`);
          this.applyAdventureReward(playerId, adventure);
          this.notifyStateChange();
        }
        break;
      }

      case "Flying Practice": {
        const quidChoices = player.hand.filter(c => c.lessonCost?.type === 'Quidditch');
        if (playerId === 'player' || this.isMultiplayer) {
          const choices = quidChoices.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(playerId, "Flying Practice: Choose 4 Quidditch cards from hand to discard", choices, 4, 4, (selected) => {
            if (selected.length === 4) {
              selected.forEach(instId => {
                const idx = player.hand.findIndex(c => c.instanceId === instId);
                if (idx !== -1) {
                  const [c] = player.hand.splice(idx, 1);
                  player.discardPile.push(c);
                }
              });
              this.log(`Flying Practice: Discarded 4 Quidditch cards from hand.`);
              const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
              if (idx !== -1) {
                player.adventures.splice(idx, 1);
                opponent.discardPile.push(adventure);
                this.log(`Flying Practice is solved!`);
                this.applyAdventureReward(playerId, adventure);
              }
              this.notifyStateChange();
            }
          }, adventure);
        } else {
          for (let i = 0; i < 4; i++) {
            const c = quidChoices[i];
            player.hand.splice(player.hand.indexOf(c), 1);
            player.discardPile.push(c);
          }
          this.log(`Flying Practice: AI discarded 4 Quidditch cards.`);
          player.adventures.splice(advIndex, 1);
          opponent.discardPile.push(adventure);
          this.log(`Flying Practice is solved!`);
          this.applyAdventureReward(playerId, adventure);
          this.notifyStateChange();
        }
        break;
      }

      case "Looking for Trevor": {
        const choices = player.lessons.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        if (playerId === 'player' || this.isMultiplayer) {
          this.promptChoice(playerId, "Looking for Trevor: Choose 2 of your Lessons in play to discard", choices, 2, 2, (selected) => {
            if (selected.length === 2) {
              selected.forEach(instId => {
                const idx = player.lessons.findIndex(l => l.instanceId === instId);
                if (idx !== -1) {
                  const [l] = player.lessons.splice(idx, 1);
                  this.discardCardFromPlay(player.id, l, 'lessons');
                }
              });
              const idx = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
              if (idx !== -1) {
                player.adventures.splice(idx, 1);
                opponent.discardPile.push(adventure);
                this.log(`Looking for Trevor is solved!`);
                this.applyAdventureReward(playerId, adventure);
              }
              this.notifyStateChange();
            }
          }, adventure);
        } else {
          for (let i = 0; i < 2; i++) {
            const l = player.lessons[0];
            player.lessons.splice(0, 1);
            this.discardCardFromPlay(player.id, l, 'lessons');
          }
          player.adventures.splice(advIndex, 1);
          opponent.discardPile.push(adventure);
          this.log(`Looking for Trevor is solved!`);
          this.applyAdventureReward(playerId, adventure);
          this.notifyStateChange();
        }
        break;
      }
    }
  }

  // Apply reward from solved adventure card
  applyAdventureReward(playerId, adventure) {
    const player = this.players[playerId];
    const opponent = this.players[playerId === 'player' ? 'opponent' : 'player'];

    const rewardDescriptions = {
      "Dragon's Escape": "Draw 3 cards OR deal 3 damage to opponent.",
      "Gringotts' Cart Ride": "Draw 5 cards.",
      "Human Chess Game": "Draw 3 cards.",
      "Troll in the Bathroom": "Opponent takes 4 damage.",
      "Harry Hunting": "Search discard pile for a Lesson card and put it into play.",
      "Meet the Centaurs": "Opponent plays with hand face up for the rest of the game.",
      "4 Privet Drive": "Draw 1 card.",
      "Diagon Alley": "Choose how many cards to draw (up to your deck size).",
      "Hiding From Snape": "Search deck for any card and put it into hand.",
      "Peeves Causes Trouble": "Opponent takes 3 damage.",
      "Reptile House": "Draw 1 card.",
      "Unusual Pets": "Draw 1 card.",
      "Gaze into the Mirror": "Get 1 more Action (the turn this adventure is solved).",
      "Hagrid Needs Help": "Draw 3 cards.",
      "In the Stands": "Draw 1 card.",
      "Into the Forbidden Forest": "Draw 1 card.",
      "Letters From No One": "Draw 2 cards.",
      "Through the Arch": "Put an Item from discard pile into your hand.",
      "Pep Talk": "Draw 2 cards.",
      "Race for the Snitch": "Opponent discards their hand.",
      "Snape's Bias": "Draw 1 card.",
      "Sticking Up for Neville": "Put up to 4 non-Healing cards from discard pile on bottom of deck.",
      "Detention!": "Solver draws a card.",
      "Finding the Platform": "Solver may put a Lesson card from hand into play.",
      "Hut on the Rock": "Controller takes 5 damage.",
      "Meeting Fluffy": "Solver gets +1 Action this turn.",
      "Midnight Duel": "Solver draws 4 cards.",
      "Riding the Centaur": "Solver draws 1 card.",
      "Stoat Sandwiches": "Solver shuffles up to 5 non-Healing cards from discard into deck.",
      "Voldemort Revealed": "Solver puts up to 2 non-Healing cards from discard on bottom of deck.",
      "5 Points from Gryffindor": "Controller takes 5 damage.",
      "Candy Cart": "Solver draws 1 card.",
      "Flying Practice": "Controller takes 2 damage.",
      "Looking for Trevor": "Solver searches deck for a Creature card to hand.",
      "Running from Filch": "Solver draws 3 cards.",
      "Through the Trapdoor": "Controller takes 1 damage."
    };

    const rewardDescription = rewardDescriptions[adventure.name] || "No reward description available.";
    if (this.onAdventureSolvedCallback) {
      this.onAdventureSolvedCallback(adventure, rewardDescription, playerId);
    }

    switch (adventure.name) {
      case "Dragon's Escape": {
        const choices = [
          { id: 'draw', label: 'Draw 3 cards' },
          { id: 'damage', label: `Deal 3 damage to ${opponent.name}` }
        ];
        this.promptChoice(playerId, "Dragon's Escape Reward: Choose your reward", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'draw') {
            this.drawCards(playerId, 3, false);
            this.log(`Dragon's Escape Reward: ${player.name} drew 3 cards.`);
          } else if (sel === 'damage') {
            this.log(`Dragon's Escape Reward: ${player.name} deals 3 damage to ${opponent.name}.`);
            this.dealDamage(opponent.id, 3, 'adventure');
          }
          this.notifyStateChange();
        }, adventure);
        break;
      }

      case "Gringotts' Cart Ride": {
        const choices = [
          { id: 'yes', label: 'Draw 5 cards' },
          { id: 'no', label: 'Do not draw' }
        ];
        this.promptChoice(playerId, "Gringotts' Cart Ride Reward: Do you want to draw 5 cards?", choices, 1, 1, (selected) => {
          if (selected[0] === 'yes') {
            this.drawCards(playerId, 5, false);
            this.log(`Gringotts' Cart Ride Reward: ${player.name} chose to draw 5 cards.`);
          } else {
            this.log(`Gringotts' Cart Ride Reward: ${player.name} chose not to draw cards.`);
          }
          this.notifyStateChange();
        }, adventure);
        break;
      }

      case "Human Chess Game": {
        const choices = [
          { id: 'yes', label: 'Draw 3 cards' },
          { id: 'no', label: 'Do not draw' }
        ];
        this.promptChoice(playerId, "Human Chess Game Reward: Do you want to draw 3 cards?", choices, 1, 1, (selected) => {
          if (selected[0] === 'yes') {
            this.drawCards(playerId, 3, false);
            this.log(`Human Chess Game Reward: ${player.name} chose to draw 3 cards.`);
          } else {
            this.log(`Human Chess Game Reward: ${player.name} chose not to draw cards.`);
          }
          this.notifyStateChange();
        }, adventure);
        break;
      }

      case "Troll in the Bathroom": {
        this.log(`Troll in the Bathroom Reward: Caster (${opponent.name}) takes 4 damage.`);
        this.dealDamage(opponent.id, 4, 'adventure');
        this.notifyStateChange();
        break;
      }

      case "Harry Hunting": {
        const lessons = player.discardPile.filter(c => c.type === 'Lesson');
        if (lessons.length > 0) {
          const choices = lessons.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(playerId, "Harry Hunting Reward: Choose a Lesson to put into play", choices, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const idx = player.discardPile.findIndex(c => c.instanceId === sel);
              if (idx !== -1) {
                const [l] = player.discardPile.splice(idx, 1);
                player.lessons.push(l);
                this.log(`Harry Hunting Reward: Put ${l.name} into play.`);
              }
              this.notifyStateChange();
            }
          }, adventure);
        } else {
          this.log(`Harry Hunting Reward: No Lesson in discard pile to put in play.`);
          this.notifyStateChange();
        }
        break;
      }

      case "Meet the Centaurs": {
        opponent.revealHandRestOfGame = true;
        this.log(`Meet the Centaurs Reward: ${opponent.name} plays with hand face up for the rest of the game.`);
        this.notifyStateChange();
        break;
      }

      case "4 Privet Drive": {
        const choices = [
          { id: 'yes', label: 'Draw 1 card' },
          { id: 'no', label: 'Do not draw' }
        ];
        this.promptChoice(playerId, "4 Privet Drive Reward: Do you want to draw 1 card?", choices, 1, 1, (selected) => {
          if (selected[0] === 'yes') {
            this.drawCard(playerId, false);
            this.log(`4 Privet Drive Reward: ${player.name} chose to draw a card.`);
          } else {
            this.log(`4 Privet Drive Reward: ${player.name} chose not to draw cards.`);
          }
          this.notifyStateChange();
        }, adventure);
        break;
      }

      case "Diagon Alley": {
        const maxDraw = player.deck.length;
        const choices = Array.from({ length: maxDraw + 1 }, (_, i) => ({ id: `draw-${i}`, label: `Draw ${i} card(s)` }));
        this.promptChoice(playerId, `Diagon Alley Reward: Choose how many cards to draw (0-${maxDraw})`, choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const count = parseInt(sel.split('-')[1], 10);
            this.drawCards(playerId, count, false);
            this.log(`Diagon Alley Reward: ${player.name} drew ${count} card(s).`);
            this.notifyStateChange();
          }
        }, adventure);
        break;
      }

      case "Hiding From Snape": {
        const choices = player.deck.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        this.promptChoice(playerId, "Hiding From Snape Reward: Choose a card from your deck to take", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const idx = player.deck.findIndex(c => c.instanceId === sel);
            if (idx !== -1) {
              const [c] = player.deck.splice(idx, 1);
              player.hand.push(c);
              this.log(`Hiding From Snape Reward: Put ${c.name} into hand.`);
            }
            this.shuffle(player.deck);
            this.log(`${player.name} shuffled their deck.`);
            this.notifyStateChange();
          }
        }, adventure);
        break;
      }

      case "Peeves Causes Trouble": {
        this.log(`Peeves Causes Trouble Reward: Caster (${opponent.name}) takes 3 damage.`);
        this.dealDamage(opponent.id, 3, 'adventure');
        this.notifyStateChange();
        break;
      }

      case "Reptile House": {
        const choices = [
          { id: 'yes', label: 'Draw 1 card' },
          { id: 'no', label: 'Do not draw' }
        ];
        this.promptChoice(playerId, "Reptile House Reward: Do you want to draw 1 card?", choices, 1, 1, (selected) => {
          if (selected[0] === 'yes') {
            this.drawCard(playerId, false);
            this.log(`Reptile House Reward: ${player.name} chose to draw a card.`);
          } else {
            this.log(`Reptile House Reward: ${player.name} chose not to draw cards.`);
          }
          this.notifyStateChange();
        }, adventure);
        break;
      }

      case "Unusual Pets": {
        const choices = [
          { id: 'yes', label: 'Draw 1 card' },
          { id: 'no', label: 'Do not draw' }
        ];
        this.promptChoice(playerId, "Unusual Pets Reward: Do you want to draw 1 card?", choices, 1, 1, (selected) => {
          if (selected[0] === 'yes') {
            this.drawCard(playerId, false);
            this.log(`Unusual Pets Reward: ${player.name} chose to draw a card.`);
          } else {
            this.log(`Unusual Pets Reward: ${player.name} chose not to draw cards.`);
          }
          this.notifyStateChange();
        }, adventure);
        break;
      }

      case "Gaze into the Mirror": {
        this.actionsRemaining++;
        this.log(`Gaze into the Mirror Reward: ${player.name} gets 1 more Action.`);
        this.notifyStateChange();
        break;
      }

      case "Hagrid Needs Help": {
        const choices = [
          { id: 'yes', label: 'Draw 3 cards' },
          { id: 'no', label: 'Do not draw' }
        ];
        this.promptChoice(playerId, "Hagrid Needs Help Reward: Do you want to draw 3 cards?", choices, 1, 1, (selected) => {
          if (selected[0] === 'yes') {
            this.drawCards(playerId, 3, false);
            this.log(`Hagrid Needs Help Reward: ${player.name} chose to draw 3 cards.`);
          } else {
            this.log(`Hagrid Needs Help Reward: ${player.name} chose not to draw cards.`);
          }
          this.notifyStateChange();
        }, adventure);
        break;
      }

      case "In the Stands": {
        const choices = [
          { id: 'yes', label: 'Draw 1 card' },
          { id: 'no', label: 'Do not draw' }
        ];
        this.promptChoice(playerId, "In the Stands Reward: Do you want to draw 1 card?", choices, 1, 1, (selected) => {
          if (selected[0] === 'yes') {
            this.drawCard(playerId, false);
            this.log(`In the Stands Reward: ${player.name} chose to draw a card.`);
          } else {
            this.log(`In the Stands Reward: ${player.name} chose not to draw cards.`);
          }
          this.notifyStateChange();
        }, adventure);
        break;
      }

      case "Into the Forbidden Forest": {
        const choices = [
          { id: 'yes', label: 'Draw 1 card' },
          { id: 'no', label: 'Do not draw' }
        ];
        this.promptChoice(playerId, "Into the Forbidden Forest Reward: Do you want to draw 1 card?", choices, 1, 1, (selected) => {
          if (selected[0] === 'yes') {
            this.drawCard(playerId, false);
            this.log(`Into the Forbidden Forest Reward: ${player.name} chose to draw a card.`);
          } else {
            this.log(`Into the Forbidden Forest Reward: ${player.name} chose not to draw cards.`);
          }
          this.notifyStateChange();
        }, adventure);
        break;
      }

      case "Pep Talk": {
        const choices = [
          { id: 'yes', label: 'Draw 2 cards' },
          { id: 'no', label: 'Do not draw' }
        ];
        this.promptChoice(playerId, "Pep Talk Reward: Do you want to draw 2 cards?", choices, 1, 1, (selected) => {
          if (selected[0] === 'yes') {
            this.drawCards(playerId, 2, false);
            this.log(`Pep Talk Reward: ${player.name} chose to draw 2 cards.`);
          } else {
            this.log(`Pep Talk Reward: ${player.name} chose not to draw cards.`);
          }
          this.notifyStateChange();
        }, adventure);
        break;
      }

      case "Race for the Snitch": {
        const count = opponent.hand.length;
        opponent.discardPile.push(...opponent.hand);
        opponent.hand = [];
        this.log(`Race for the Snitch Reward: ${opponent.name} discarded their hand (${count} card(s)).`);
        this.notifyStateChange();
        break;
      }

      case "Snape's Bias": {
        const choices = [
          { id: 'yes', label: 'Draw 1 card' },
          { id: 'no', label: 'Do not draw' }
        ];
        this.promptChoice(playerId, "Snape's Bias Reward: Do you want to draw 1 card?", choices, 1, 1, (selected) => {
          if (selected[0] === 'yes') {
            this.drawCard(playerId, false);
            this.log(`Snape's Bias Reward: ${player.name} chose to draw a card.`);
          } else {
            this.log(`Snape's Bias Reward: ${player.name} chose not to draw cards.`);
          }
          this.notifyStateChange();
        }, adventure);
        break;
      }

      case "Sticking Up for Neville": {
        const nonHealing = player.discardPile.filter(c => !this.isHealingCard(c));
        const maxReturn = Math.min(4, nonHealing.length);
        if (maxReturn === 0) {
          this.log(`Sticking Up for Neville Reward: No eligible non-Healing cards in discard pile.`);
          this.notifyStateChange();
          break;
        }
        if (playerId === 'player' || this.isMultiplayer) {
          const choices = nonHealing.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(playerId, `Sticking Up for Neville Reward: Select up to ${maxReturn} cards to put at bottom of deck`, choices, 0, maxReturn, (selected) => {
            selected.forEach(instId => {
              const idx = player.discardPile.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.discardPile.splice(idx, 1);
                player.deck.unshift(c);
              }
            });
            this.log(`Sticking Up for Neville Reward: Returned ${selected.length} card(s) to bottom of deck.`);
            this.notifyStateChange();
          });
        } else {
          const toReturn = nonHealing.slice(0, maxReturn);
          toReturn.forEach(c => {
            const idx = player.discardPile.indexOf(c);
            if (idx !== -1) {
              player.discardPile.splice(idx, 1);
              player.deck.unshift(c);
            }
          });
          this.log(`Sticking Up for Neville Reward: AI returned ${toReturn.length} card(s) to bottom of deck.`);
          this.notifyStateChange();
        }
        break;
      }

      case "Detention!": {
        this.drawCard(player.id, false);
        this.log(`Detention! Reward: ${player.name} drew a card.`);
        break;
      }

      case "Finding the Platform": {
        const playerLessons = player.hand.filter(c => c.type === 'Lesson');
        if (playerLessons.length > 0) {
          if (player.id === 'player' || this.isMultiplayer) {
            const choices = player.hand.map(c => ({ id: c.instanceId, label: c.name, card: c, disabled: c.type !== 'Lesson' }));
            choices.push({ id: 'none', label: 'Do not play a Lesson' });
            this.promptChoice(player.id, "Finding the Platform Reward: You may put a Lesson card into play", choices, 1, 1, (selected) => {
              const sel = selected[0];
              if (sel && sel !== 'none') {
                const idx = player.hand.findIndex(c => c.instanceId === sel);
                if (idx !== -1) {
                  const [l] = player.hand.splice(idx, 1);
                  player.lessons.push(l);
                  this.log(`Finding the Platform Reward: ${player.name} put Lesson ${l.name} into play.`);
                }
              }
              this.notifyStateChange();
            });
          } else {
            const [l] = player.hand.splice(player.hand.indexOf(playerLessons[0]), 1);
            player.lessons.push(l);
            this.log(`Finding the Platform Reward: AI put Lesson ${l.name} into play.`);
          }
        }
        break;
      }

      case "Hut on the Rock": {
        this.log(`Hut on the Rock Reward: Controller ${opponent.name} takes 5 damage.`);
        this.dealDamage(opponent.id, 5, 'adventure');
        break;
      }

      case "Meeting Fluffy": {
        this.actionsRemaining++;
        this.log(`Meeting Fluffy Reward: ${player.name} gets +1 Action this turn.`);
        break;
      }

      case "Midnight Duel": {
        this.drawCards(player.id, 4, false);
        this.log(`Midnight Duel Reward: ${player.name} drew 4 cards.`);
        break;
      }

      case "Riding the Centaur": {
        this.drawCard(player.id, false);
        this.log(`Riding the Centaur Reward: ${player.name} drew 1 card.`);
        break;
      }

      case "Stoat Sandwiches": {
        const nonHealing = player.discardPile.filter(c => !this.isHealingCard(c));
        const maxReturn = Math.min(5, nonHealing.length);
        if (maxReturn === 0) {
          this.log(`Stoat Sandwiches Reward: No eligible non-Healing cards in discard pile.`);
          break;
        }
        if (playerId === 'player' || this.isMultiplayer) {
          const choices = nonHealing.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(playerId, `Stoat Sandwiches Reward: Select up to ${maxReturn} cards to shuffle into deck`, choices, 0, maxReturn, (selected) => {
            selected.forEach(instId => {
              const idx = player.discardPile.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.discardPile.splice(idx, 1);
                player.deck.push(c);
              }
            });
            this.shuffle(player.deck);
            this.log(`Stoat Sandwiches Reward: Shuffled ${selected.length} card(s) into deck.`);
            this.notifyStateChange();
          });
        } else {
          for (let i = 0; i < maxReturn; i++) {
            const [c] = player.discardPile.splice(player.discardPile.indexOf(nonHealing[i]), 1);
            player.deck.push(c);
          }
          this.shuffle(player.deck);
          this.log(`Stoat Sandwiches Reward: AI shuffled ${maxReturn} card(s) into deck.`);
        }
        break;
      }

      case "Voldemort Revealed": {
        const nonHealing = player.discardPile.filter(c => !this.isHealingCard(c));
        const maxReturn = Math.min(2, nonHealing.length);
        if (maxReturn === 0) {
          this.log(`Voldemort Revealed Reward: No eligible non-Healing cards in discard pile.`);
          break;
        }
        if (playerId === 'player' || this.isMultiplayer) {
          const choices = nonHealing.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(playerId, `Voldemort Revealed Reward: Select up to ${maxReturn} cards to put at bottom of deck`, choices, 0, maxReturn, (selected) => {
            selected.forEach(instId => {
              const idx = player.discardPile.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.discardPile.splice(idx, 1);
                player.deck.unshift(c);
              }
            });
            this.log(`Voldemort Revealed Reward: Put ${selected.length} card(s) at bottom of deck.`);
            this.notifyStateChange();
          });
        } else {
          for (let i = 0; i < maxReturn; i++) {
            const [c] = player.discardPile.splice(player.discardPile.indexOf(nonHealing[i]), 1);
            player.deck.unshift(c);
          }
          this.log(`Voldemort Revealed Reward: AI put ${maxReturn} card(s) at bottom of deck.`);
        }
        break;
      }

      case "5 Points from Gryffindor": {
        this.log(`5 Points from Gryffindor Reward: Controller ${opponent.name} takes 5 damage.`);
        this.dealDamage(opponent.id, 5, 'adventure');
        break;
      }

      case "Candy Cart": {
        this.drawCard(player.id, false);
        this.log(`Candy Cart Reward: ${player.name} drew a card.`);
        break;
      }

      case "Flying Practice": {
        this.log(`Flying Practice Reward: Controller ${opponent.name} takes 2 damage.`);
        this.dealDamage(opponent.id, 2, 'adventure');
        break;
      }

      case "Looking for Trevor": {
        const creatures = player.deck.filter(c => c.type === 'Creature');
        if (creatures.length > 0) {
          if (playerId === 'player' || this.isMultiplayer) {
            const choices = creatures.map(c => ({ id: c.instanceId, label: c.name, card: c }));
            this.promptChoice(playerId, "Looking for Trevor Reward: Choose a Creature card from deck", choices, 0, 1, (selected) => {
              const sel = selected[0];
              if (sel) {
                const idx = player.deck.findIndex(c => c.instanceId === sel);
                if (idx !== -1) {
                  const [c] = player.deck.splice(idx, 1);
                  player.hand.push(c);
                  this.log(`Looking for Trevor Reward: Added Creature ${c.name} to hand from deck.`);
                }
              }
              this.shuffle(player.deck);
              this.notifyStateChange();
            });
          } else {
            const [c] = player.deck.splice(player.deck.indexOf(creatures[0]), 1);
            player.hand.push(c);
            this.shuffle(player.deck);
            this.log(`Looking for Trevor Reward: AI added Creature ${c.name} to hand.`);
          }
        } else {
          this.shuffle(player.deck);
        }
        break;
      }

      case "Running from Filch": {
        this.drawCards(player.id, 3, false);
        this.log(`Running from Filch Reward: ${player.name} drew 3 cards.`);
        break;
      }
      
      case "Letters From No One": {
        const choices = [
          { id: 'yes', label: 'Draw 2 cards' },
          { id: 'no', label: 'Do not draw' }
        ];
        this.promptChoice(playerId, "Letters From No One Reward: Do you want to draw 2 cards?", choices, 1, 1, (selected) => {
          if (selected[0] === 'yes') {
            this.drawCards(playerId, 2, false);
            this.log(`Letters From No One Reward: ${player.name} chose to draw 2 cards.`);
          } else {
            this.log(`Letters From No One Reward: ${player.name} chose not to draw cards.`);
          }
          this.notifyStateChange();
        }, adventure);
        break;
      }
      
      case "Through the Arch": {
        const itemsInDiscard = player.discardPile.filter(c => c.type === 'Item');
        if (itemsInDiscard.length > 0) {
          const choices = itemsInDiscard.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(playerId, "Through the Arch Reward: Choose an Item card from discard pile to put into hand", choices, 0, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const idx = player.discardPile.findIndex(c => c.instanceId === sel);
              if (idx !== -1) {
                const [item] = player.discardPile.splice(idx, 1);
                player.hand.push(item);
                this.log(`Through the Arch Reward: Added ${item.name} from discard pile to hand.`);
              }
            }
            this.notifyStateChange();
          }, adventure);
        } else {
          this.log(`Through the Arch Reward: No Item cards in discard pile.`);
          this.notifyStateChange();
        }
        break;
      }
    }
  }

  canActivateLocationAbility(playerId, location) {
    if (this.gameOver) return false;
    if (this.activePlayerId !== playerId) return false;
    const player = this.players[playerId];
    if (player.mustDrawFirstAction) return false;
    if (this.actionsRemaining < 1) return false;
    if (player.adventures.some(a => a.name === 'Letters From No One')) return false;

    switch (location.name) {
      case 'Flourish and Blotts':
        return player.lessons.length >= 2;
      case 'Cauldron Shop':
      case 'Quality Quidditch Supplies':
        return player.deck.length > 0;
      default:
        return false;
    }
  }

  activateLocationAbility(playerId, locationInstanceId) {
    const player = this.players[playerId];
    let location = this.players.player.locations.find(l => l.instanceId === locationInstanceId);
    if (!location) {
      location = this.players.opponent.locations.find(l => l.instanceId === locationInstanceId);
    }
    if (!location || !this.canActivateLocationAbility(playerId, location)) return;

    this.actionsRemaining--;

    switch (location.name) {
      case 'Flourish and Blotts': {
        const choices = player.lessons.map(c => ({ id: c.instanceId, label: c.name, card: c }));
        this.promptChoice(playerId, "Flourish and Blotts: Choose 2 Lessons in play to discard", choices, 2, 2, (selected) => {
          if (selected.length === 2) {
            selected.forEach(instId => {
              const idx = player.lessons.findIndex(l => l.instanceId === instId);
              if (idx !== -1) {
                const [l] = player.lessons.splice(idx, 1);
                player.discardPile.push(l);
              }
            });
            this.log(`${player.name} discarded 2 Lessons from play.`);
            this.drawCards(playerId, 5, false);
            this.log(`${player.name} drew 5 cards.`);
            this.notifyStateChange();
          }
        }, location);
        break;
      }

      case 'Cauldron Shop': {
        const eligibleItems = player.deck.filter(c => c.type === 'Item' && c.lessonCost && c.lessonCost.type === 'Potions');
        if (eligibleItems.length > 0) {
          const choices = eligibleItems.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(playerId, "Cauldron Shop: Select an Item card that needs Potions [P] Power to put into hand", choices, 0, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const idx = player.deck.findIndex(c => c.instanceId === sel);
              if (idx !== -1) {
                const [item] = player.deck.splice(idx, 1);
                player.hand.push(item);
                this.log(`${player.name} found Item: ${item.name} and put it into hand.`);
              }
            }
            this.shuffle(player.deck);
            this.notifyStateChange();
          }, location);
        } else {
          this.log(`${player.name} searched deck but found no eligible Items.`);
          this.shuffle(player.deck);
          this.notifyStateChange();
        }
        break;
      }

      case 'Quality Quidditch Supplies': {
        const eligibleItems = player.deck.filter(c => c.type === 'Item' && c.lessonCost && c.lessonCost.type === 'Quidditch');
        if (eligibleItems.length > 0) {
          const choices = eligibleItems.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(playerId, "Quality Quidditch Supplies: Select an Item card that needs Quidditch [Q] Power to put into hand", choices, 0, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const idx = player.deck.findIndex(c => c.instanceId === sel);
              if (idx !== -1) {
                const [item] = player.deck.splice(idx, 1);
                player.hand.push(item);
                this.log(`${player.name} found Item: ${item.name} and put it into hand.`);
              }
            }
            this.shuffle(player.deck);
            this.notifyStateChange();
          }, location);
        } else {
          this.log(`${player.name} searched deck but found no eligible Items.`);
          this.shuffle(player.deck);
          this.notifyStateChange();
        }
        break;
      }
    }
  }

  getCreatureHealth(creature) {
    let health = creature.health;
    const isEeylopsActive = this.players.player.locations.some(l => l.name === 'Eeylops Owl Emporium') ||
                            this.players.opponent.locations.some(l => l.name === 'Eeylops Owl Emporium');
    if (isEeylopsActive && creature.subTypes && creature.subTypes.includes('Owl')) {
      health += 1;
    }
    return health;
  }

  getCreatureDamage(playerId, creature) {
    let dmg = creature.damagePerTurn || 0;
    if (dmg <= 0) return 0;
    const player = this.players[playerId];
    const hasHagrid = player.characters.some(c => c.name === 'Rubeus Hagrid');
    if (hasHagrid && dmg >= 3) {
      dmg += 2;
    }
    const isEeylopsActive = this.players.player.locations.some(l => l.name === 'Eeylops Owl Emporium') ||
                            this.players.opponent.locations.some(l => l.name === 'Eeylops Owl Emporium');
    if (isEeylopsActive && creature.subTypes && creature.subTypes.includes('Owl')) {
      dmg += 1;
    }

    if (creature.name === 'Marble Gargoyle') {
      const opponent = this.players[playerId === 'player' ? 'opponent' : 'player'];
      if (opponent.creatures.length === 0) {
        dmg += 3;
      }
    }
    if (creature.name === 'Sandstone Gargoyle') {
      const opponent = this.players[playerId === 'player' ? 'opponent' : 'player'];
      if (opponent.creatures.length === 0) {
        dmg += 2;
      }
    }

    return dmg;
  }

  discardCardFromPlay(playerId, card, sourceZone = null) {
    const player = this.players[playerId];
    
    // 1. Remove from source zone if specified
    if (sourceZone && player[sourceZone]) {
      const idx = player[sourceZone].findIndex(c => c.instanceId === card.instanceId);
      if (idx !== -1) {
        player[sourceZone].splice(idx, 1);
      }
    }
    
    const cardType = card.type;
    const lType = card.provides?.type || card.lessonType;
    
    // 2. Replacements for Lessons
    if (cardType === 'Lesson') {
      const isHagridsHouseActive = this.players.player.locations.some(l => l.name === "Hagrid's House") ||
                                   this.players.opponent.locations.some(l => l.name === "Hagrid's House");
      const isPotionsDungeonActive = this.players.player.locations.some(l => l.name === 'Potions Dungeon') ||
                                     this.players.opponent.locations.some(l => l.name === 'Potions Dungeon');

      if (isHagridsHouseActive && lType === 'Care of Magical Creatures') {
        player.hand.push(card);
        this.log(`Hagrid's House: Discarded lesson ${card.name} returned to ${player.name}'s hand instead of discard pile.`);
        return;
      }
      if (isPotionsDungeonActive && lType === 'Potions') {
        player.hand.push(card);
        this.log(`Potions Dungeon: Discarded lesson ${card.name} returned to ${player.name}'s hand instead of discard pile.`);
        return;
      }
    }
    
    // 3. Replacements for Items
    if (card.name === 'Collapsible Cauldron') {
      player.hand.push(card);
      this.log(`Collapsible Cauldron: Returned to ${player.name}'s hand instead of discard pile.`);
      return;
    }
    
    // 4. Default: put in discard pile
    player.discardPile.push(card);
    this.log(`${player.name} discarded ${card.name} from play.`);
  }

  // Deal damage to a player (forces discarding top of deck)
  dealDamage(targetPlayerId, amount, damageSource = 'spell', card = null) {
    if (!card && damageSource === 'spell' && this.currentlyResolvingSpell) {
      card = this.currentlyResolvingSpell;
    }
    const target = this.players[targetPlayerId];
    const hasComet = target.items.some(i => i.name === 'Comet Two Sixty');
    const isOpponentTurn = this.activePlayerId !== targetPlayerId;

    if (amount > 0 && hasComet && isOpponentTurn && !target.usedCometTwoSixtyThisTurn) {
      const choices = [
        { id: 'no-prevent-comet', label: `Do not prevent (take ${amount} damage)` },
        { id: 'prevent-comet', label: 'Use Comet Two Sixty to prevent 1 damage' }
      ];
      this.promptChoice(targetPlayerId, `Comet Two Sixty: Choose whether to prevent 1 damage`, choices, 1, 1, (selected) => {
        const sel = selected[0];
        if (sel === 'prevent-comet') {
          target.usedCometTwoSixtyThisTurn = true;
          this.log(`Comet Two Sixty: Prevented 1 damage.`);
          this.checkHospitalDormitory(targetPlayerId, amount - 1, damageSource, card);
        } else {
          this.checkHospitalDormitory(targetPlayerId, amount, damageSource, card);
        }
      });
      return;
    }

    this.checkHospitalDormitory(targetPlayerId, amount, damageSource, card);
  }

  checkHospitalDormitory(targetPlayerId, amount, damageSource = 'spell', card = null) {
    const target = this.players[targetPlayerId];
    const isHospitalActive = this.players.player.locations.some(l => l.name === 'Hospital Dormitory') ||
                             this.players.opponent.locations.some(l => l.name === 'Hospital Dormitory');
    if (isHospitalActive && amount > 0) {
      const alreadyPrevented = target.hospitalDormitoryPreventedThisTurn || 0;
      if (alreadyPrevented < 4) {
        const canPrevent = 4 - alreadyPrevented;
        const choices = [];
        for (let i = 0; i <= Math.min(amount, canPrevent); i++) {
          choices.push({ id: `prevent-${i}`, label: `Prevent ${i} damage (taken: ${amount - i})` });
        }
        
        if (targetPlayerId === 'player' || this.isMultiplayer) {
          this.promptChoice(targetPlayerId, `Hospital Dormitory: You may prevent up to ${Math.min(amount, canPrevent)} damage.`, choices, 1, 1, (selected) => {
            const sel = selected[0];
            const pAmt = parseInt(sel.split('-')[1], 10);
            if (pAmt > 0) {
              target.hospitalDormitoryPreventedThisTurn = alreadyPrevented + pAmt;
              this.log(`Hospital Dormitory: Prevented ${pAmt} damage (Total prevented this turn: ${target.hospitalDormitoryPreventedThisTurn}/4).`);
              this.proceedWithDealDamage(targetPlayerId, amount - pAmt, damageSource, card);
            } else {
              this.proceedWithDealDamage(targetPlayerId, amount, damageSource, card);
            }
          });
          return;
        } else {
          const pAmt = Math.min(amount, canPrevent);
          target.hospitalDormitoryPreventedThisTurn = alreadyPrevented + pAmt;
          this.log(`Hospital Dormitory: AI prevented ${pAmt} damage.`);
          this.proceedWithDealDamage(targetPlayerId, amount - pAmt, damageSource, card);
          return;
        }
      }
    }

    this.proceedWithDealDamage(targetPlayerId, amount, damageSource, card);
  }

  proceedWithDealDamage(targetPlayerId, amount, damageSource = 'spell', card = null) {
    const target = this.players[targetPlayerId];
    
    // Madam Malkin's Robes reduction: Whenever a card does damage, it does 1 less damage
    const isMadamMalkinActive = this.players.player.locations.some(l => l.name === "Madam Malkin's Robes") ||
                                 this.players.opponent.locations.some(l => l.name === "Madam Malkin's Robes");
    if (isMadamMalkinActive && amount > 0) {
      amount = Math.max(0, amount - 1);
      this.log(`Madam Malkin's Robes: Player damage reduced by 1 (deals ${amount} total).`);
    }

    // Dragon-Hide Gloves reduction: Whenever a Creature does damage to you, prevent 1 of that damage.
    if (damageSource === 'creature' && amount > 0) {
      const hasGloves = target.items.some(i => i.name === 'Dragon-Hide Gloves');
      if (hasGloves) {
        amount = Math.max(0, amount - 1);
        this.log(`Dragon-Hide Gloves: Creature damage to ${target.name} reduced by 1 (deals ${amount} total).`);
      }
    }

    // Nimbus Two Thousand spell/item damage boost (+2 for Quidditch spells/items)
    if (amount > 0 && damageSource === 'spell') {
      const dealerId = targetPlayerId === 'player' ? 'opponent' : 'player';
      const dealer = this.players[dealerId];
      const hasNimbus = dealer.items.some(i => i.name === 'Nimbus Two Thousand');
      if (hasNimbus) {
        let isQuidditchDamage = false;
        if (card) {
          isQuidditchDamage = (card.lessonCost && card.lessonCost.type === 'Quidditch') || (card.text && (card.text.includes('[Q]') || card.text.includes('Quidditch')));
        }
        if (isQuidditchDamage) {
          amount += 2;
          this.log(`Nimbus Two Thousand: Spell/Item damage increased by +2 (deals ${amount} total).`);
        }
      }
      if (dealer.biasedCommentaryActive) {
        let isQuidditchDamage = false;
        if (card) {
          isQuidditchDamage = (card.lessonCost && card.lessonCost.type === 'Quidditch') || (card.text && (card.text.includes('[Q]') || card.text.includes('Quidditch')));
        }
        if (isQuidditchDamage) {
          amount += 5;
          dealer.biasedCommentaryActive = false;
          this.log(`Biased Commentary: Spell damage increased by +5 (deals ${amount} total).`);
        }
      }
    }

    // Into the Forbidden Forest: caster's creatures deal +1 damage to the adventure victim
    if (amount > 0 && damageSource === 'creature') {
      const hasForbiddenForest = target.adventures.some(a => a.name === 'Into the Forbidden Forest');
      if (hasForbiddenForest) {
        amount += 1;
        this.log(`Into the Forbidden Forest: Creature damage increased by +1 (deals ${amount} total).`);
      }
    }

    // Check damage prevention flags
    if (target.preventAllDamageNextTurn) {
      this.log(`All damage to ${target.name} is prevented (${target.preventAllDamageSource || 'Shrinking Potion'})!`);
      return;
    }
    if (damageSource === 'creature' || damageSource === 'adventure') {
      if (target.preventCreatureAdventureDamageNextTurn) {
        this.log(`Adventures and Creatures damage to ${target.name} is prevented (Dungbomb)!`);
        return;
      }
    }
    if (damageSource === 'creature') {
      if (target.preventCreatureDamageNextTurn) {
        this.log(`Creature damage to ${target.name} is prevented (${target.preventCreatureDamageSource || 'Wingardium Leviosa!'})!`);
        return;
      }
      const dealerId = targetPlayerId === 'player' ? 'opponent' : 'player';
      const dealer = this.players[dealerId];
      if (dealer.adventures.some(a => a.name === 'Riding the Centaur')) {
        this.log(`Creature damage to ${target.name} is prevented by Riding the Centaur!`);
        return;
      }
    }
    if (damageSource === 'spell') {
      if (target.preventSpellDamageNextTurn) {
        this.log(`Spell damage to ${target.name} is prevented by Fire Protection Potion!`);
        return;
      }
    }

    // Porcupine Robe: Track creatures that dealt damage to target player
    if (damageSource === 'creature' && amount > 0 && card) {
      if (!target.creaturesThatDealtDamageToMeThisTurn) {
        target.creaturesThatDealtDamageToMeThisTurn = [];
      }
      if (!target.creaturesThatDealtDamageToMeThisTurn.some(c => c.instanceId === card.instanceId)) {
        target.creaturesThatDealtDamageToMeThisTurn.push(card);
      }
    }

    if (damageSource === 'spell' && amount > 0) {
      const opponentId = targetPlayerId === 'player' ? 'opponent' : 'player';
      const opponent = this.players[opponentId];
      const hasGaze = opponent.adventures.some(a => a.name === 'Gaze into the Mirror');
      if (hasGaze && this.activePlayerId !== targetPlayerId) {
        this.log(`Gaze into the Mirror: Spell damage to ${target.name} is prevented during opponent's turn.`);
        return;
      }

      const hasCloak = target.items.some(i => i.name === 'Invisibility Cloak') && this.activePlayerId !== targetPlayerId && !target.preventSpellDamageOnceThisTurn;
      const hasIngredients = target.items.some(i => i.name === 'Potion Ingredients');

      if (hasCloak || hasIngredients) {
        const choices = [
          { id: 'no-prevent', label: 'Do not prevent (proceed to damage/redirection)' }
        ];
        if (hasCloak) {
          choices.push({ id: 'prevent-cloak', label: 'Use Invisibility Cloak to prevent all damage' });
        }
        if (hasIngredients) {
          const ingredientsCard = target.items.find(i => i.name === 'Potion Ingredients');
          choices.push({ id: `prevent-ingredients-${ingredientsCard.instanceId}`, label: 'Discard Potion Ingredients to prevent all damage', card: ingredientsCard });
        }

        this.promptChoice(targetPlayerId, `Prevent Spell Damage: Choose defense against ${amount} damage`, choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'prevent-cloak') {
            target.preventSpellDamageOnceThisTurn = true;
            this.log(`Invisibility Cloak: Prevented all spell damage this turn.`);
          } else if (sel && sel.startsWith('prevent-ingredients-')) {
            const instId = sel.split('-').slice(2).join('-');
            const idx = target.items.findIndex(i => i.instanceId === instId);
            if (idx !== -1) {
              const [c] = target.items.splice(idx, 1);
              target.discardPile.push(c);
              this.log(`Potion Ingredients: Discarded ${c.name} from play to prevent all spell damage.`);
            }
          } else {
            this.resolveRedirectionOrDamage(targetPlayerId, amount, damageSource, card);
          }
        });
        return;
      }
    }

    this.resolveRedirectionOrDamage(targetPlayerId, amount, damageSource, card);
  }

  resolveRedirectionOrDamage(targetPlayerId, amount, damageSource = 'spell', card = null) {
    const target = this.players[targetPlayerId];
    const dealerId = targetPlayerId === 'player' ? 'opponent' : 'player';
    const dealer = this.players[dealerId];

    let isQuidditchSpell = false;
    if (damageSource === 'spell' && card && card.type === 'Spell') {
      isQuidditchSpell = (card.lessonCost && card.lessonCost.type === 'Quidditch') || (card.text && (card.text.includes('[Q]') || card.text.includes('Quidditch')));
    }

    const hasOliver = dealer.characters.some(c => c.name === 'Oliver Wood');
    const usedOliver = dealer.usedOncePerGameAbilities?.['Oliver Wood'];

    if (amount > 0 && isQuidditchSpell && hasOliver && !usedOliver) {
      if (dealerId === 'player' || this.isMultiplayer) {
        const choices = [
          { id: 'no-oliver', label: `Deal original ${amount} damage` },
          { id: 'use-oliver', label: `Use Oliver Wood once-per-game ability (+8 damage, deal ${amount + 8} total)` }
        ];
        this.promptChoice(dealerId, `Oliver Wood: Deal 8 more damage?`, choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'use-oliver') {
            dealer.usedOncePerGameAbilities = dealer.usedOncePerGameAbilities || {};
            dealer.usedOncePerGameAbilities['Oliver Wood'] = true;
            this.log(`Oliver Wood: Activated once-per-game ability! Added 8 damage.`);
            this.proceedWithRedirectionOrDamage(targetPlayerId, amount + 8, damageSource, card);
          } else {
            this.proceedWithRedirectionOrDamage(targetPlayerId, amount, damageSource, card);
          }
        });
        return;
      } else {
        // AI opponent automatically activates Oliver Wood
        dealer.usedOncePerGameAbilities = dealer.usedOncePerGameAbilities || {};
        dealer.usedOncePerGameAbilities['Oliver Wood'] = true;
        this.log(`Oliver Wood: AI activated once-per-game ability! Added 8 damage.`);
        this.proceedWithRedirectionOrDamage(targetPlayerId, amount + 8, damageSource, card);
        return;
      }
    }

    this.proceedWithRedirectionOrDamage(targetPlayerId, amount, damageSource, card);
  }

  proceedWithRedirectionOrDamage(targetPlayerId, amount, damageSource = 'spell', card = null) {
    const target = this.players[targetPlayerId];
    const redirectOptions = target.creatures.filter(c => c.name === 'Pet Toad' || c.name === 'Kelpie' || c.name === 'Trevor');
    if (redirectOptions.length > 0) {
      const choices = [
        { id: 'no-redirect', label: `Discard ${amount} cards from deck` }
      ];
      redirectOptions.forEach(creature => {
        choices.push({
          id: `redirect-${creature.instanceId}`,
          label: `Redirect all ${amount} damage to ${creature.name} (${creature.damage || 0}/${creature.health})`,
          card: creature
        });
      });

      this.promptChoice(targetPlayerId, `Redirect Spell Damage: Choose where to apply ${amount} damage`, choices, 1, 1, (selected) => {
        const sel = selected[0];
        if (sel && sel.startsWith('redirect-')) {
          const instId = sel.split('-').slice(1).join('-');
          this.damageCreature(targetPlayerId, instId, amount);
        } else {
          this.applyDeckDamage(targetPlayerId, amount);
        }
      });
      return;
    }

    this.applyDeckDamage(targetPlayerId, amount);
  }

  applyNevilleDamageCap(targetPlayerId, amount) {
    const target = this.players[targetPlayerId];
    const nevilleActive = target.hasCharacterInPlay('Neville Longbottom');

    if (!nevilleActive || amount <= 0) {
      return amount;
    }

    const remainingDamage = Math.max(0, 8 - (target.damageTakenThisTurn || 0));
    const allowedDamage = Math.min(amount, remainingDamage);
    const prevented = amount - allowedDamage;

    if (prevented > 0) {
      this.log(
        `Neville Longbottom: Prevented ${prevented} damage (already took ${target.damageTakenThisTurn || 0} of max 8 this turn).`
      );
    }

    return allowedDamage;
  }

  applySlothGripDamageCap(targetPlayerId, amount) {
    const target = this.players[targetPlayerId];
    if (!target.slothGripActive || amount <= 0 || this.activePlayerId === targetPlayerId) {
      return amount;
    }

    const remainingDamage = Math.max(0, 3 - (target.damageTakenThisTurn || 0));
    const allowedDamage = Math.min(amount, remainingDamage);
    const prevented = amount - allowedDamage;

    if (prevented > 0) {
      this.log(
        `Sloth Grip: Prevented ${prevented} damage (already took ${target.damageTakenThisTurn || 0} of max 3 this turn).`
      );
    }

    return allowedDamage;
  }

  applyDeckDamage(targetPlayerId, amount) {
    const target = this.players[targetPlayerId];

    amount = this.applyNevilleDamageCap(targetPlayerId, amount);
    amount = this.applySlothGripDamageCap(targetPlayerId, amount);

    if (amount <= 0) {
      this.notifyStateChange();
      return;
    }

    target.damageTakenThisTurn = (target.damageTakenThisTurn || 0) + amount;

    this.log(`${target.name} takes ${amount} damage! Discarding cards from deck.`, 'damage');

    if (this.onDamageTakenCallback && amount > 0) {
      this.onDamageTakenCallback(targetPlayerId, amount);
    }

    // Match damage tracking
    if (amount > 0) {
      const damageDealerId = targetPlayerId === 'player' ? 'opponent' : 'player';
      const playerWithMatch = this.players.player.matches.length > 0 ? 'player' : (this.players.opponent.matches.length > 0 ? 'opponent' : null);
      if (playerWithMatch) {
        const matchCard = this.players[playerWithMatch].matches[0];
        const dealer = this.players[damageDealerId];
        dealer.matchDamageDealt = (dealer.matchDamageDealt || 0) + amount;
        this.log(`${dealer.name} has now dealt ${dealer.matchDamageDealt} damage towards the active Match.`);

        const toWinMatch = matchCard.text.match(/Do (\d+) damage/i);
        const targetDamage = toWinMatch ? parseInt(toWinMatch[1], 10) : 10;
        
        if (dealer.matchDamageDealt >= targetDamage) {
          this.winMatch(damageDealerId, matchCard, playerWithMatch);
        }
      }
    }
    
    let actualDiscarded = 0;
    for (let i = 0; i < amount; i++) {
      if (target.deck.length === 0) {
        if (this.isDebugMode) {
          this.log(`${target.name}'s deck is depleted. Damage ignored.`, 'damage');
        } else {
          this.log(`${target.name}'s deck is depleted. Game Over!`, 'damage');
          this.checkWinConditions();
        }
        break;
      }
      const discardedCard = target.deck.pop();
      target.discardPile.push(discardedCard);
      actualDiscarded++;
    }

    // Hagrid Needs Help solve progress
    if (actualDiscarded > 0) {
      const hasHagrid = target.adventures.find(a => a.name === 'Hagrid Needs Help');
      if (hasHagrid) {
        hasHagrid.damageTaken = (hasHagrid.damageTaken || 0) + actualDiscarded;
        this.log(`Hagrid Needs Help progress: ${hasHagrid.damageTaken}/8 damage taken.`);
        if (hasHagrid.damageTaken >= 8) {
          const idx = target.adventures.indexOf(hasHagrid);
          if (idx !== -1) {
            target.adventures.splice(idx, 1);
            const opponent = this.players[targetPlayerId === 'player' ? 'opponent' : 'player'];
            opponent.discardPile.push(hasHagrid);
            this.log(`Hagrid Needs Help is solved!`);
            this.applyAdventureReward(targetPlayerId, hasHagrid);
          }
        }
      }
    }

    this.notifyStateChange();
  }

  winMatch(winnerId, matchCard, ownerId) {
    this.log(`*** ${this.players[winnerId].name} wins the Match: ${matchCard.name}! ***`, 'victory');
    
    // Discard the match card
    const owner = this.players[ownerId];
    const matchIdx = owner.matches.indexOf(matchCard);
    if (matchIdx !== -1) {
      this.discardCardFromPlay(ownerId, matchCard, 'matches');
    }
    
    // Reset match progress
    this.players.player.matchDamageDealt = 0;
    this.players.opponent.matchDamageDealt = 0;

    // Trigger match won event
    if (this.onMatchWonCallback) {
      this.onMatchWonCallback(winnerId, matchCard);
    }

    // Resolve Match Prize
    this.resolveMatchPrize(winnerId, matchCard);
  }

  workOnMatch(playerId, matchInstanceId) {
    const player = this.players[playerId];
    if (this.actionsRemaining < 1 || player.hand.length === 0) return;
    
    const activeMatch = this.players.player.matches.find(m => m.instanceId === matchInstanceId) ||
                        this.players.opponent.matches.find(m => m.instanceId === matchInstanceId);
    if (!activeMatch || activeMatch.name !== 'Muddy Practice') return;
    
    const handChoices = player.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
    if (playerId === 'player' || this.isMultiplayer) {
      this.promptChoice(playerId, "Muddy Practice: Choose 1 card from hand to discard", handChoices, 1, 1, (selected) => {
        const sel = selected[0];
        if (sel) {
          const idx = player.hand.findIndex(c => c.instanceId === sel);
          if (idx !== -1) {
            const [c] = player.hand.splice(idx, 1);
            player.discardPile.push(c);
            this.actionsRemaining--;
            player.matchDamageDealt = (player.matchDamageDealt || 0) + 1;
            this.log(`${player.name} discarded ${c.name} to Muddy Practice (Progress: ${player.matchDamageDealt}/5).`);
            
            if (player.matchDamageDealt >= 5) {
              const ownerId = this.players.player.matches.some(m => m.instanceId === matchInstanceId) ? 'player' : 'opponent';
              this.winMatch(playerId, activeMatch, ownerId);
            } else {
              this.notifyStateChange();
            }
          }
        }
      });
    } else {
      const idx = Math.floor(Math.random() * player.hand.length);
      const [c] = player.hand.splice(idx, 1);
      player.discardPile.push(c);
      this.actionsRemaining--;
      player.matchDamageDealt = (player.matchDamageDealt || 0) + 1;
      this.log(`Muddy Practice: AI discarded ${c.name} (Progress: ${player.matchDamageDealt}/5).`);
      
      if (player.matchDamageDealt >= 5) {
        const ownerId = this.players.player.matches.some(m => m.instanceId === matchInstanceId) ? 'player' : 'opponent';
        this.winMatch(playerId, activeMatch, ownerId);
      } else {
        this.notifyStateChange();
      }
    }
  }

  resolveMatchPrize(winnerId, matchCard) {
    const winner = this.players[winnerId];
    const loserId = winnerId === 'player' ? 'opponent' : 'player';
    const loser = this.players[loserId];

    switch (matchCard.name) {
      case 'Practice Match': {
        const choices = [
          { id: 'yes', label: 'Draw 4 cards' },
          { id: 'no', label: 'Do not draw' }
        ];
        this.promptChoice(winnerId, "Practice Match Prize: Do you want to draw 4 cards?", choices, 1, 1, (selected) => {
          if (selected[0] === 'yes') {
            this.log(`${winner.name} chose to draw 4 cards.`);
            for (let i = 0; i < 4; i++) {
              this.drawCard(winnerId, false);
            }
          } else {
            this.log(`${winner.name} chose not to draw cards.`);
          }
          this.notifyStateChange();
        }, matchCard);
        break;
      }
      case 'Gryffindor Match': {
        this.log(`Gryffindor Match Prize: ${winner.name} will get 2 more Actions during their next turn.`);
        winner.extraActionsNextTurn = (winner.extraActionsNextTurn || 0) + 2;
        break;
      }
      case 'Three-Month-Long Match': {
        this.log(`Three-Month-Long Match Prize: ${winner.name} does 15 damage to ${loser.name}.`);
        this.dealDamage(loserId, 15, 'spell');
        break;
      }
      case 'Hufflepuff Match': {
        const choices = [
          { id: 'yes', label: 'Draw 5 cards' },
          { id: 'no', label: 'Do not draw' }
        ];
        this.promptChoice(winnerId, "Hufflepuff Match Prize: Do you want to draw 5 cards?", choices, 1, 1, (selected) => {
          if (selected[0] === 'yes') {
            this.log(`${winner.name} chose to draw 5 cards.`);
            for (let i = 0; i < 5; i++) {
              this.drawCard(winnerId, false);
            }
          } else {
            this.log(`${winner.name} chose not to draw cards.`);
          }
          this.log(`Hufflepuff Match Prize: ${loser.name} takes 5 damage.`);
          this.dealDamage(loserId, 5, 'spell');
          this.notifyStateChange();
        }, matchCard);
        break;
      }
      case 'Slytherin Match': {
        if (winnerId === 'player' || this.isMultiplayer) {
          const nonHealing = winner.discardPile.filter(c => !c.healing && !c.subTypes?.includes('Healing'));
          if (nonHealing.length === 0) {
            this.log(`No eligible non-Healing cards in discard pile for Slytherin Match prize.`);
            break;
          }
          const choices = nonHealing.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(winnerId, "Slytherin Match: Select up to 15 non-Healing cards to shuffle into your deck", choices, 0, 15, (selected) => {
            selected.forEach(instId => {
              const idx = winner.discardPile.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = winner.discardPile.splice(idx, 1);
                winner.deck.push(c);
              }
            });
            this.shuffle(winner.deck);
            this.log(`Slytherin Match: Shuffled ${selected.length} card(s) into deck.`);
            this.notifyStateChange();
          }, matchCard);
        } else {
          const nonHealing = winner.discardPile.filter(c => !c.healing && !c.subTypes?.includes('Healing'));
          const toShuffle = nonHealing.slice(0, 15);
          toShuffle.forEach(c => {
            const idx = winner.discardPile.indexOf(c);
            if (idx !== -1) winner.discardPile.splice(idx, 1);
            winner.deck.push(c);
          });
          this.shuffle(winner.deck);
          this.log(`${winner.name} shuffled ${toShuffle.length} card(s) into deck.`);
          this.notifyStateChange();
        }
        break;
      }
      case 'Ravenclaw Match': {
        if (winnerId === 'player' || this.isMultiplayer) {
          const lessons = winner.deck.filter(c => c.type === 'Lesson');
          if (lessons.length === 0) {
            this.log(`No Lessons in deck for Ravenclaw Match prize.`);
            break;
          }
          const choices = lessons.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(winnerId, "Ravenclaw Match: Select up to 2 Lesson cards to put into play", choices, 0, 2, (selected) => {
            selected.forEach(instId => {
              const idx = winner.deck.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = winner.deck.splice(idx, 1);
                winner.lessons.push(c);
              }
            });
            this.shuffle(winner.deck);
            this.log(`Ravenclaw Match: Put ${selected.length} Lesson(s) into play and shuffled deck.`);
            this.notifyStateChange();
          }, matchCard);
        } else {
          const lessons = winner.deck.filter(c => c.type === 'Lesson');
          const toPlay = lessons.slice(0, 2);
          toPlay.forEach(c => {
            const idx = winner.deck.indexOf(c);
            if (idx !== -1) winner.deck.splice(idx, 1);
            winner.lessons.push(c);
          });
          this.shuffle(winner.deck);
          this.log(`${winner.name} put ${toPlay.length} Lesson(s) into play and shuffled deck.`);
          this.notifyStateChange();
        }
        break;
      }
      case 'Muddy Practice': {
        this.log(`Muddy Practice Prize: ${winner.name} does 10 damage to ${loser.name}.`);
        this.dealDamage(loserId, 10, 'spell');
        break;
      }
    }
  }

  // End active player's turn
  endTurn() {
    const activePlayer = this.players[this.activePlayerId];
    const inactivePlayer = this.players[this.activePlayerId === 'player' ? 'opponent' : 'player'];

    // Porcupine Robe: End of opponent's turn trigger
    const hasPorcupineRobe = inactivePlayer.items.some(i => i.name === 'Porcupine Robe');
    if (hasPorcupineRobe && inactivePlayer.creaturesThatDealtDamageToMeThisTurn?.length > 0) {
      inactivePlayer.creaturesThatDealtDamageToMeThisTurn.forEach(creature => {
        const inPlay = activePlayer.creatures.find(c => c.instanceId === creature.instanceId);
        if (inPlay) {
          this.log(`Porcupine Robe: Dealing 1 retaliation damage to ${inPlay.name}.`);
          this.damageCreature(activePlayer.id, inPlay.instanceId, 1);
        }
      });
    }
    // Clear tracking lists
    activePlayer.creaturesThatDealtDamageToMeThisTurn = [];
    inactivePlayer.creaturesThatDealtDamageToMeThisTurn = [];

    // Devil's Snare and Cobra Lily end-of-turn damage removal
    activePlayer.creatures.forEach(c => {
      if (c.name === "Devil's Snare" || c.name === "Cobra Lily") {
        c.damage = 0;
        this.log(`${c.name}: Healed all damage at end of turn.`);
      }
    });
    
    // Active player's restriction flags expire
    activePlayer.cantPlayCardsNextTurn = false;
    activePlayer.discardDrawsNextTurn = false;
    activePlayer.cantPlaySpellsNextTurn = false;
    activePlayer.cantPlayLessonsNextTurn = false;
    activePlayer.cantPlayItemsNextTurn = false;
    activePlayer.cantPlayAdventuresNextTurn = false;
    activePlayer.biasedCommentaryActive = false;
    activePlayer.playedMoneyCardThisTurn = false;
    activePlayer.usedQuidditchCupThisTurn = false;
    
    // Inactive player's protection flags expire
    inactivePlayer.preventAllDamageNextTurn = false;
    inactivePlayer.preventAllDamageSource = null;
    inactivePlayer.preventCreatureAdventureDamageNextTurn = false;
    inactivePlayer.preventCreatureDamageNextTurn = false;
    inactivePlayer.preventCreatureDamageSource = null;
    inactivePlayer.preventAllCreatureDamageNextTurn = false;
    inactivePlayer.preventSpellDamageNextTurn = false;
    inactivePlayer.slothGripActive = false;

    this.log(`Ending turn for ${activePlayer.name}.`, 'turn');

    // Reset active player's turn-based flags
    activePlayer.lessonsPlayedThisTurn = 0;
    activePlayer.preventSpellDamageOnceThisTurn = false;
    activePlayer.playedCardsLastTurnCount = activePlayer.playedCardsThisTurnCount;
    activePlayer.playedCardsThisTurnCount = 0;
    activePlayer.items.forEach(i => { i.usedThisTurn = false; });
    activePlayer.bravadoActiveThisTurn = false;
    activePlayer.usedOncePerTurnAbilities = {};
    activePlayer.usedHarrySeekerThisTurn = false;
    activePlayer.usedCometTwoSixtyThisTurn = false;
    activePlayer.usedDracoMalfoySlytherinThisTurn = false;
    inactivePlayer.usedCometTwoSixtyThisTurn = false;
    inactivePlayer.wingedKeysTargetInstanceId = null;
    // Support Banner end of turn check
    const supportBannerCount = activePlayer.items.filter(i => i.name === 'Support Banner').length;
    if (supportBannerCount > 0 && activePlayer.playedQuidditchSpellThisTurn) {
      for (let i = 0; i < supportBannerCount; i++) {
        this.log(`Support Banner: Drawing a card for playing a Quidditch Spell this turn.`);
        this.drawCard(activePlayer.id, false);
      }
    }
    activePlayer.playedQuidditchSpellThisTurn = false;

    // Golden Snitch end of opponent's turn check
    const playerHasSnitch = inactivePlayer.id === 'player' && inactivePlayer.items.some(i => i.name === 'Golden Snitch');
    const opponentHasSnitch = inactivePlayer.id === 'opponent' && inactivePlayer.items.some(i => i.name === 'Golden Snitch');

    if (playerHasSnitch) {
      const pDeck = this.players.player.deck.length;
      const oDeck = this.players.opponent.deck.length;
      this.gameOver = true;
      if (oDeck >= pDeck + 10) {
        this.winnerId = 'opponent';
        this.winnerMessage = 'Golden Snitch: Opponent wins because their deck has 10+ more cards!';
      } else {
        this.winnerId = 'player';
        this.winnerMessage = 'Golden Snitch: You win the game!';
      }
      this.log(this.winnerMessage, 'victory');
      this.notifyStateChange();
      return;
    }
    if (opponentHasSnitch) {
      const pDeck = this.players.player.deck.length;
      const oDeck = this.players.opponent.deck.length;
      this.gameOver = true;
      if (pDeck >= oDeck + 10) {
        this.winnerId = 'player';
        this.winnerMessage = 'Golden Snitch: You win because your deck has 10+ more cards!';
      } else {
        this.winnerId = 'opponent';
        this.winnerMessage = 'Golden Snitch: Opponent wins the game!';
      }
      this.log(this.winnerMessage, 'victory');
      this.notifyStateChange();
      return;
    }

    // Forbidden Corridor end of turn check
    const isCorridorActive = this.players.player.locations.some(l => l.name === 'Forbidden Corridor') ||
                             this.players.opponent.locations.some(l => l.name === 'Forbidden Corridor');
    if (isCorridorActive && activePlayer.lessons.length === 0) {
      this.log(`Forbidden Corridor: Discarded because ${activePlayer.name} has no Lessons in play at end of turn.`);
      const pCorridorIdx = this.players.player.locations.findIndex(l => l.name === 'Forbidden Corridor');
      if (pCorridorIdx !== -1) {
        const [l] = this.players.player.locations.splice(pCorridorIdx, 1);
        this.discardCardFromPlay('player', l);
      }
      const oCorridorIdx = this.players.opponent.locations.findIndex(l => l.name === 'Forbidden Corridor');
      if (oCorridorIdx !== -1) {
        const [l] = this.players.opponent.locations.splice(oCorridorIdx, 1);
        this.discardCardFromPlay('opponent', l);
      }
    }

    // Harry Triumphant check
    const hasHarryTriumphant = activePlayer.characters.some(c => c.name === 'Harry Triumphant');
    if (hasHarryTriumphant && activePlayer.playedAdventureThisTurn) {
      const maxDraw = Math.min(4, activePlayer.deck.length);
      if (maxDraw > 0) {
        if (activePlayer.id === 'player' || this.isMultiplayer) {
          const choices = Array.from({ length: maxDraw + 1 }, (_, i) => ({ id: `draw-${i}`, label: `Draw ${i} card(s)` }));
          this.promptChoice(activePlayer.id, `Harry Triumphant: Choose how many cards to draw (0-${maxDraw})`, choices, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const count = parseInt(sel.split('-')[1], 10);
              if (count > 0) {
                this.drawCards(activePlayer.id, count, false);
                this.log(`Harry Triumphant: ${activePlayer.name} drew ${count} card(s).`);
              }
            }
            this.checkRonTheBrave();
          });
          return;
        } else {
          // AI always draws maximum cards
          const count = Math.min(4, maxDraw);
          if (count > 0) {
            this.drawCards(activePlayer.id, count, false);
            this.log(`Harry Triumphant: AI drew ${count} card(s).`);
          }
          this.checkRonTheBrave();
          return;
        }
      }
    }

    this.checkRonTheBrave();
  }

  checkRonTheBrave() {
    const activePlayer = this.players[this.activePlayerId];
    const hasRonBrave = activePlayer.characters.some(c => c.name === 'Ron the Brave');
    if (hasRonBrave && activePlayer.playedAdventureThisTurn) {
      const charCards = activePlayer.deck.filter(c => c.type === 'Character');
      if (charCards.length > 0) {
        if (activePlayer.id === 'player' || this.isMultiplayer) {
          const choices = charCards.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          choices.push({ id: 'none', label: 'Do not search' });
          this.promptChoice(activePlayer.id, "Ron the Brave: You may search your deck for a Character card", choices, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel && sel !== 'none') {
              const idx = activePlayer.deck.findIndex(c => c.instanceId === sel);
              if (idx !== -1) {
                const [c] = activePlayer.deck.splice(idx, 1);
                activePlayer.hand.push(c);
                this.log(`Ron the Brave: Added Character ${c.name} to hand from deck.`);
              }
            }
            this.shuffle(activePlayer.deck);
            this.proceedToEndTurn();
          });
          return;
        } else {
          const [c] = activePlayer.deck.splice(activePlayer.deck.indexOf(charCards[0]), 1);
          activePlayer.hand.push(c);
          this.log(`Ron the Brave: AI added Character ${c.name} to hand.`);
          this.shuffle(activePlayer.deck);
          this.proceedToEndTurn();
          return;
        }
      }
    }

    this.proceedToEndTurn();
  }

  proceedToEndTurn() {
    const activePlayer = this.players[this.activePlayerId];
    const inactivePlayer = this.players[this.activePlayerId === 'player' ? 'opponent' : 'player'];

    activePlayer.playedAdventureThisTurn = false;

    // Toggle active player
    this.activePlayerId = this.activePlayerId === 'player' ? 'opponent' : 'player';
    
    const nextPlayer = this.players[this.activePlayerId];
    const prevPlayer = activePlayer; // activePlayer is the player who just ended their turn

    // The Famous Harry Potter start of turn passive trigger
    if (nextPlayer.characters.some(c => c.name === 'The Famous Harry Potter') && nextPlayer.hand.length <= 4) {
      if (this.activePlayerId === 'player' || this.isMultiplayer) {
        const choices = [
          { id: 'yes', label: 'Draw 1 card' },
          { id: 'no', label: 'Do not draw' }
        ];
        this.promptChoice(this.activePlayerId, "The Famous Harry Potter: Draw 1 card before your turn?", choices, 1, 1, (selected) => {
          if (selected[0] === 'yes') {
            this.drawCard(this.activePlayerId, false);
            this.log(`The Famous Harry Potter: ${nextPlayer.name} drew 1 card.`);
          }
          this.initializeNewTurn(nextPlayer, prevPlayer);
        });
        return;
      } else {
        if (nextPlayer.deck.length >= 5) {
          this.drawCard(this.activePlayerId, false);
          this.log(`The Famous Harry Potter: AI drew 1 card.`);
        }
        this.initializeNewTurn(nextPlayer, prevPlayer);
        return;
      }
    }

    this.initializeNewTurn(nextPlayer, prevPlayer);
  }

  initializeNewTurn(nextPlayer, prevPlayer) {
    const unicornCount = nextPlayer.creatures.filter(c => c.name === 'Unicorn').length;
    const isGringottsActive = this.players.player.locations.some(l => l.name === 'Gringotts') ||
                              this.players.opponent.locations.some(l => l.name === 'Gringotts');
    let actionCount = 2 + unicornCount + (isGringottsActive ? 1 : 0);
    if (isGringottsActive) {
      this.log(`${nextPlayer.name} gets +1 Action from Gringotts.`);
    }
    if (nextPlayer.extraActionsNextTurn) {
      actionCount += nextPlayer.extraActionsNextTurn;
      this.log(`${nextPlayer.name} gets ${nextPlayer.extraActionsNextTurn} extra Action(s) from Gryffindor Match prize.`);
      nextPlayer.extraActionsNextTurn = 0;
    }
    const hasHagridNeedsHelp = nextPlayer.adventures.some(a => a.name === 'Hagrid Needs Help');
    if (hasHagridNeedsHelp) {
      actionCount = Math.max(1, actionCount - 1);
      this.log(`${nextPlayer.name} has 1 fewer Action due to Hagrid Needs Help.`);
    }
    const hasFivePoints = nextPlayer.adventures.some(a => a.name === '5 Points from Gryffindor');
    if (hasFivePoints) {
      actionCount = Math.max(1, actionCount - 1);
      this.log(`${nextPlayer.name} gets 1 fewer Action due to 5 Points from Gryffindor.`);
    }
    if (nextPlayer.fewerActionsNextTurn) {
      actionCount = Math.max(1, actionCount - nextPlayer.fewerActionsNextTurn);
      this.log(`${nextPlayer.name} has ${nextPlayer.fewerActionsNextTurn} fewer Action(s) this turn.`);
      nextPlayer.fewerActionsNextTurn = 0;
    }
    this.actionsRemaining = actionCount;
    nextPlayer.mustDrawFirstAction = nextPlayer.adventures.some(a => a.name === 'Pep Talk');
    if (this.isDebugMode && this.debugUnlimitedActions) {
      this.actionsRemaining = 99;
    }
    this.turnNumber++;

    this.log(`--- Turn ${this.turnNumber}: Start of ${nextPlayer.name}'s Turn ---`, 'turn');

    // Reset Hospital Dormitory prevention counts for this turn
    this.players.player.hospitalDormitoryPreventedThisTurn = 0;
    this.players.opponent.hospitalDormitoryPreventedThisTurn = 0;

    // 1. Great Hall start of turn draw
    const isGreatHallActive = this.players.player.locations.some(l => l.name === 'Great Hall') ||
                              this.players.opponent.locations.some(l => l.name === 'Great Hall');
    if (isGreatHallActive) {
      this.log(`Great Hall: Drawing a card before turn.`);
      this.drawCard(nextPlayer.id, false);
    }

    // 2. Photo Album start of turn draw
    const photoAlbumCount = nextPlayer.items.filter(i => i.name === 'Photo Album').length;
    for (let i = 0; i < photoAlbumCount; i++) {
      this.log(`Photo Album: Drawing a card before turn.`);
      this.drawCard(nextPlayer.id, false);
    }

    // 3. Dumbledore's Watch wipe
    const nextHasWatch = nextPlayer.items.some(i => i.name === "Dumbledore's Watch");
    if (nextHasWatch) {
      this.log(`Dumbledore's Watch: Discarding all cards from play (except starting Characters).`);
      const wipePlay = (p) => {
        p.lessons.slice(0).forEach(c => this.discardCardFromPlay(p.id, c, 'lessons'));
        p.creatures.slice(0).forEach(c => this.discardCardFromPlay(p.id, c, 'creatures'));
        p.items.slice(0).forEach(c => this.discardCardFromPlay(p.id, c, 'items'));
        p.locations.slice(0).forEach(c => this.discardCardFromPlay(p.id, c, 'locations'));
        p.adventures.slice(0).forEach(c => this.discardCardFromPlay(p.id, c, 'adventures'));
        p.matches.slice(0).forEach(c => this.discardCardFromPlay(p.id, c, 'matches'));
        const extraChars = p.characters.filter(c => c.instanceId !== 'player-starting-char' && c.instanceId !== 'opponent-starting-char');
        extraChars.forEach(c => {
          this.discardCardFromPlay(p.id, c, 'characters');
        });
      };
      wipePlay(this.players.player);
      wipePlay(this.players.opponent);
    }

    // 4. Discard Money items for Actions
    const galleons = nextPlayer.items.filter(i => i.name === 'Galleon');
    galleons.forEach(item => {
      this.discardCardFromPlay(nextPlayer.id, item, 'items');
      this.actionsRemaining += 3;
      this.log(`Galleon: Discarded for +3 Actions.`);
    });
    const sickles = nextPlayer.items.filter(i => i.name === 'Sickle');
    sickles.forEach(item => {
      this.discardCardFromPlay(nextPlayer.id, item, 'items');
      this.actionsRemaining += 2;
      this.log(`Sickle: Discarded for +2 Actions.`);
    });
    const knuts = nextPlayer.items.filter(i => i.name === 'Knut');
    knuts.forEach(item => {
      this.discardCardFromPlay(nextPlayer.id, item, 'items');
      this.actionsRemaining += 1;
      this.log(`Knut: Discarded for +1 Action.`);
    });

    // Reset Neville damage cap at the start of every turn (includes before-turn damage)
    this.players.player.damageTakenThisTurn = 0;
    this.players.opponent.damageTakenThisTurn = 0;

    // Resolve start-of-turn Item effects for nextPlayer
    const nextHasBludger = nextPlayer.items.some(i => i.name === 'Bludger');
    const activeMatch = this.players.player.matches.length > 0 || this.players.opponent.matches.length > 0;
    if (nextHasBludger && activeMatch) {
      this.log(`Bludger: Dealing 3 damage to ${prevPlayer.name} (active Match is in play).`);
      this.dealDamage(prevPlayer.id, 3, 'spell');
    }

    // Resolve active player's (nextPlayer's) creatures' start-of-turn damage
    if (nextPlayer.creatures.length > 0) {
      nextPlayer.creatures.forEach(creature => {
        let dmg = this.getCreatureDamage(nextPlayer.id, creature);
        // Check Winged Keys prevention (Winged Keys is in play on prevPlayer)
        if (prevPlayer.wingedKeysTargetInstanceId === creature.instanceId) {
          this.log(`Winged Keys: Prevented all damage from ${creature.name}.`);
          dmg = 0;
        }
        if (dmg > 0) {
          this.log(`${creature.name} deals ${dmg} damage to ${prevPlayer.name} at start of turn.`, 'damage');
          this.dealDamage(prevPlayer.id, dmg, 'creature', creature);
        }
      });
    }

    // 2.5 Resolve start-of-turn Adventure effects for nextPlayer
    const oppHasDragonsEscape = prevPlayer.adventures.some(a => a.name === "Dragon's Escape");
    if (oppHasDragonsEscape) {
      this.log(`Dragon's Escape: Dealing 1 before-turn damage to ${prevPlayer.name}.`);
      this.dealDamage(prevPlayer.id, 1, 'adventure');
    }

    const oppHasTroll = prevPlayer.adventures.some(a => a.name === "Troll in the Bathroom");
    if (oppHasTroll) {
      this.log(`Troll in the Bathroom: Dealing 2 before-turn damage to ${prevPlayer.name}.`);
      this.dealDamage(prevPlayer.id, 2, 'adventure');
    }

    const oppHasUnusualPets = prevPlayer.adventures.some(a => a.name === "Unusual Pets");
    if (oppHasUnusualPets) {
      this.log(`Unusual Pets: Dealing 4 before-turn damage to ${prevPlayer.name}.`);
      this.dealDamage(prevPlayer.id, 4, 'adventure');
    }

    const oppHasNeville = prevPlayer.adventures.some(a => a.name === "Sticking Up for Neville");
    if (oppHasNeville) {
      this.log(`Sticking Up for Neville: Dealing 4 before-turn damage to ${prevPlayer.name}.`);
      this.dealDamage(prevPlayer.id, 4, 'adventure');
    }

    const nextHasGringotts = nextPlayer.adventures.some(a => a.name === "Gringotts' Cart Ride");
    if (nextHasGringotts && nextPlayer.hand.length > 0) {
      const choices = nextPlayer.hand.map(c => ({ id: `hand-${nextPlayer.id}-${c.instanceId}`, label: c.name, card: c }));
      this.promptChoice(nextPlayer.id, "Gringotts' Cart Ride: Choose 1 card from hand to discard before your turn starts", choices, 1, 1, (discarded) => {
        const sel = discarded[0];
        if (sel) {
          const instId = sel.split('-').slice(2).join('-');
          const idx = nextPlayer.hand.findIndex(c => c.instanceId === instId);
          if (idx !== -1) {
            const [c] = nextPlayer.hand.splice(idx, 1);
            nextPlayer.discardPile.push(c);
            this.log(`Gringotts' Cart Ride: ${nextPlayer.name} discarded ${c.name}.`);
          }
        }
      });
    }

    // Forbidden Corridor start of turn discard
    const isForbiddenCorridorActive = this.players.player.locations.some(l => l.name === 'Forbidden Corridor') ||
                                      this.players.opponent.locations.some(l => l.name === 'Forbidden Corridor');
    if (isForbiddenCorridorActive) {
      const eligible = [];
      nextPlayer.lessons.forEach(l => eligible.push({ id: `lessons-${l.instanceId}`, label: `${l.name} (Lesson)`, card: l, source: 'lessons' }));
      nextPlayer.creatures.forEach(c => eligible.push({ id: `creatures-${c.instanceId}`, label: `${c.name} (Creature)`, card: c, source: 'creatures' }));
      nextPlayer.items.forEach(i => eligible.push({ id: `items-${i.instanceId}`, label: `${i.name} (Item)`, card: i, source: 'items' }));
      nextPlayer.locations.forEach(l => eligible.push({ id: `locations-${l.instanceId}`, label: `${l.name} (Location)`, card: l, source: 'locations' }));
      nextPlayer.adventures.forEach(a => eligible.push({ id: `adventures-${a.instanceId}`, label: `${a.name} (Adventure)`, card: a, source: 'adventures' }));
      nextPlayer.matches.forEach(m => eligible.push({ id: `matches-${m.instanceId}`, label: `${m.name} (Match)`, card: m, source: 'matches' }));
      nextPlayer.characters.forEach(c => {
        if (c.instanceId !== 'player-starting-char' && c.instanceId !== 'opponent-starting-char') {
          eligible.push({ id: `characters-${c.instanceId}`, label: `${c.name} (Character)`, card: c, source: 'characters' });
        }
      });
      
      if (eligible.length > 0) {
        if (nextPlayer.id === 'player' || this.isMultiplayer) {
          this.promptChoice(nextPlayer.id, "Forbidden Corridor: Choose 1 of your cards in play to discard before your turn starts", eligible, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const parts = sel.split('-');
              const type = parts[0];
              const instId = parts.slice(1).join('-');
              const idx = nextPlayer[type].findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = nextPlayer[type].splice(idx, 1);
                this.discardCardFromPlay(nextPlayer.id, c);
              }
            }
          });
        } else {
          const target = eligible[0];
          const idx = nextPlayer[target.source].findIndex(c => c.instanceId === target.card.instanceId);
          if (idx !== -1) {
            const [c] = nextPlayer[target.source].splice(idx, 1);
            this.discardCardFromPlay(nextPlayer.id, c);
          }
        }
      }
    }

    // Hut on the Rock start of turn discard
    const hasHutOnRock = nextPlayer.adventures.some(a => a.name === 'Hut on the Rock');
    if (hasHutOnRock) {
      const eligible = [];
      nextPlayer.lessons.forEach(l => eligible.push({ id: `lessons-${l.instanceId}`, label: `${l.name} (Lesson)`, card: l, source: 'lessons' }));
      nextPlayer.creatures.forEach(c => eligible.push({ id: `creatures-${c.instanceId}`, label: `${c.name} (Creature)`, card: c, source: 'creatures' }));
      nextPlayer.items.forEach(i => eligible.push({ id: `items-${i.instanceId}`, label: `${i.name} (Item)`, card: i, source: 'items' }));
      nextPlayer.locations.forEach(l => eligible.push({ id: `locations-${l.instanceId}`, label: `${l.name} (Location)`, card: l, source: 'locations' }));
      nextPlayer.adventures.forEach(a => eligible.push({ id: `adventures-${a.instanceId}`, label: `${a.name} (Adventure)`, card: a, source: 'adventures' }));
      nextPlayer.matches.forEach(m => eligible.push({ id: `matches-${m.instanceId}`, label: `${m.name} (Match)`, card: m, source: 'matches' }));
      nextPlayer.characters.forEach(c => {
        if (c.instanceId !== 'player-starting-char' && c.instanceId !== 'opponent-starting-char') {
          eligible.push({ id: `characters-${c.instanceId}`, label: `${c.name} (Character)`, card: c, source: 'characters' });
        }
      });
      
      if (eligible.length > 0) {
        if (nextPlayer.id === 'player' || this.isMultiplayer) {
          this.promptChoice(nextPlayer.id, "Hut on the Rock: Choose 1 of your cards in play to discard before your turn starts", eligible, 1, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const parts = sel.split('-');
              const type = parts[0];
              const instId = parts.slice(1).join('-');
              const idx = nextPlayer[type].findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = nextPlayer[type].splice(idx, 1);
                this.discardCardFromPlay(nextPlayer.id, c);
              }
            }
          });
        } else {
          const target = eligible[0];
          const idx = nextPlayer[target.source].findIndex(c => c.instanceId === target.card.instanceId);
          if (idx !== -1) {
            const [c] = nextPlayer[target.source].splice(idx, 1);
            this.discardCardFromPlay(nextPlayer.id, c);
          }
        }
      }
    }

    // Candy Cart start of turn draw and discard
    const hasCandyCart = nextPlayer.adventures.some(a => a.name === 'Candy Cart');
    if (hasCandyCart) {
      this.log(`Candy Cart: Drawing 3 cards before turn.`);
      this.drawCards(nextPlayer.id, 3, false);
      
      if (nextPlayer.hand.length > 0) {
        const discCount = Math.min(3, nextPlayer.hand.length);
        if (nextPlayer.id === 'player' || this.isMultiplayer) {
          const handChoices = nextPlayer.hand.map(c => ({ id: c.instanceId, label: c.name, card: c }));
          this.promptChoice(nextPlayer.id, `Candy Cart: Choose ${discCount} cards to discard`, handChoices, discCount, discCount, (selected) => {
            selected.forEach(instId => {
              const idx = nextPlayer.hand.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = nextPlayer.hand.splice(idx, 1);
                nextPlayer.discardPile.push(c);
              }
            });
            this.log(`Candy Cart: Discarded ${selected.length} card(s) from hand.`);
            this.notifyStateChange();
          });
        } else {
          for (let i = 0; i < discCount; i++) {
            const idx = Math.floor(Math.random() * nextPlayer.hand.length);
            const [c] = nextPlayer.hand.splice(idx, 1);
            nextPlayer.discardPile.push(c);
          }
          this.log(`Candy Cart: AI discarded ${discCount} card(s) from hand.`);
          this.notifyStateChange();
        }
      }
    }

    // Meeting Fluffy damage
    const oppHasMeetingFluffy = prevPlayer.adventures.some(a => a.name === 'Meeting Fluffy');
    if (oppHasMeetingFluffy) {
      this.log(`Meeting Fluffy: Dealing 12 before-turn damage to ${prevPlayer.name}.`);
      this.dealDamage(prevPlayer.id, 12, 'adventure');
    }
    
    // 3. Draw phase for the new active player
    const owlCount = nextPlayer.creatures.filter(c => c.name === 'Delivery Owl').length;
    for (let i = 0; i < owlCount; i++) {
      this.log(`Delivery Owl: Drawing an extra card before ${nextPlayer.name}'s turn.`);
      this.drawCard(this.activePlayerId, false);
    }
    
    const hasRaceSnitch = nextPlayer.adventures.some(a => a.name === 'Race for the Snitch');
    const hasTrapdoor = nextPlayer.adventures.some(a => a.name === 'Through the Trapdoor');
    if (hasRaceSnitch) {
      if (nextPlayer.deck.length > 0) {
        const [c] = nextPlayer.deck.splice(nextPlayer.deck.length - 1, 1);
        nextPlayer.discardPile.push(c);
        this.log(`Race for the Snitch: ${nextPlayer.name} discarded the card they drew at start of turn (${c.name}).`);
      }
    } else if (hasTrapdoor) {
      if (nextPlayer.deck.length > 0) {
        const [cardDrawn] = nextPlayer.deck.splice(nextPlayer.deck.length - 1, 1);
        nextPlayer.discardPile.push(cardDrawn);
        this.log(`Through the Trapdoor: Drew and discarded ${cardDrawn.name} at start of turn.`);
        if (cardDrawn.type === 'Lesson') {
          const advIdx = nextPlayer.adventures.findIndex(a => a.name === 'Through the Trapdoor');
          if (advIdx !== -1) {
            const [advCard] = nextPlayer.adventures.splice(advIdx, 1);
            prevPlayer.discardPile.push(advCard);
            this.log(`Through the Trapdoor is solved automatically!`);
            this.dealDamage(prevPlayer.id, 1, 'adventure');
          }
        }
      }
    } else {
      this.drawCard(this.activePlayerId, false);
    }

    this.notifyStateChange();
  }

  // Win condition checker
  checkWinConditions() {
    if (this.isDebugMode) return; // In Debug Mode, game doesn't end on empty deck

    const pDeckEmpty = this.players.player.deck.length === 0;
    const oDeckEmpty = this.players.opponent.deck.length === 0;

    if (pDeckEmpty && oDeckEmpty) {
      this.gameOver = true;
      this.winnerId = 'tie';
      this.winnerMessage = 'Both players ran out of cards! It is a Tie!';
      this.log(this.winnerMessage, 'turn');
    } else if (pDeckEmpty) {
      this.gameOver = true;
      this.winnerId = 'opponent';
      this.winnerMessage = 'You ran out of cards! Hogwarts Rival wins!';
      this.log(this.winnerMessage, 'turn');
    } else if (oDeckEmpty) {
      this.gameOver = true;
      this.winnerId = 'player';
      this.winnerMessage = 'Opponent ran out of cards! You win!';
      this.log(this.winnerMessage, 'turn');
    }
  }

  // Debug menu command to deal player's creature damage instantly to opponent
  debugDealCreatureDamage(playerId = 'player') {
    const player = this.players[playerId];
    const targetId = playerId === 'player' ? 'opponent' : 'player';
    let dealtAny = false;
    player.creatures.forEach(creature => {
      let dmg = this.getCreatureDamage(playerId, creature);
      if (dmg > 0) {
        this.log(`Debug Menu: ${creature.name} deals ${dmg} damage to ${this.players[targetId].name}.`, 'damage');
        this.dealDamage(targetId, dmg, 'creature', creature);
        dealtAny = true;
      }
    });
    if (dealtAny) {
      this.notifyStateChange();
    } else {
      this.log(`Debug Menu: No creatures in play to deal damage for ${player.name}.`, 'error');
    }
  }

  // Debug command to move a card from a source zone to a target zone
  debugMoveCard(playerId, instanceId, sourceZone, targetZone) {
    const player = this.players[playerId];
    if (!player) return;

    let card = null;

    // Helper to find and remove from array
    const findAndRemove = (arr) => {
      const idx = arr.findIndex(c => c.instanceId === instanceId);
      if (idx !== -1) {
        card = arr.splice(idx, 1)[0];
        return true;
      }
      return false;
    };

    // 1. Locate and remove from source
    if (sourceZone === 'hand') {
      findAndRemove(player.hand);
    } else if (sourceZone === 'deck') {
      findAndRemove(player.deck);
    } else if (sourceZone === 'discard') {
      findAndRemove(player.discardPile);
    } else if (sourceZone === 'field') {
      findAndRemove(player.lessons) ||
      findAndRemove(player.creatures) ||
      findAndRemove(player.characters) ||
      findAndRemove(player.items) ||
      findAndRemove(player.locations) ||
      findAndRemove(player.matches) ||
      findAndRemove(player.adventures);
    }

    if (!card) {
      this.log(`Debug Mode: Card ${instanceId} not found in source zone "${sourceZone}" for ${player.name}.`, 'error');
      return;
    }

    // 2. Add to target zone
    const isOpposite = targetZone.startsWith('opp_');
    const targetPlayer = isOpposite ? this.players[playerId === 'player' ? 'opponent' : 'player'] : player;
    const actualTargetZone = isOpposite ? targetZone.substring(4) : targetZone;

    if (actualTargetZone === 'hand') {
      targetPlayer.hand.push(card);
      this.log(`Debug Mode: Moved ${card.name} to ${targetPlayer.name}'s hand.`, 'action');
    } else if (actualTargetZone === 'deck') {
      targetPlayer.deck.push(card); // push to top (which is end of array)
      this.log(`Debug Mode: Moved ${card.name} to the top of ${targetPlayer.name}'s deck.`, 'action');
    } else if (actualTargetZone === 'discard') {
      targetPlayer.discardPile.push(card);
      this.log(`Debug Mode: Moved ${card.name} to ${targetPlayer.name}'s discard pile.`, 'action');
    } else if (actualTargetZone === 'field') {
      if (card.type === 'Lesson') {
        targetPlayer.lessons.push(card);
      } else if (card.type === 'Creature') {
        targetPlayer.creatures.push(card);
      } else if (card.type === 'Character') {
        targetPlayer.characters.push(card);
      } else if (card.type === 'Adventure') {
        targetPlayer.adventures.push(card);
      } else if (card.type === 'Location') {
        targetPlayer.locations.push(card);
      } else if (card.type === 'Match') {
        targetPlayer.matches.push(card);
      } else {
        targetPlayer.items.push(card);
      }
      this.log(`Debug Mode: Moved ${card.name} to ${targetPlayer.name}'s field.`, 'action');
    }

    this.notifyStateChange();
  }

  // Debug command to instantly solve an active adventure
  debugSolveAdventure(playerId, adventureInstanceId) {
    const player = this.players[playerId];
    const opponent = this.players[playerId === 'player' ? 'opponent' : 'player'];
    const advIndex = player.adventures.findIndex(a => a.instanceId === adventureInstanceId);
    if (advIndex === -1) return;
    const adventure = player.adventures[advIndex];

    player.adventures.splice(advIndex, 1);
    opponent.discardPile.push(adventure);
    this.log(`Debug Mode: Instantly solved active Adventure ${adventure.name} on ${player.name}'s side.`, 'action');
    this.applyAdventureReward(playerId, adventure);
    this.notifyStateChange();
  }

  // Debug command to instantly win a match
  debugWinMatch(winnerId, instanceId) {
    let matchCard = null;
    let ownerId = null;

    // Check player's matches
    matchCard = this.players.player.matches.find(m => m.instanceId === instanceId);
    if (matchCard) {
      ownerId = 'player';
    } else {
      matchCard = this.players.opponent.matches.find(m => m.instanceId === instanceId);
      if (matchCard) {
        ownerId = 'opponent';
      }
    }

    if (!matchCard) {
      // Look in other zones to move to field first
      const findCard = (arr) => arr.find(c => c.instanceId === instanceId);
      matchCard = findCard(this.players.player.hand) || findCard(this.players.player.deck) || findCard(this.players.player.discardPile);
      if (matchCard) {
        ownerId = 'player';
        const sourceZone = this.players.player.hand.includes(matchCard) ? 'hand' : (this.players.player.deck.includes(matchCard) ? 'deck' : 'discard');
        this.debugMoveCard('player', instanceId, sourceZone, 'field');
      } else {
        matchCard = findCard(this.players.opponent.hand) || findCard(this.players.opponent.deck) || findCard(this.players.opponent.discardPile);
        if (matchCard) {
          ownerId = 'opponent';
          const sourceZone = this.players.opponent.hand.includes(matchCard) ? 'hand' : (this.players.opponent.deck.includes(matchCard) ? 'deck' : 'discard');
          this.debugMoveCard('opponent', instanceId, sourceZone, 'field');
        }
      }
    }

    if (matchCard && ownerId) {
      this.log(`Debug Mode: Instantly winning Match ${matchCard.name} for ${this.players[winnerId].name}.`, 'action');
      this.winMatch(winnerId, matchCard, ownerId);
    }
  }

  enableUnlimitedActions() {
    this.debugUnlimitedActions = true;
    this.actionsRemaining = 99;
    this.log(`Debug Mode: 99 actions enabled for active player.`, 'action');
    this.notifyStateChange();
  }

  disableUnlimitedActions() {
    this.debugUnlimitedActions = false;
    const active = this.players[this.activePlayerId];
    const unicornCount = active.creatures.filter(c => c.name === 'Unicorn').length;
    this.actionsRemaining = 2 + unicornCount;
    this.log(`Debug Mode: Normal action counts enabled for active player.`, 'action');
    this.notifyStateChange();
  }

  debugShuffleDeck(playerId = 'player') {
    this.shuffle(this.players[playerId].deck);
    this.log(`Debug Mode: Shuffled ${this.players[playerId].name}'s deck.`, "action");
    this.notifyStateChange();
  }

  debugEnableLessons() {
    if (!this.isDebugMode) return;
    
    // Clear existing lessons for both players
    this.players.player.lessons = [];
    this.players.opponent.lessons = [];

    const lessonTypesToSpawn = ['Care of Magical Creatures', 'Potions', 'Transfiguration', 'Charms', 'Quidditch'];
    lessonTypesToSpawn.forEach(lType => {
      const proto = this.cardDatabase.find(c => c.type === 'Lesson' && c.lessonType === lType);
      if (proto) {
        for (let i = 0; i < 10; i++) {
          this.players.player.lessons.push({
            ...proto,
            instanceId: `debug-lesson-${lType.replace(/\s+/g, '-')}-${i}`
          });
          this.players.opponent.lessons.push({
            ...proto,
            instanceId: `debug-lesson-opponent-${lType.replace(/\s+/g, '-')}-${i}`
          });
        }
      }
    });

    this.log('Debug Mode: Enabled 10 of each Lesson for both players.', 'action');
    this.notifyStateChange();
  }

  debugDisableLessons() {
    if (!this.isDebugMode) return;
    
    this.players.player.lessons = [];
    this.players.opponent.lessons = [];

    this.log('Debug Mode: Cleared all Lessons in play for both players.', 'action');
    this.notifyStateChange();
  }

  debugReturnHandToDeck(playerId = 'player') {
    if (!this.isDebugMode) return;
    const player = this.players[playerId];
    if (!player) return;
    
    const count = player.hand.length;
    if (count > 0) {
      player.deck.push(...player.hand);
      player.hand = [];
      this.shuffle(player.deck);
      this.log(`Debug Mode: Returned all ${count} cards from ${player.name}'s hand to deck and shuffled.`, 'action');
      this.notifyStateChange();
    }
  }

  debugDiscardHand(playerId = 'player') {
    if (!this.isDebugMode) return;
    const player = this.players[playerId];
    if (!player) return;

    const count = player.hand.length;
    if (count > 0) {
      player.discardPile.push(...player.hand);
      player.hand = [];
      this.log(`Debug Mode: Discarded all ${count} cards from ${player.name}'s hand.`, 'action');
      this.notifyStateChange();
    }
  }
}
