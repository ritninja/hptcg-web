/**
 * Harry Potter TCG - Game Engine
 * Manages the state machine, turn phases, rules validation, and deck operations.
 */

export class PlayerState {
  constructor(id, name, startingCharacter) {
    this.id = id;
    this.name = name;
    this.startingCharacter = startingCharacter;
    
    this.deck = [];
    this.hand = [];
    this.discardPile = [];
    
    // Zones in play
    this.lessons = [];
    this.creatures = [];
    this.items = [];
    this.adventures = [];
    this.characters = startingCharacter ? [startingCharacter] : [];

    // Next-turn status flags for spell effects
    this.preventAllDamageNextTurn = false;
    this.preventCreatureAdventureDamageNextTurn = false;
    this.preventCreatureDamageNextTurn = false;
    this.discardDrawsNextTurn = false;
    this.cantPlayCardsNextTurn = false;

    // Character ability status tracking
    this.usedOncePerGameAbilities = {};

    // Item and Adventure state tracking
    this.playedCardsThisTurnCount = 0;
    this.playedCardsLastTurnCount = 0;
    this.lessonsPlayedThisTurn = 0;
    this.revealHandRestOfGame = false;
    this.preventSpellDamageOnceThisTurn = false;
    this.wingedKeysTargetInstanceId = null;
  }

  clearNextTurnFlags() {
    this.preventAllDamageNextTurn = false;
    this.preventCreatureAdventureDamageNextTurn = false;
    this.preventCreatureDamageNextTurn = false;
    this.discardDrawsNextTurn = false;
    this.cantPlayCardsNextTurn = false;
  }

  // Calculate available lesson points by type
  get lessonCounts() {
    const counts = {};
    let total = 0;
    
    this.lessons.forEach(card => {
      const type = card.provides?.type;
      const amount = card.provides?.amount || 1;
      if (type) {
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
    this.gameOver = false;
    this.winnerMessage = null;
    this.pendingSpell = null;
  }

  // Subscribe UI to state changes
  onStateChange(callback) {
    this.onStateChangeCallback = callback;
  }

  // Subscribe UI to spell play events
  onSpellPlayed(callback) {
    this.onSpellPlayedCallback = callback;
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

  // Setup game with chosen decks
  setupGame(playerDeckIds, opponentDeckIds, playerCharId, opponentCharId) {
    const pCharRaw = this.cardDatabase.find(c => c.id === playerCharId);
    const oCharRaw = this.cardDatabase.find(c => c.id === opponentCharId);
    const pChar = pCharRaw ? { ...pCharRaw, instanceId: 'player-starting-char' } : null;
    const oChar = oCharRaw ? { ...oCharRaw, instanceId: 'opponent-starting-char' } : null;

    this.players.player = new PlayerState('player', 'You', pChar);
    this.players.opponent = new PlayerState('opponent', 'Hogwarts Rival', oChar);

    this.gameOver = false;
    this.winnerMessage = null;
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

    // Starting Hand Size logic (Harry Potter increases hand size by 1)
    const pHandModifier = pChar?.effects?.handSizeModifier || 0;
    const oHandModifier = oChar?.effects?.handSizeModifier || 0;
    const pStartHand = this.rules.setup.startingHandSize + pHandModifier;
    const oStartHand = this.rules.setup.startingHandSize + oHandModifier;

    // Draw hands
    for (let i = 0; i < pStartHand; i++) this.drawCard('player', false);
    for (let i = 0; i < oStartHand; i++) this.drawCard('opponent', false);

    this.actionsRemaining = this.rules.setup.startingActions;
    this.log('Game initialized! Shuffling decks and drawing starting hands.', 'turn');
    this.notifyStateChange();
  }

  // Shuffle Utility
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // Draw card from deck to hand
  drawCard(playerId, costAction = false) {
    const player = this.players[playerId];
    
    if (costAction) {
      const hasDiagonAlley = player.adventures.some(a => a.name === 'Diagon Alley');
      if (hasDiagonAlley) {
        this.log(`Cannot draw cards as an Action: Diagon Alley is active!`, 'error');
        return false;
      }
      if (this.actionsRemaining < 1) {
        this.log('Not enough actions to draw a card.', 'error');
        return false;
      }
      this.actionsRemaining--;
    }

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
    if (hasPeeves && !player.tookPeevesDamageThisEvent) {
      player.tookPeevesDamageThisEvent = true;
      this.log(`Peeves Causes Trouble: Draw triggers 1 damage to ${player.name}.`);
      this.dealDamage(playerId, 1, 'adventure');
    }

    return true;
  }

  // Play a card from hand to board
  playCard(playerId, cardInstanceId) {
    if (this.activePlayerId !== playerId) {
      this.log('It is not your turn!', 'error');
      return false;
    }

    const player = this.players[playerId];
    if (player.cantPlayCardsNextTurn) {
      this.log(`Cannot play cards this turn (Forgetfulness Potion is active)!`, 'error');
      return false;
    }
    const cardIndex = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    
    if (cardIndex === -1) return false;
    const card = player.hand[cardIndex];

    // Action Cost Calculation
    let actionCost = 1;
    if (card.type === 'Character') {
      if (player.characters.some(c => c.name === card.name)) {
        this.log(`Cannot play ${card.name} - you already have this Character in play!`, 'error');
        return false;
      }
      const hasRon = player.characters.some(c => c.name === 'Ron Weasley');
      actionCost = hasRon ? 1 : 2;
    }
    if (card.type === 'Adventure') {
      actionCost = 2;
    }

    if (this.actionsRemaining < actionCost) {
      this.log(`Not enough actions! Requires ${actionCost} action(s) (you have ${this.actionsRemaining}).`, 'error');
      return false;
    }

    // Adventure restrictions active on the player (victim of the Adventure)
    const activeAdventures = player.adventures;
    
    // 4 Privet Drive: Can't play Spell cards
    const hasPrivetDrive = activeAdventures.some(a => a.name === '4 Privet Drive');
    if (hasPrivetDrive && card.type === 'Spell') {
      this.log(`Cannot play Spell cards while 4 Privet Drive is active!`, 'error');
      return false;
    }

    // Hiding From Snape: Can't play Item cards
    const hasHidingFromSnape = activeAdventures.some(a => a.name === 'Hiding From Snape');
    if (hasHidingFromSnape && card.type === 'Item') {
      this.log(`Cannot play Item cards while Hiding From Snape is active!`, 'error');
      return false;
    }

    // Human Chess Game: Can play cards only if opponent played 1 or more cards during their previous turn
    const hasHumanChessGame = activeAdventures.some(a => a.name === 'Human Chess Game');
    if (hasHumanChessGame) {
      const opponent = this.players[playerId === 'player' ? 'opponent' : 'player'];
      if (opponent.playedCardsLastTurnCount === 0) {
        this.log(`Cannot play cards: Human Chess Game is active and opponent played 0 cards in their last turn!`, 'error');
        return false;
      }
    }

    // Reptile House: Can't play more than 1 Lesson card per turn
    const hasReptileHouse = activeAdventures.some(a => a.name === 'Reptile House');
    if (hasReptileHouse && card.type === 'Lesson' && player.lessonsPlayedThisTurn >= 1) {
      this.log(`Cannot play Lesson card: Reptile House limits you to 1 Lesson card per turn!`, 'error');
      return false;
    }

    // Special Wand play requirements
    if (card.name === 'Phoenix Feather Wand') {
      const charmsCount = player.lessonCounts.counts['Charms'] || 0;
      if (charmsCount < 3) {
        this.log(`Cannot play Phoenix Feather Wand: Requires at least 3 Charms Power in play (you have ${charmsCount}).`, 'error');
        return false;
      }
    }
    if (card.name === 'Dragon Heart Wand') {
      const charmsCount = player.lessonCounts.counts['Charms'] || 0;
      if (charmsCount < 2) {
        this.log(`Cannot play Dragon Heart Wand: Requires at least 2 Charms Power in play (you have ${charmsCount}).`, 'error');
        return false;
      }
    }

    // Adventure Play check: Opponent can have at most one Adventure in play on their side
    if (card.type === 'Adventure') {
      const opponent = this.players[playerId === 'player' ? 'opponent' : 'player'];
      if (opponent.adventures.length > 0) {
        this.log(`Cannot play ${card.name} - ${opponent.name} already has an active Adventure!`, 'error');
        return false;
      }
    }

    // Check Play Requirements (Lessons and costs)
    if (card.lessonCost) {
      const { counts, total } = player.lessonCounts;
      let requiredTotal = card.lessonCost.total;
      const requiredType = card.lessonCost.type;

      // Harry Hunting cost modifier (+2)
      const hasHarryHunting = activeAdventures.some(a => a.name === 'Harry Hunting');
      if (hasHarryHunting && (card.type === 'Spell' || card.type === 'Creature')) {
        requiredTotal += 2;
      }

      if (total < requiredTotal) {
        this.log(`Cannot play ${card.name}. Requires ${requiredTotal} lessons total (you have ${total}).`, 'error');
        return false;
      }

      if (requiredType && (!counts[requiredType] || counts[requiredType] < 1)) {
        this.log(`Cannot play ${card.name}. Requires at least 1 ${requiredType} lesson.`, 'error');
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
        this.log(`Cannot play ${card.name}. Requires discarding ${dl.count} of your ${dl.type === 'Any' ? '' : dl.type + ' '}Lessons from play (you only have ${matchCount} available).`, 'error');
        return false;
      }
    }

    // Spend Action
    this.actionsRemaining -= actionCost;
    player.hand.splice(cardIndex, 1);

    // Resolve discard lesson cost if any
    if (card.playRequirements && card.playRequirements.discardLessons) {
      const dl = card.playRequirements.discardLessons;
      let discarded = 0;
      for (let i = player.lessons.length - 1; i >= 0; i--) {
        if (discarded >= dl.count) break;
        const l = player.lessons[i];
        const lType = l.provides?.type || l.lessonType;
        if (dl.type === 'Any' || lType === dl.type) {
          player.lessons.splice(i, 1);
          player.discardPile.push(l);
          discarded++;
        }
      }
      this.log(`${player.name} discarded ${dl.count} of their ${dl.type === 'Any' ? '' : dl.type + ' '}Lessons from play as a cost.`);
    }

    // Deploy card based on type
    switch (card.type) {
      case 'Lesson':
        player.lessons.push(card);
        player.lessonsPlayedThisTurn++;
        this.log(`${player.name} played a Lesson: ${card.name}.`);
        
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
        if (card.name === 'Unicorn') {
          this.actionsRemaining++;
          this.log(`Unicorn: Granting 1 extra Action to ${player.name} this turn.`);
        }
        break;
      case 'Item':
        if (card.subTypes && card.subTypes.includes('Wand')) {
          const oldWandIndex = player.items.findIndex(i => i.subTypes && i.subTypes.includes('Wand'));
          if (oldWandIndex !== -1) {
            const [oldWand] = player.items.splice(oldWandIndex, 1);
            player.discardPile.push(oldWand);
            this.log(`Discarded old Wand from play: ${oldWand.name}`);
          }
        }
        player.items.push(card);
        this.log(`${player.name} played Item: ${card.name}.`);
        break;
      case 'Adventure': {
        const opponent = this.players[playerId === 'player' ? 'opponent' : 'player'];
        opponent.adventures.push(card);
        this.log(`${player.name} played Adventure: ${card.name} on ${opponent.name}'s side.`);
        break;
      }
      case 'Spell':
        player.discardPile.push(card);
        this.log(`${player.name} cast Spell: ${card.name}!`);
        if (this.onSpellPlayedCallback) {
          this.onSpellPlayedCallback(card, playerId);
          setTimeout(() => {
            this.resolveSpell(playerId, card);
            this.notifyStateChange();
          }, 1000);
        } else {
          this.resolveSpell(playerId, card);
        }
        break;
    }

    player.playedCardsThisTurnCount++;
    this.notifyStateChange();
    return true;
  }

  // Resolve spell effects
  resolveSpell(casterId, card) {
    const player = this.players[casterId];
    const opponent = this.players[casterId === 'player' ? 'opponent' : 'player'];
    const opponentId = opponent.id;
    const playerId = player.id;
    
    this.log(`${player.name} resolved spell effect of ${card.name}.`);

    switch (card.name) {
      case 'Elixir of Life': {
        const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
        const toShuffle = nonHealing.slice(0, 16);
        toShuffle.forEach(c => {
          player.discardPile = player.discardPile.filter(dc => dc.instanceId !== c.instanceId);
          player.deck.push(c);
        });
        this.shuffle(player.deck);
        this.log(`${player.name} shuffled ${toShuffle.length} non-Healing card(s) from discard into deck.`);
        break;
      }
      
      case 'Obliviate': {
        const discardedCount = opponent.hand.length;
        opponent.discardPile.push(...opponent.hand);
        opponent.hand = [];
        this.log(`${opponent.name} discarded their hand (${discardedCount} card(s)).`);
        break;
      }
      
      case 'Draught of Living Death': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (12 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-player-${c.instanceId}`, label: `${c.name} (Your Creature - 12 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-opponent-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 12 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Draught of Living Death (12 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 12, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts[2];
            this.damageCreature(owner, instId, 12);
          }
        });
        break;
      }
      
      case 'History of Magic': {
        const advCards = opponent.hand.filter(c => c.type === 'Adventure');
        if (casterId === 'player') {
          const choices = opponent.hand.map(c => ({ id: c.instanceId, label: `${c.name} (${c.type})`, card: c, disabled: true }));
          choices.push({ id: 'done', label: `Acknowledge (${advCards.length} Adventure card(s) will be discarded)` });
          this.promptChoice(casterId, `${opponent.name}'s Hand:`, choices, 1, 1, () => {
            advCards.forEach(c => {
              opponent.hand = opponent.hand.filter(h => h.instanceId !== c.instanceId);
              opponent.discardPile.push(c);
              this.log(`${opponent.name}'s Adventure card was discarded: ${c.name}`);
            });
          });
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
        player.creatures.forEach(c => choices.push({ id: `creature-player-${c.instanceId}`, label: `${c.name} (Your Creature - ${charmsCount} Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-opponent-${c.instanceId}`, label: `${c.name} (Opponent's Creature - ${charmsCount} Damage)`, card: c }));
        
        if (choices.length === 0) {
          this.log(`No creatures in play to target with Incendio.`);
          break;
        }
        
        this.promptChoice(casterId, `Choose Creature to deal ${charmsCount} damage to`, choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts[2];
            this.damageCreature(owner, instId, charmsCount);
          }
        });
        break;
      }
      
      case 'Malevolent Mixture': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (10 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-player-${c.instanceId}`, label: `${c.name} (Your Creature - 10 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-opponent-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 10 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Malevolent Mixture (10 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 10, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts[2];
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
        const choices = opponent.creatures.map(c => ({ id: `creature-opponent-${c.instanceId}`, label: c.name, card: c }));
        this.promptChoice(casterId, "Choose 1 of opponent's Creatures to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel && sel.startsWith('creature-')) {
            const instId = sel.split('-')[2];
            const idx = opponent.creatures.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = opponent.creatures.splice(idx, 1);
              opponent.discardPile.push(c);
              this.log(`Discarded opponent's creature: ${c.name}`);
            }
          }
        });
        break;
      }
      
      case 'Shrinking Potion': {
        player.preventAllDamageNextTurn = true;
        this.log(`During opponent's next turn, all damage done to ${player.name} is prevented.`);
        break;
      }
      
      case 'Titillando': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (3 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-player-${c.instanceId}`, label: `${c.name} (Your Creature - 3 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-opponent-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 3 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Titillando (3 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 3, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts[2];
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
              const keepInstId = keepSel.split('-')[2];
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
            const instId = selId.split('-')[2];
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
              const instId = sel.split('-')[2];
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
        if (opponent.adventures.length > 0) {
          const adv = opponent.adventures.pop();
          opponent.discardPile.push(adv);
          this.log(`Apparate: Discarded opponent's Adventure: ${adv.name}.`);
        } else {
          this.log(`Opponent has no Adventure in play.`);
        }
        break;
      }
      
      case 'Bluebell Flames': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (4 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-player-${c.instanceId}`, label: `${c.name} (Your Creature - 4 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-opponent-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 4 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Bluebell Flames (4 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 4, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts[2];
            this.damageCreature(owner, instId, 4);
          }
        });
        break;
      }
      
      case 'Burning Bitterroot Balm': {
        const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
        const toShuffle = nonHealing.slice(0, 10);
        toShuffle.forEach(c => {
          player.discardPile = player.discardPile.filter(dc => dc.instanceId !== c.instanceId);
          player.deck.push(c);
        });
        this.shuffle(player.deck);
        this.log(`${player.name} shuffled ${toShuffle.length} non-Healing card(s) from discard into deck.`);
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
        player.creatures.forEach(c => choices.push({ id: `creature-player-${c.instanceId}`, label: `${c.name} (Your Creature - 8 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-opponent-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 8 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Dogbreath Potion (8 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 8, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts[2];
            this.damageCreature(owner, instId, 8);
          }
        });
        break;
      }
      
      case "Draco's Trick": {
        if (player.adventures.length > 0) {
          const adv = player.adventures.pop();
          player.discardPile.push(adv);
          this.log(`Discarded own Adventure: ${adv.name}. Resolving reward: Draw 3 cards.`);
          for (let i = 0; i < 3; i++) this.drawCard(casterId, false);
        } else {
          this.log(`You have no active Adventure in play.`);
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
        if (opponent.adventures.length > 0) {
          const adv = opponent.adventures.pop();
          opponent.discardPile.push(adv);
          this.log(`Discarded opponent's Adventure: ${adv.name}. Resolving reward: Draw 3 cards.`);
          for (let i = 0; i < 3; i++) this.drawCard(casterId, false);
        } else {
          this.log(`Opponent has no active Adventure in play.`);
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
            const instId = sel.split('-')[2];
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
            const instId = sel.split('-')[2];
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
        const toRetrieve = nonHealing.slice(0, 3);
        toRetrieve.forEach(c => {
          player.discardPile = player.discardPile.filter(dc => dc.instanceId !== c.instanceId);
          player.deck.unshift(c);
        });
        this.log(`${player.name} put ${toRetrieve.length} non-Healing cards on bottom of deck.`);
        this.drawCard(casterId, false);
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
                  const instId = selId.split('-')[2];
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
        const choices = opponent.creatures.map(c => ({ id: `creature-opponent-${c.instanceId}`, label: c.name, card: c }));
        if (choices.length === 0) {
          this.log(`Opponent has no Creatures in play to discard.`);
          break;
        }
        this.promptChoice(opponentId, "Choose 1 Creature in play to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const instId = sel.split('-')[2];
            const idx = opponent.creatures.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = opponent.creatures.splice(idx, 1);
              opponent.discardPile.push(c);
              this.log(`${opponent.name} discarded Creature: ${c.name}`);
            }
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
            const instId = dSel.split('-')[2];
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
              const instId = sel.split('-')[2];
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
            const instId = dSel.split('-')[2];
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
              const instId = sel.split('-')[2];
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
        const choices = lessons.map(c => ({ id: `discard-player-${c.instanceId}`, label: `${c.name} (${c.lessonType})`, card: c }));
        const maxTake = Math.min(2, choices.length);
        if (maxTake === 0) {
          this.log(`No Lessons in discard pile.`);
          break;
        }
        this.promptChoice(casterId, `Choose up to ${maxTake} Lesson cards to retrieve`, choices, 0, maxTake, (selected) => {
          selected.forEach(selId => {
            const instId = selId.split('-')[2];
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
            const instId = sel.split('-')[2];
            const idx = opponent.lessons.findIndex(l => l.instanceId === instId);
            if (idx !== -1) {
              const [l] = opponent.lessons.splice(idx, 1);
              opponent.discardPile.push(l);
              this.log(`Discarded opponent's Care of Magical Creatures Lesson: ${l.name}`);
            }
          }
        });
        break;
      }
      
      case 'Baubillious': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (1 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-player-${c.instanceId}`, label: `${c.name} (Your Creature - 1 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-opponent-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 1 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Baubillious (1 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 1, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts[2];
            this.damageCreature(owner, instId, 1);
          }
          this.drawCard(casterId, false);
        });
        break;
      }
      
      case 'Boil Cure': {
        const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
        const toRetrieve = nonHealing.slice(0, 4);
        toRetrieve.forEach(c => {
          player.discardPile = player.discardPile.filter(dc => dc.instanceId !== c.instanceId);
          player.deck.unshift(c);
        });
        this.log(`${player.name} put ${toRetrieve.length} non-Healing cards on bottom of deck.`);
        break;
      }
      
      case 'Cauldron to Sieve': {
        const potLessons = opponent.lessons.filter(l => l.lessonType === 'Potions');
        const choices = potLessons.map(l => ({ id: `lesson-opponent-${l.instanceId}`, label: l.name, card: l }));
        if (choices.length === 0) {
          this.log(`Opponent has no Potions Lessons in play.`);
          break;
        }
        this.promptChoice(casterId, "Choose a Potions Lesson to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const instId = sel.split('-')[2];
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
        const choices = chLessons.map(l => ({ id: `lesson-opponent-${l.instanceId}`, label: l.name, card: l }));
        if (choices.length === 0) {
          this.log(`Opponent has no Charms Lessons in play.`);
          break;
        }
        this.promptChoice(casterId, "Choose a Charms Lesson to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const instId = sel.split('-')[2];
            const idx = opponent.lessons.findIndex(l => l.instanceId === instId);
            if (idx !== -1) {
              const [l] = opponent.lessons.splice(idx, 1);
              opponent.discardPile.push(l);
              this.log(`Discarded opponent's Charms Lesson: ${l.name}`);
            }
          }
        });
        break;
      }
      
      case 'Erumpent Potion': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (1 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-player-${c.instanceId}`, label: `${c.name} (Your Creature - 1 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-opponent-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 1 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Erumpent Potion (1 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 1, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts[2];
            this.damageCreature(owner, instId, 1);
          }
        });
        break;
      }
      
      case 'Fluffy Falls Asleep': {
        const choices = [];
        player.creatures.forEach(c => choices.push({ id: `creature-player-${c.instanceId}`, label: `${c.name} (Your Creature)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-opponent-${c.instanceId}`, label: `${c.name} (Opponent's Creature)`, card: c }));
        
        if (choices.length === 0) {
          this.log(`No creatures in play.`);
          break;
        }
        this.promptChoice(casterId, "Choose a Creature to return to hand", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts[2];
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
        player.creatures.forEach(c => choices.push({ id: `creature-player-${c.instanceId}`, label: `${c.name} (Your Creature - 2 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-opponent-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 2 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Foul Brew (2 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 2, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts[2];
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
            const instId = sel.split('-')[2];
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
            const instId = selId.split('-')[2];
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
        const toShuffle = nonHealing.slice(0, 8);
        toShuffle.forEach(c => {
          player.discardPile = player.discardPile.filter(dc => dc.instanceId !== c.instanceId);
          player.deck.push(c);
        });
        this.shuffle(player.deck);
        this.log(`${player.name} shuffled ${toShuffle.length} non-Healing card(s) from discard into deck.`);
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
            const instId = sel.split('-')[2];
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
        const choices = opponent.creatures.map(c => ({ id: `creature-opponent-${c.instanceId}`, label: c.name, card: c }));
        if (choices.length === 0) {
          this.log(`Opponent has no Creatures in play to discard.`);
          break;
        }
        this.promptChoice(casterId, "Choose opponent's Creature to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const instId = sel.split('-')[2];
            const idx = opponent.creatures.findIndex(c => c.instanceId === instId);
            if (idx !== -1) {
              const [c] = opponent.creatures.splice(idx, 1);
              opponent.discardPile.push(c);
              this.log(`Discarded opponent's Creature: ${c.name}`);
            }
          }
        });
        break;
      }
      
      case 'Lost Notes': {
        const inPlay = [...opponent.items, ...opponent.lessons];
        const choices = inPlay.map(c => ({ id: `${c.type.toLowerCase()}-opponent-${c.instanceId}`, label: `${c.name} (${c.type})`, card: c }));
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
        player.creatures.forEach(c => choices.push({ id: `creature-player-${c.instanceId}`, label: `${c.name} (Your Creature - 5 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-opponent-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 5 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Noxious Poison (5 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 5, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts[2];
            this.damageCreature(owner, instId, 5);
          }
        });
        break;
      }
      
      case 'Out of the Woods': {
        const creatures = opponent.hand.filter(c => c.type === 'Creature');
        if (casterId === 'player') {
          const choices = opponent.hand.map(c => ({ id: c.instanceId, label: `${c.name} (${c.type})`, card: c, disabled: true }));
          choices.push({ id: 'done', label: `Acknowledge (${creatures.length} Creature card(s) will be discarded)` });
          this.promptChoice(casterId, `${opponent.name}'s Hand:`, choices, 1, 1, () => {
            creatures.forEach(c => {
              opponent.hand = opponent.hand.filter(h => h.instanceId !== c.instanceId);
              opponent.discardPile.push(c);
              this.log(`${opponent.name}'s Creature was discarded from hand: ${c.name}`);
            });
          });
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
        const choices = inPlay.map(c => ({ id: `${c.type.toLowerCase()}-opponent-${c.instanceId}`, label: `${c.name} (${c.type})`, card: c }));
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
        const choices = transLessons.map(l => ({ id: `lesson-opponent-${l.instanceId}`, label: l.name, card: l }));
        if (choices.length === 0) {
          this.log(`Opponent has no Transfiguration Lessons in play.`);
          break;
        }
        this.promptChoice(casterId, "Choose a Transfiguration Lesson to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const instId = sel.split('-')[2];
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
        const choices = opponent.items.map(c => ({ id: `item-opponent-${c.instanceId}`, label: c.name, card: c }));
        if (choices.length === 0) {
          this.log(`Opponent has no Items in play.`);
          break;
        }
        this.promptChoice(casterId, "Choose opponent's Item to discard", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const instId = sel.split('-')[2];
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
        const totalDmg = player.creatures.reduce((sum, c) => {
          if (opponent.wingedKeysTargetInstanceId === c.instanceId) {
            this.log(`Winged Keys: Prevented damage from ${c.name} in Steelclaw.`);
            return sum;
          }
          return sum + (c.damagePerTurn || 0);
        }, 0);
        this.log(`Steelclaw: ${player.name}'s creatures attack together for ${totalDmg} damage!`);
        this.dealDamage(opponentId, totalDmg, 'creature');
        break;
      }
      
      case 'Toe Biter': {
        this.dealDamage(opponentId, 2, 'spell');
        const choices = [];
        player.creatures.forEach(c => choices.push({ id: `creature-player-${c.instanceId}`, label: `${c.name} (Your Creature - 2 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-opponent-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 2 Damage)`, card: c }));
        
        if (choices.length > 0) {
          this.promptChoice(casterId, "Choose a Creature to deal 2 damage to (Optional)", choices, 0, 1, (selected) => {
            const sel = selected[0];
            if (sel) {
              const parts = sel.split('-');
              const owner = parts[1];
              const instId = parts[2];
              this.damageCreature(owner, instId, 2);
            }
          });
        }
        break;
      }
      
      case 'Vermillious': {
        const choices = [{ id: 'opponent', label: `${opponent.name} (3 Damage)` }];
        player.creatures.forEach(c => choices.push({ id: `creature-player-${c.instanceId}`, label: `${c.name} (Your Creature - 3 Damage)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-opponent-${c.instanceId}`, label: `${c.name} (Opponent's Creature - 3 Damage)`, card: c }));
        
        this.promptChoice(casterId, "Choose target for Vermillious (3 damage)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'opponent') {
            this.dealDamage(opponentId, 3, 'spell');
          } else if (sel && sel.startsWith('creature-')) {
            const parts = sel.split('-');
            const owner = parts[1];
            const instId = parts[2];
            this.damageCreature(owner, instId, 3);
          }
        });
        break;
      }
      
      case 'Wingardium Leviosa!': {
        player.preventCreatureDamageNextTurn = true;
        this.log(`During opponent's next turn, all Creature damage to ${player.name} is prevented.`);
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
    }
  }

  // Deal damage to a creature
  damageCreature(ownerId, creatureInstanceId, amount) {
    const targetPlayer = this.players[ownerId];
    const index = targetPlayer.creatures.findIndex(c => c.instanceId === creatureInstanceId);
    if (index === -1) return;
    const creature = targetPlayer.creatures[index];
    creature.damage = (creature.damage || 0) + amount;
    this.log(`${creature.name} takes ${amount} damage! (${creature.damage}/${creature.health})`, 'damage');
    
    if (creature.damage >= creature.health) {
      this.log(`${creature.name} was defeated and discarded!`, 'damage');
      targetPlayer.creatures.splice(index, 1);
      targetPlayer.discardPile.push(creature);
    }
    this.notifyStateChange();
  }

  // Set pending spell for targeting choice
  promptChoice(casterId, title, choices, minChoices, maxChoices, callback, card = null) {
    if (casterId === 'player') {
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
    const { callback } = this.pendingSpell;
    this.pendingSpell = null;
    callback(selectedIds);
    this.notifyStateChange();
  }

  // Check if a character card's ability can be activated
  canActivateCharacterAbility(playerId, character) {
    if (this.gameOver) return false;
    if (this.activePlayerId !== playerId) return false;
    if (this.actionsRemaining < 0) return false;
    
    const player = this.players[playerId];
    
    // Once per game checks
    const oncePerGameAbilities = ['Dean Thomas', 'Hannah Abbott', 'Nearly Headless Nick', 'Professor Filius Flitwick', 'Professor Severus Snape'];
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

    const activeAbilities = ['Dean Thomas', 'Draco Malfoy', 'Hannah Abbott', 'Nearly Headless Nick', 'Professor Filius Flitwick', 'Professor Severus Snape'];
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
      case 'Dean Thomas': {
        player.usedOncePerGameAbilities[charCard.name] = true;
        this.log(`${player.name} activated Dean Thomas: Drew 3 cards.`);
        for (let i = 0; i < 3; i++) this.drawCard(playerId, false);
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
        player.usedOncePerGameAbilities[charCard.name] = true;
        const nonHealing = player.discardPile.filter(c => !c.subTypes?.includes('Healing'));
        const toShuffle = nonHealing.slice(0, 7);
        toShuffle.forEach(c => {
          player.discardPile = player.discardPile.filter(dc => dc.instanceId !== c.instanceId);
          player.deck.push(c);
        });
        this.shuffle(player.deck);
        this.log(`${player.name} activated Severus Snape's ability: Shuffled ${toShuffle.length} non-Healing cards from discard into deck.`);
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
    const opponent = this.players[playerId === 'player' ? 'opponent' : 'player'];

    switch (item.name) {
      case 'Cage':
        return this.actionsRemaining >= 1 && (player.creatures.length > 0 || opponent.creatures.length > 0);
      case 'Winged Keys':
        return !item.usedThisTurn && opponent.creatures.length > 0;
      case 'Remembrall':
        return this.actionsRemaining >= 1 && player.discardPile.some(c => c.type === 'Lesson');
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
      case 'Cage': {
        const choices = [];
        player.creatures.forEach(c => choices.push({ id: `creature-player-${c.instanceId}`, label: `${c.name} (Your Creature)`, card: c }));
        opponent.creatures.forEach(c => choices.push({ id: `creature-opponent-${c.instanceId}`, label: `${c.name} (Opponent's Creature)`, card: c }));

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
            this.notifyStateChange();
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
    }
  }

  // Check if an adventure card can be solved
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

    if (adventure.name === "Gringotts' Cart Ride" || adventure.name === "Diagon Alley" || adventure.name === "Peeves Causes Trouble") {
      const targetSkips = adventure.name === "Diagon Alley" ? 7 : 5;
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
              const idx = player.creatures.findIndex(c => c.instanceId === instId);
              if (idx !== -1) {
                const [c] = player.creatures.splice(idx, 1);
                player.discardPile.push(c);
              }
            });
            this.log(`${player.name} discarded 2 Creatures from play.`);

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
    }
  }

  // Apply reward from solved adventure card
  applyAdventureReward(playerId, adventure) {
    const player = this.players[playerId];
    const opponent = this.players[playerId === 'player' ? 'opponent' : 'player'];

    switch (adventure.name) {
      case "Dragon's Escape": {
        const choices = [
          { id: 'draw', label: 'Draw 3 cards' },
          { id: 'damage', label: `Deal 3 damage to ${opponent.name}` }
        ];
        this.promptChoice(playerId, "Dragon's Escape Reward: Choose your reward", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel === 'draw') {
            for (let i = 0; i < 3; i++) this.drawCard(playerId, false);
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
        for (let i = 0; i < 5; i++) this.drawCard(playerId, false);
        this.log(`Gringotts' Cart Ride Reward: ${player.name} drew 5 cards.`);
        this.notifyStateChange();
        break;
      }

      case "Human Chess Game": {
        for (let i = 0; i < 3; i++) this.drawCard(playerId, false);
        this.log(`Human Chess Game Reward: ${player.name} drew 3 cards.`);
        this.notifyStateChange();
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
        this.drawCard(playerId, false);
        this.log(`4 Privet Drive Reward: ${player.name} drew a card.`);
        this.notifyStateChange();
        break;
      }

      case "Diagon Alley": {
        const choices = Array.from({ length: 11 }, (_, i) => ({ id: `draw-${i}`, label: `Draw ${i} card(s)` }));
        this.promptChoice(playerId, "Diagon Alley Reward: Choose how many cards to draw (0-10)", choices, 1, 1, (selected) => {
          const sel = selected[0];
          if (sel) {
            const count = parseInt(sel.split('-')[1], 10);
            for (let i = 0; i < count; i++) this.drawCard(playerId, false);
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
        this.drawCard(playerId, false);
        this.log(`Reptile House Reward: ${player.name} drew a card.`);
        this.notifyStateChange();
        break;
      }

      case "Unusual Pets": {
        this.drawCard(playerId, false);
        this.log(`Unusual Pets Reward: ${player.name} drew a card.`);
        this.notifyStateChange();
        break;
      }
    }
  }

  // Deal damage to a player (forces discarding top of deck)
  dealDamage(targetPlayerId, amount, damageSource = 'spell') {
    const target = this.players[targetPlayerId];

    // Check damage prevention flags
    if (target.preventAllDamageNextTurn) {
      this.log(`All damage to ${target.name} is prevented (Shrinking Potion)!`);
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
        this.log(`Creature damage to ${target.name} is prevented (Wingardium Leviosa!)!`);
        return;
      }
    }

    if (damageSource === 'spell' && amount > 0) {
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
            this.resolveRedirectionOrDamage(targetPlayerId, amount);
          }
        });
        return;
      }
    }

    this.resolveRedirectionOrDamage(targetPlayerId, amount);
  }

  resolveRedirectionOrDamage(targetPlayerId, amount) {
    const target = this.players[targetPlayerId];
    const redirectOptions = target.creatures.filter(c => c.name === 'Pet Toad' || c.name === 'Kelpie');
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

  applyDeckDamage(targetPlayerId, amount) {
    const target = this.players[targetPlayerId];
    this.log(`${target.name} takes ${amount} damage! Discarding cards from deck.`, 'damage');
    
    for (let i = 0; i < amount; i++) {
      if (target.deck.length === 0) {
        this.log(`${target.name}'s deck is depleted. Game Over!`, 'damage');
        this.checkWinConditions();
        return;
      }
      const discardedCard = target.deck.pop();
      target.discardPile.push(discardedCard);
    }
    this.notifyStateChange();
  }

  // End active player's turn
  endTurn() {
    const activePlayer = this.players[this.activePlayerId];
    const inactivePlayer = this.players[this.activePlayerId === 'player' ? 'opponent' : 'player'];
    
    // Active player's restriction flags expire
    activePlayer.cantPlayCardsNextTurn = false;
    activePlayer.discardDrawsNextTurn = false;
    
    // Inactive player's protection flags expire
    inactivePlayer.preventAllDamageNextTurn = false;
    inactivePlayer.preventCreatureAdventureDamageNextTurn = false;
    inactivePlayer.preventCreatureDamageNextTurn = false;

    this.log(`Ending turn for ${activePlayer.name}.`, 'turn');

    // 1. Resolve active player's creatures' end-of-turn damage
    if (activePlayer.creatures.length > 0) {
      const targetId = this.activePlayerId === 'player' ? 'opponent' : 'player';
      const targetPlayer = this.players[targetId];
      activePlayer.creatures.forEach(creature => {
        let dmg = creature.damagePerTurn || 0;
        // Check Winged Keys prevention
        if (targetPlayer.wingedKeysTargetInstanceId === creature.instanceId) {
          this.log(`Winged Keys: Prevented all damage from ${creature.name}.`);
          dmg = 0;
        }
        if (dmg > 0) {
          const hasHagrid = activePlayer.characters.some(c => c.name === 'Rubeus Hagrid');
          if (hasHagrid && dmg >= 3) {
            dmg += 2;
            this.log(`Rubeus Hagrid: ${creature.name}'s damage is boosted by +2 (deals ${dmg} total).`);
          }
          this.log(`${creature.name} attacks!`);
          this.dealDamage(targetId, dmg, 'creature');
        }
      });
    }

    // Reset active player's turn-based flags
    activePlayer.lessonsPlayedThisTurn = 0;
    activePlayer.preventSpellDamageOnceThisTurn = false;
    activePlayer.tookPeevesDamageThisEvent = false;
    activePlayer.playedCardsLastTurnCount = activePlayer.playedCardsThisTurnCount;
    activePlayer.playedCardsThisTurnCount = 0;
    activePlayer.items.forEach(i => { i.usedThisTurn = false; });
    inactivePlayer.tookPeevesDamageThisEvent = false;
    inactivePlayer.wingedKeysTargetInstanceId = null;

    // 2. Toggle active player
    this.activePlayerId = this.activePlayerId === 'player' ? 'opponent' : 'player';
    
    const nextPlayer = this.players[this.activePlayerId];
    const unicornCount = nextPlayer.creatures.filter(c => c.name === 'Unicorn').length;
    this.actionsRemaining = 2 + unicornCount;
    this.turnNumber++;

    this.log(`--- Turn ${this.turnNumber}: Start of ${nextPlayer.name}'s Turn ---`, 'turn');

    // 2.5 Resolve start-of-turn Adventure effects for nextPlayer
    const oppHasDragonsEscape = activePlayer.adventures.some(a => a.name === "Dragon's Escape");
    if (oppHasDragonsEscape) {
      this.log(`Dragon's Escape: Dealing 1 before-turn damage to ${activePlayer.name}.`);
      this.dealDamage(activePlayer.id, 1, 'adventure');
    }

    const oppHasTroll = activePlayer.adventures.some(a => a.name === "Troll in the Bathroom");
    if (oppHasTroll) {
      this.log(`Troll in the Bathroom: Dealing 2 before-turn damage to ${activePlayer.name}.`);
      this.dealDamage(activePlayer.id, 2, 'adventure');
    }

    const oppHasUnusualPets = activePlayer.adventures.some(a => a.name === "Unusual Pets");
    if (oppHasUnusualPets) {
      this.log(`Unusual Pets: Dealing 4 before-turn damage to ${activePlayer.name}.`);
      this.dealDamage(activePlayer.id, 4, 'adventure');
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
    
    // 3. Draw phase for the new active player
    const owlCount = nextPlayer.creatures.filter(c => c.name === 'Delivery Owl').length;
    for (let i = 0; i < owlCount; i++) {
      this.log(`Delivery Owl: Drawing an extra card before ${nextPlayer.name}'s turn.`);
      this.drawCard(this.activePlayerId, false);
    }
    
    this.drawCard(this.activePlayerId, false);

    this.notifyStateChange();
  }

  // Win condition checker
  checkWinConditions() {
    const pDeckEmpty = this.players.player.deck.length === 0;
    const oDeckEmpty = this.players.opponent.deck.length === 0;

    if (pDeckEmpty && oDeckEmpty) {
      this.gameOver = true;
      this.winnerMessage = 'Both players ran out of cards! It is a Tie!';
      this.log(this.winnerMessage, 'turn');
    } else if (pDeckEmpty) {
      this.gameOver = true;
      this.winnerMessage = 'You ran out of cards! Hogwarts Rival wins!';
      this.log(this.winnerMessage, 'turn');
    } else if (oDeckEmpty) {
      this.gameOver = true;
      this.winnerMessage = 'Opponent ran out of cards! You win!';
      this.log(this.winnerMessage, 'turn');
    }
  }
}
