/**
 * Harry Potter TCG - UI Manager
 * Handles DOM rendering, card template generation, animations, and event bindings.
 */

export class UIManager {
  constructor(engine) {
    this.engine = engine;
    this.selectedCardId = null;
    this.isInitialTurnAnnouncementDelayed = false;

    // Cache DOM Elements
    this.el = {
      playerHand: document.getElementById('hand-area'),
      playerLessons: document.getElementById('player-lessons-zone'),
      playerCreatures: document.getElementById('player-creatures-zone'),
      playerItems: document.getElementById('player-items-zone'),
      playerAdventures: document.getElementById('player-adventures-zone'),
      playerLocations: document.getElementById('player-locations-zone'),
      playerMatches: document.getElementById('player-matches-zone'),
      playerCharacter: document.getElementById('player-character-zone'),
      
      opponentLessons: document.getElementById('opponent-lessons-zone'),
      opponentCreatures: document.getElementById('opponent-creatures-zone'),
      opponentItems: document.getElementById('opponent-items-zone'),
      opponentAdventures: document.getElementById('opponent-adventures-zone'),
      opponentLocations: document.getElementById('opponent-locations-zone'),
      opponentMatches: document.getElementById('opponent-matches-zone'),
      opponentCharacter: document.getElementById('opponent-character-zone'),
      opponentHand: document.getElementById('opponent-hand-area'),

      playerDeckCount: document.getElementById('player-deck-count'),
      playerDiscardCount: document.getElementById('player-discard-count'),
      opponentDeckCount: document.getElementById('opponent-deck-count'),
      opponentDiscardCount: document.getElementById('opponent-discard-count'),
      
      actionCounter: document.getElementById('action-counter'),
      activePlayerName: document.getElementById('active-player-name'),
      logList: document.getElementById('log-list'),
      rulingsContent: document.getElementById('rulings-content'),
      
      btnDraw: document.getElementById('btn-draw'),
      btnEndTurn: document.getElementById('btn-end-turn'),

      cardPreviewModal: document.getElementById('card-preview-modal'),
      modalCardImage: document.getElementById('modal-card-image'),
      modalCloseBtn: document.getElementById('modal-close-btn'),
      modalActions: document.getElementById('modal-actions'),

      playerDiscardPile: document.getElementById('player-discard-pile'),
      opponentDiscardPile: document.getElementById('opponent-discard-pile'),
      discardViewerModal: document.getElementById('discard-viewer-modal'),
      discardViewerCloseBtn: document.getElementById('discard-viewer-close-btn'),
      discardViewerTitle: document.getElementById('discard-viewer-title'),
      discardViewerGrid: document.getElementById('discard-viewer-grid'),
      
      lessonsViewerModal: document.getElementById('lessons-viewer-modal'),
      lessonsViewerCloseBtn: document.getElementById('lessons-viewer-close-btn'),
      lessonsViewerTitle: document.getElementById('lessons-viewer-title'),
      lessonsViewerGrid: document.getElementById('lessons-viewer-grid'),
      opponentLessonsTallyList: document.getElementById('opponent-lessons-tally-list'),
      playerLessonsTallyList: document.getElementById('player-lessons-tally-list'),
      opponentLessonsViewBtn: document.getElementById('opponent-lessons-view-btn'),
      playerLessonsViewBtn: document.getElementById('player-lessons-view-btn'),
      
      playerDeckPile: document.getElementById('player-deck-pile'),
      opponentDeckPile: document.getElementById('opponent-deck-pile'),
      deckViewerModal: document.getElementById('deck-viewer-modal'),
      deckViewerCloseBtn: document.getElementById('deck-viewer-close-btn'),
      deckViewerTitle: document.getElementById('deck-viewer-title'),
      deckViewerGrid: document.getElementById('deck-viewer-grid'),

      gameOverModal: document.getElementById('game-over-modal'),
      gameOverMessage: document.getElementById('game-over-message'),
      btnModalReset: document.getElementById('btn-modal-reset'),
      btnModalClose: document.getElementById('btn-modal-close'),

      // Spell targeting modal elements
      spellTargetingModal: document.getElementById('spell-targeting-modal'),
      spellTargetingTitle: document.getElementById('spell-targeting-title'),
      spellTargetingDesc: document.getElementById('spell-targeting-desc'),
      spellTargetingOptions: document.getElementById('spell-targeting-options'),
      spellTargetingActions: document.getElementById('spell-targeting-actions'),
      btnSpellConfirm: document.getElementById('btn-spell-confirm'),
      btnSpellCancel: document.getElementById('btn-spell-cancel'),

      // Spell cast announcement modal elements
      spellCastModal: document.getElementById('spell-cast-modal'),
      spellCastImage: document.getElementById('spell-cast-image'),
      spellCastName: document.getElementById('spell-cast-name'),

      // Play error modal elements
      playErrorModal: document.getElementById('play-error-modal'),
      playErrorMessage: document.getElementById('play-error-message'),
      playErrorCloseBtn: document.getElementById('play-error-close-btn'),
      playErrorOkBtn: document.getElementById('play-error-ok-btn'),

      // Adventure solved modal elements
      adventureSolvedModal: document.getElementById('adventure-solved-modal'),
      adventureSolvedTitle: document.getElementById('adventure-solved-title'),
      adventureSolvedSubtitle: document.getElementById('adventure-solved-subtitle'),
      adventureSolvedImage: document.getElementById('adventure-solved-image'),
      adventureSolvedName: document.getElementById('adventure-solved-name'),
      adventureSolvedReward: document.getElementById('adventure-solved-reward'),
      adventureSolvedCloseBtn: document.getElementById('adventure-solved-close-btn'),
      adventureSolvedOkBtn: document.getElementById('adventure-solved-ok-btn'),

      // Action error modal elements
      actionErrorModal: document.getElementById('action-error-modal'),
      actionErrorMessage: document.getElementById('action-error-message'),
      actionErrorCloseBtn: document.getElementById('action-error-close-btn'),
      actionErrorOkBtn: document.getElementById('action-error-ok-btn'),

      // Match won modal elements
      matchWonModal: document.getElementById('match-won-modal'),
      matchWonTitle: document.getElementById('match-won-title'),
      matchWonSubtitle: document.getElementById('match-won-subtitle'),
      matchWonImage: document.getElementById('match-won-image'),
      matchWonName: document.getElementById('match-won-name'),
      matchWonPrize: document.getElementById('match-won-prize'),
      matchWonCloseBtn: document.getElementById('match-won-close-btn'),
      matchWonOkBtn: document.getElementById('match-won-ok-btn')
    };

    // Listen for spell play events
    this.engine.onSpellPlayed((card, playerId) => {
      this.showSpellCastZoom(card, playerId);
    });

    // Listen for deck shuffle events
    this.engine.onShuffle((playerId) => {
      this.triggerShuffleAnnouncement(playerId);
    });

    // Listen for deck damage events
    this.engine.onDamageTaken((playerId, amount) => {
      this.triggerDeckDamageAnimation(playerId, amount);
    });

    // Listen for play error events
    this.engine.onPlayError((message, playerId) => {
      if (playerId === 'player' || (this.engine.isDebugMode && !this.engine.isMultiplayer)) {
        this.showPlayErrorModal(message);
      }
    });

    // Listen for adventure solved events
    this.engine.onAdventureSolved((adventure, rewardDescription, solverId) => {
      this.showAdventureSolvedModal(adventure, rewardDescription, solverId);
    });

    // Listen for match won events
    this.engine.onMatchWon((winnerId, matchCard) => {
      this.showMatchWonModal(winnerId, matchCard);
    });

    // Listen for action error events
    this.engine.onActionError((message, playerId) => {
      if (playerId === 'player' || (this.engine.isDebugMode && !this.engine.isMultiplayer)) {
        this.showActionErrorModal(message);
      }
    });

    // Setup close listeners for play-error-modal
    if (this.el.playErrorCloseBtn) {
      this.el.playErrorCloseBtn.addEventListener('click', () => this.closePlayErrorModal());
    }
    if (this.el.playErrorOkBtn) {
      this.el.playErrorOkBtn.addEventListener('click', () => this.closePlayErrorModal());
    }

    // Setup close listeners for adventure-solved-modal
    if (this.el.adventureSolvedCloseBtn) {
      this.el.adventureSolvedCloseBtn.addEventListener('click', () => this.closeAdventureSolvedModal());
    }
    if (this.el.adventureSolvedOkBtn) {
      this.el.adventureSolvedOkBtn.addEventListener('click', () => this.closeAdventureSolvedModal());
    }

    // Setup close listeners for match-won-modal
    if (this.el.matchWonCloseBtn) {
      this.el.matchWonCloseBtn.addEventListener('click', () => this.closeMatchWonModal());
    }
    if (this.el.matchWonOkBtn) {
      this.el.matchWonOkBtn.addEventListener('click', () => this.closeMatchWonModal());
    }

    // Setup close listeners for action-error-modal
    if (this.el.actionErrorCloseBtn) {
      this.el.actionErrorCloseBtn.addEventListener('click', () => this.closeActionErrorModal());
    }
    if (this.el.actionErrorOkBtn) {
      this.el.actionErrorOkBtn.addEventListener('click', () => this.closeActionErrorModal());
    }

    this.lastActivePlayerId = null;
    this.lastTurnNumber = null;

    this.bindGlobalEvents();
  }

  // Bind top level controls
  bindGlobalEvents() {
    if (this.el.btnDraw) {
      this.el.btnDraw.addEventListener('click', () => {
        this.engine.drawCard(this.engine.activePlayerId, true);
      });
    }

    if (this.el.btnEndTurn) {
      this.el.btnEndTurn.addEventListener('click', () => {
        const activeId = this.engine.activePlayerId;
        if (activeId === 'player') {
          this.engine.endTurn();
          
          // Simple AI Opponent Simulation for local play:
          // Wait 1.5s, then let opponent run their turn automatically.
          if (!this.engine.isDebugMode && !this.engine.isMultiplayer) {
            setTimeout(() => this.runOpponentTurnSimulation(), 1200);
          }
        } else if (this.engine.isDebugMode && activeId === 'opponent') {
          this.engine.endTurn();
        }
      });
    }

    // Modal Close Button
    if (this.el.modalCloseBtn) {
      this.el.modalCloseBtn.addEventListener('click', () => {
        this.closePreviewModal();
      });
    }

    // Modal click outside to dismiss
    if (this.el.cardPreviewModal) {
      this.el.cardPreviewModal.addEventListener('click', (event) => {
        if (event.target !== this.el.cardPreviewModal) return;
        const rect = this.el.cardPreviewModal.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (isDialogContent) return;
        this.closePreviewModal();
      });
    }

    // Discard Pile Click to View
    if (this.el.playerDiscardPile) {
      this.el.playerDiscardPile.style.cursor = 'pointer';
      this.el.playerDiscardPile.addEventListener('click', () => {
        this.showDiscardViewer('player');
      });
    }
    if (this.el.opponentDiscardPile) {
      this.el.opponentDiscardPile.style.cursor = 'pointer';
      this.el.opponentDiscardPile.addEventListener('click', () => {
        this.showDiscardViewer('opponent');
      });
    }

    // Discard Viewer Close Button
    if (this.el.discardViewerCloseBtn) {
      this.el.discardViewerCloseBtn.addEventListener('click', () => {
        this.closeDiscardViewer();
      });
    }

    // Discard Viewer click outside to dismiss
    // Discard Viewer click outside to dismiss
    if (this.el.discardViewerModal) {
      this.el.discardViewerModal.addEventListener('click', (event) => {
        if (event.target !== this.el.discardViewerModal) return;
        const rect = this.el.discardViewerModal.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (isDialogContent) return;
        this.closeDiscardViewer();
      });
    }

    // Lessons View Buttons Click to View
    if (this.el.playerLessonsViewBtn) {
      this.el.playerLessonsViewBtn.addEventListener('click', () => {
        this.showLessonsViewer('player');
      });
    }
    if (this.el.opponentLessonsViewBtn) {
      this.el.opponentLessonsViewBtn.addEventListener('click', () => {
        this.showLessonsViewer('opponent');
      });
    }

    // Lessons Viewer Close Button
    if (this.el.lessonsViewerCloseBtn) {
      this.el.lessonsViewerCloseBtn.addEventListener('click', () => {
        this.closeLessonsViewer();
      });
    }

    // Lessons Viewer click outside to dismiss
    if (this.el.lessonsViewerModal) {
      this.el.lessonsViewerModal.addEventListener('click', (event) => {
        if (event.target !== this.el.lessonsViewerModal) return;
        const rect = this.el.lessonsViewerModal.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (isDialogContent) return;
        this.closeLessonsViewer();
      });
    }

    // Deck Pile Click to View (Debug Mode only)
    if (this.el.playerDeckPile) {
      this.el.playerDeckPile.addEventListener('click', () => {
        if (this.engine.isDebugMode) {
          this.showDeckViewer('player');
        }
      });
    }
    if (this.el.opponentDeckPile) {
      this.el.opponentDeckPile.addEventListener('click', () => {
        if (this.engine.isDebugMode) {
          this.showDeckViewer('opponent');
        }
      });
    }

    // Deck Viewer Close Button
    if (this.el.deckViewerCloseBtn) {
      this.el.deckViewerCloseBtn.addEventListener('click', () => {
        this.closeDeckViewer();
      });
    }

    // Deck Viewer click outside to dismiss
    if (this.el.deckViewerModal) {
      this.el.deckViewerModal.addEventListener('click', (event) => {
        if (event.target !== this.el.deckViewerModal) return;
        const rect = this.el.deckViewerModal.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (isDialogContent) return;
        this.closeDeckViewer();
      });
    }

    // Game Over Modal Reset Button
    if (this.el.btnModalReset) {
      this.el.btnModalReset.addEventListener('click', () => {
        const btnReset = document.getElementById('btn-reset');
        if (btnReset) {
          btnReset.click();
        }
        this.closeGameOverModal();
      });
    }

    // Game Over Modal Close Button
    if (this.el.btnModalClose) {
      this.el.btnModalClose.addEventListener('click', () => {
        this.closeGameOverModal();
      });
    }

    // Spell Targeting Confirm/Cancel Buttons
    if (this.el.btnSpellConfirm) {
      this.el.btnSpellConfirm.addEventListener('click', () => {
        if (this.spellSelectionSequence && this.spellSelectionSequence.length > 0) {
          this.engine.resolvePendingSpell(this.spellSelectionSequence);
        } else {
          const selectedEls = this.el.spellTargetingOptions.querySelectorAll('.selected');
          const selectedIds = Array.from(selectedEls).map(el => el.getAttribute('data-choice-id'));
          this.engine.resolvePendingSpell(selectedIds);
        }
      });
    }

    if (this.el.btnSpellCancel) {
      this.el.btnSpellCancel.addEventListener('click', () => {
        const pending = this.engine.pendingSpell;
        if (pending && pending.casterId === 'player' && pending.card) {
          const player = this.engine.players.player;
          player.discardPile = player.discardPile.filter(c => c.instanceId !== pending.card.instanceId);
          player.hand.push(pending.card);
          this.engine.actionsRemaining++;
          this.engine.log(`Canceled casting ${pending.card.name}. Card and action refunded.`);
        }
        this.engine.pendingSpell = null;
        this.closeSpellTargetingModal();
        this.engine.notifyStateChange();
      });
    }

    // Redirect scroll wheel in Hand Areas to horizontal scroll
    // Scroll down (deltaY > 0) -> scroll right (increase scrollLeft)
    // Scroll up (deltaY < 0) -> scroll left (decrease scrollLeft)
    const handleHandWheel = (event) => {
      event.preventDefault();
      const container = event.currentTarget;
      if (event.deltaY > 0) {
        container.scrollLeft += Math.abs(event.deltaY);
      } else {
        container.scrollLeft -= Math.abs(event.deltaY);
      }
    };

    if (this.el.playerHand) {
      this.el.playerHand.addEventListener('wheel', handleHandWheel, { passive: false });
    }
    if (this.el.opponentHand) {
      this.el.opponentHand.addEventListener('wheel', handleHandWheel, { passive: false });
    }
  }

  // Very simple opponent play script to keep offline local play interactive
  runOpponentTurnSimulation() {
    if (this.engine.isMultiplayer) return;
    if (this.engine.activePlayerId !== 'opponent') return;

    this.engine.log("--- Rival is planning actions... ---", "turn");
    
    // AI Loop: Try to play cards in hand or draw
    const opponent = this.engine.players.opponent;

    // Helper to evaluate and play
    const tryPlayAI = (triedInstanceIds = new Set()) => {
      if (this.engine.actionsRemaining <= 0 || this.engine.activePlayerId !== 'opponent') {
        // No actions, end turn
        setTimeout(() => this.engine.endTurn(), 800);
        return;
      }

      // 0. Check if there is an active adventure on AI's side that can be solved
      const solvableAdventure = opponent.adventures.find(a => this.engine.canSolveAdventure('opponent', a));
      if (solvableAdventure) {
        this.engine.log(`Rival chooses to solve adventure: ${solvableAdventure.name}`);
        this.engine.solveAdventure('opponent', solvableAdventure.instanceId);
        setTimeout(() => tryPlayAI(new Set()), 1200);
        return;
      }

      // 1. Look for a Lesson to play first
      const lesson = opponent.hand.find(c => c.type === 'Lesson' && !triedInstanceIds.has(c.instanceId));
      if (lesson) {
        const played = this.engine.playCard('opponent', lesson.instanceId);
        if (played) {
          setTimeout(() => tryPlayAI(new Set()), 800);
          return;
        } else {
          triedInstanceIds.add(lesson.instanceId);
          tryPlayAI(triedInstanceIds);
          return;
        }
      }

      // 2. Try to play other cards if requirements are met
      const playable = opponent.hand.find(card => {
        if (triedInstanceIds.has(card.instanceId)) return false;
        if (!card.lessonCost) return true;
        const { counts, total } = opponent.lessonCounts;
        return total >= card.lessonCost.total && counts[card.lessonCost.type] >= 1;
      });

      if (playable) {
        const isSpell = playable.type === 'Spell';
        const played = this.engine.playCard('opponent', playable.instanceId);
        if (played) {
          setTimeout(() => tryPlayAI(new Set()), isSpell ? 3000 : 800);
          return;
        } else {
          triedInstanceIds.add(playable.instanceId);
          tryPlayAI(triedInstanceIds);
          return;
        }
      }

      // 3. Otherwise draw a card
      const drew = this.engine.drawCard('opponent', true);
      if (drew) {
        setTimeout(() => tryPlayAI(new Set()), 800);
      } else {
        setTimeout(() => this.engine.endTurn(), 800);
      }
    };

    setTimeout(() => tryPlayAI(new Set()), 800);
  }

  // Main Render Loop
  render() {
    const player = this.engine.players.player;
    const opponent = this.engine.players.opponent;

    if (!player || !opponent) return;

    // Enable/Disable top action buttons based on active player turn
    const isHumanTurn = this.engine.activePlayerId === 'player' || this.engine.isDebugMode;
    if (this.el.btnDraw) {
      this.el.btnDraw.disabled = !isHumanTurn;
      this.el.btnDraw.style.opacity = isHumanTurn ? '' : '0.5';
      this.el.btnDraw.style.pointerEvents = isHumanTurn ? '' : 'none';
    }
    if (this.el.btnEndTurn) {
      this.el.btnEndTurn.disabled = !isHumanTurn;
      this.el.btnEndTurn.style.opacity = isHumanTurn ? '' : '0.5';
      this.el.btnEndTurn.style.pointerEvents = isHumanTurn ? '' : 'none';
    }

    // Check Turn Transition for Dim Screen Animation
    const activePlayerId = this.engine.activePlayerId;
    const turnNumber = this.engine.turnNumber;
    if (this.lastActivePlayerId !== activePlayerId || this.lastTurnNumber !== turnNumber) {
      this.lastActivePlayerId = activePlayerId;
      this.lastTurnNumber = turnNumber;
      if (!this.isInitialTurnAnnouncementDelayed) {
        this.triggerTurnAnnouncement(activePlayerId);
      }
    }

    // Render Hands
    const isPlayerTurn = !this.engine.isDebugMode || this.engine.activePlayerId === 'player';
    this.renderHand(this.el.playerHand, player.hand, isPlayerTurn);
    this.renderOpponentHand();
    
    // Render Board Zones
    this.renderZone(this.el.playerCharacter, player.characters);
    this.renderLessonsTally(this.el.playerLessons, player);
    this.renderZone(this.el.playerCreatures, [...player.creatures, ...player.items]);
    this.renderZone(this.el.playerLocations, player.locations);
    this.renderZone(this.el.playerAdventures, player.adventures);
    this.renderZone(this.el.playerMatches, player.matches);
    
    this.renderZone(this.el.opponentCharacter, opponent.characters);
    this.renderLessonsTally(this.el.opponentLessons, opponent);
    this.renderZone(this.el.opponentCreatures, [...opponent.creatures, ...opponent.items]);
    this.renderZone(this.el.opponentLocations, opponent.locations);
    this.renderZone(this.el.opponentAdventures, opponent.adventures);
    this.renderZone(this.el.opponentMatches, opponent.matches);

    // Update Decks & Discard Counts
    if (this.el.playerDeckCount) this.el.playerDeckCount.innerText = player.deck.length;
    if (this.el.playerDiscardCount) this.el.playerDiscardCount.innerText = player.discardPile.length;
    if (this.el.opponentDeckCount) this.el.opponentDeckCount.innerText = opponent.deck.length;
    if (this.el.opponentDiscardCount) this.el.opponentDiscardCount.innerText = opponent.discardPile.length;

    // Update Sidebar Status
    if (this.el.actionCounter) this.el.actionCounter.innerText = this.engine.actionsRemaining;
    if (this.el.activePlayerName) {
      this.el.activePlayerName.innerText = this.engine.activePlayerId === 'player' ? 'Your Turn' : "Opponent's Turn";
    }

    // Update Debug Actions toggle button disabled states
    const btnEnable = document.getElementById('btn-debug-enable-actions');
    const btnDisable = document.getElementById('btn-debug-disable-actions');
    if (btnEnable && btnDisable) {
      if (this.engine.debugUnlimitedActions) {
        btnEnable.disabled = true;
        btnEnable.classList.add('disabled');
        btnDisable.disabled = false;
        btnDisable.classList.remove('disabled');
      } else {
        btnEnable.disabled = false;
        btnEnable.classList.remove('disabled');
        btnDisable.disabled = true;
        btnDisable.classList.add('disabled');
      }
    }

    // Update Logs
    this.renderLogs();

    // Check Game Over State
    if (this.engine.gameOver) {
      this.showGameOverModal(this.engine.winnerMessage);
    } else {
      this.closeGameOverModal();
    }

    // Check Spell Targeting State
    if (this.engine.pendingSpell && this.engine.pendingSpell.casterId === 'player') {
      this.showSpellTargetingModal(this.engine.pendingSpell);
    } else {
      this.closeSpellTargetingModal();
    }

    // Update active deck/discard viewers reactively if they are open in Debug Mode
    if (this.engine.isDebugMode && this.activeViewerPlayerId) {
      if (this.el.deckViewerModal && this.el.deckViewerModal.open) {
        this.showDeckViewer(this.activeViewerPlayerId, true);
      }
      if (this.el.discardViewerModal && this.el.discardViewerModal.open) {
        this.showDiscardViewer(this.activeViewerPlayerId, true);
      }
    }
    
    // Update lessons viewer reactively if it is open
    if (this.activeLessonsViewerPlayerId && this.el.lessonsViewerModal && this.el.lessonsViewerModal.open) {
      this.showLessonsViewer(this.activeLessonsViewerPlayerId, true);
    }
  }

  triggerTurnAnnouncement(activePlayerId) {
    const gameContainer = document.getElementById('game-container');
    if (gameContainer && gameContainer.classList.contains('hidden')) {
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'turn-announcement-overlay';

    const textEl = document.createElement('div');
    textEl.className = 'turn-announcement-text';
    textEl.innerText = activePlayerId === 'player' ? 'Your Turn' : "Opponent's Turn";
    
    if (activePlayerId === 'player') {
      textEl.style.color = '#ffd700';
      textEl.style.textShadow = '0 0 20px rgba(255, 215, 0, 0.6), 0 4px 15px rgba(0,0,0,0.8)';
    } else {
      textEl.style.color = '#ff4d4d';
      textEl.style.textShadow = '0 0 20px rgba(255, 77, 77, 0.6), 0 4px 15px rgba(0,0,0,0.8)';
    }

    overlay.appendChild(textEl);
    document.body.appendChild(overlay);

    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 1000);
  }

  triggerCoinToss(callback) {
    const overlay = document.createElement('div');
    overlay.className = 'coin-toss-overlay';

    const container = document.createElement('div');
    container.className = 'coin-toss-container';

    const title = document.createElement('h2');
    title.className = 'coin-toss-title';
    title.innerText = 'Starting Coin Toss';

    const subtitle = document.createElement('p');
    subtitle.className = 'coin-toss-subtitle';
    subtitle.innerText = 'Call Heads or Tails to determine who goes first!';

    const coinWrapper = document.createElement('div');
    coinWrapper.className = 'coin-wrapper';

    const coin = document.createElement('div');
    coin.className = 'coin';

    const coinHeads = document.createElement('div');
    coinHeads.className = 'coin-face heads';
    coinHeads.innerHTML = `
      <div class="coin-emblem">
        <span class="coin-emblem-text">H</span>
        <span class="coin-emblem-sub">Heads</span>
      </div>
    `;

    const coinTails = document.createElement('div');
    coinTails.className = 'coin-face tails';
    coinTails.innerHTML = `
      <div class="coin-emblem">
        <span class="coin-emblem-text">T</span>
        <span class="coin-emblem-sub">Tails</span>
      </div>
    `;

    coin.appendChild(coinHeads);
    coin.appendChild(coinTails);
    coinWrapper.appendChild(coin);

    const choicesContainer = document.createElement('div');
    choicesContainer.className = 'coin-choices';

    const btnHeads = document.createElement('button');
    btnHeads.className = 'btn-coin-choice';
    btnHeads.innerText = 'Heads';

    const btnTails = document.createElement('button');
    btnTails.className = 'btn-coin-choice';
    btnTails.innerText = 'Tails';

    choicesContainer.appendChild(btnHeads);
    choicesContainer.appendChild(btnTails);

    container.appendChild(title);
    container.appendChild(subtitle);
    container.appendChild(coinWrapper);
    container.appendChild(choicesContainer);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    const handleChoice = (calledChoice) => {
      // Hide buttons
      choicesContainer.style.display = 'none';
      subtitle.innerText = `You called ${calledChoice.toUpperCase()}. Flipping the galleon...`;

      // Determine result
      const isHeads = Math.random() < 0.5;
      const tossResult = isHeads ? 'heads' : 'tails';
      const playerWon = calledChoice === tossResult;
      const startingPlayerId = playerWon ? 'player' : 'opponent';

      // Apply animation class
      coin.className = 'coin'; // reset
      void coin.offsetWidth; // force reflow
      coin.classList.add(isHeads ? 'flip-to-heads' : 'flip-to-tails');

      // Wait for animation to finish (2 seconds)
      setTimeout(() => {
        const resultBox = document.createElement('div');
        resultBox.className = 'coin-toss-result-box';

        const resultText = document.createElement('div');
        resultText.className = 'coin-toss-result-text';
        if (playerWon) {
          resultText.innerText = `${isHeads ? 'Heads' : 'Tails'}! You won the toss and go first.`;
          resultText.style.color = '#ffd700';
        } else {
          resultText.innerText = `${isHeads ? 'Heads' : 'Tails'}! You lost the toss. Rival goes first.`;
          resultText.style.color = '#ff4d4d';
        }

        const btnContinue = document.createElement('button');
        btnContinue.className = 'btn-coin-choice';
        btnContinue.innerText = 'Enter the Match';
        btnContinue.addEventListener('click', () => {
          overlay.style.opacity = '0';
          setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            callback(startingPlayerId);
          }, 500);
        });

        resultBox.appendChild(resultText);
        resultBox.appendChild(btnContinue);
        container.appendChild(resultBox);

        // Animate result box in
        setTimeout(() => {
          resultBox.classList.add('visible');
        }, 50);
      }, 2000);
    };

    btnHeads.addEventListener('click', () => handleChoice('heads'));
    btnTails.addEventListener('click', () => handleChoice('tails'));
  }

  triggerGameStartAnnouncement(startingPlayerId) {
    const overlay = document.createElement('div');
    overlay.className = 'game-start-overlay';

    const content = document.createElement('div');
    content.className = 'game-start-content';

    const title = document.createElement('h1');
    title.className = 'game-start-title';
    title.innerText = 'GAME INITIALIZED';

    const subtitle = document.createElement('p');
    subtitle.className = 'game-start-subtitle';
    subtitle.innerText = 'Shuffling decks and drawing starting hands...';

    const loader = document.createElement('div');
    loader.className = 'magical-loader';

    content.appendChild(title);
    content.appendChild(loader);
    content.appendChild(subtitle);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Keep it on screen for 2 seconds
    setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        // Once the Game Initialized modal is completely gone, trigger the first turn announcement!
        this.isInitialTurnAnnouncementDelayed = false;
        this.triggerTurnAnnouncement(startingPlayerId);
        
        // If opponent goes first and NOT in debug mode, start AI simulation
        if (startingPlayerId === 'opponent' && !this.engine.isDebugMode && !this.engine.isMultiplayer) {
          setTimeout(() => this.runOpponentTurnSimulation(), 1200);
        }
      }, 500);
    }, 2000);
  }

  triggerShuffleAnnouncement(playerId) {
    const gameContainer = document.getElementById('game-container');
    if (gameContainer && gameContainer.classList.contains('hidden')) {
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'shuffle-announcement-overlay';

    const textEl = document.createElement('div');
    textEl.className = 'shuffle-announcement-text';
    textEl.innerText = playerId === 'player' ? "Shuffling Your Deck" : "Shuffling Opponent's Deck";

    if (playerId === 'player') {
      textEl.style.color = '#ffd700';
      textEl.style.textShadow = '0 0 20px rgba(255, 215, 0, 0.6), 0 4px 15px rgba(0,0,0,0.8)';
    } else {
      textEl.style.color = '#ff4d4d';
      textEl.style.textShadow = '0 0 20px rgba(255, 77, 77, 0.6), 0 4px 15px rgba(0,0,0,0.8)';
    }

    const animContainer = document.createElement('div');
    animContainer.className = 'shuffle-animation-container';

    const cardLeft = document.createElement('div');
    cardLeft.className = 'shuffle-card shuffle-card-left';

    const cardRight = document.createElement('div');
    cardRight.className = 'shuffle-card shuffle-card-right';

    animContainer.appendChild(cardLeft);
    animContainer.appendChild(cardRight);

    overlay.appendChild(textEl);
    overlay.appendChild(animContainer);
    document.body.appendChild(overlay);

    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 1500);
  }

  triggerDeckDamageAnimation(playerId, amount) {
    // Defer playing the animation if screen-blocking overlays/modals are active
    if (document.querySelector('.turn-announcement-overlay')) {
      setTimeout(() => this.triggerDeckDamageAnimation(playerId, amount), 1100);
      return;
    }
    if (document.querySelector('.coin-toss-overlay')) {
      setTimeout(() => this.triggerDeckDamageAnimation(playerId, amount), 1000);
      return;
    }
    if (this.el.adventureSolvedModal && this.el.adventureSolvedModal.open) {
      setTimeout(() => this.triggerDeckDamageAnimation(playerId, amount), 500);
      return;
    }

    const deckEl = playerId === 'player' ? this.el.playerDeckPile : this.el.opponentDeckPile;
    if (!deckEl) return;

    for (let i = 0; i < amount; i++) {
      setTimeout(() => {
        const punch = document.createElement('div');
        punch.className = 'punch-effect';

        // Position randomly inside the deck boundary
        const rect = deckEl.getBoundingClientRect();
        const maxX = Math.max(0, rect.width - 32);
        const maxY = Math.max(0, rect.height - 32);

        const randomX = Math.random() * maxX;
        const randomY = Math.random() * maxY;

        punch.style.left = `${randomX}px`;
        punch.style.top = `${randomY}px`;

        deckEl.appendChild(punch);

        setTimeout(() => {
          if (punch.parentNode) {
            punch.parentNode.removeChild(punch);
          }
        }, 400);
      }, i * 150);
    }
  }

  // Render hand cards
  renderHand(container, hand, isInteractive) {
    if (!container) return;
    container.innerHTML = '';

    let handToRender = [...hand];

    handToRender.forEach(card => {
      const cardEl = this.createCardElement(card, true);
      if (isInteractive) {
        // Single click to preview modal (with play button)
        cardEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showPreviewModal(card, true, cardEl);
        });
        // Double click to play immediately
        cardEl.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.engine.playCard(this.engine.activePlayerId, card.instanceId);
          this.closePreviewModal();
        });
      }
      container.appendChild(cardEl);
    });
  }

  // Render opponent hand cards (revealed if Mrs Norris is in play, else card backs)
  renderOpponentHand() {
    const container = this.el.opponentHand;
    if (!container) return;
    container.innerHTML = '';

    const player = this.engine.players.player;
    const opponent = this.engine.players.opponent;
    
    // Mrs Norris reveal condition: player has Mrs Norris in play (either in creatures or characters)
    const hasMrsNorris = player.creatures.some(c => c.name === 'Mrs Norris') || player.characters.some(c => c.name === 'Mrs Norris');
    // Meet the Centaurs reveals opponent's hand if active on player's playmat or if opponent.revealHandRestOfGame is true
    const revealOpponentHand = this.engine.isDebugMode || hasMrsNorris || opponent.revealHandRestOfGame || opponent.adventures.some(a => a.name === 'Meet the Centaurs');
    
    const isInteractive = this.engine.isDebugMode && this.engine.activePlayerId === 'opponent';

    opponent.hand.forEach(card => {
      const cardEl = this.createCardElement(card, true, !revealOpponentHand);
      cardEl.classList.remove('card-horizontal');
      if (isInteractive) {
        // Single click to preview modal (with play button)
        cardEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showPreviewModal(card, true, cardEl);
        });
        // Double click to play immediately
        cardEl.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.engine.playCard('opponent', card.instanceId);
          this.closePreviewModal();
        });
      } else if (revealOpponentHand) {
        cardEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showPreviewModal(card, false, cardEl);
        });
      }
      container.appendChild(cardEl);
    });
  }

  getCreatureNextTurnDamage(playerId) {
    const player = this.engine.players[playerId];
    const opponentId = playerId === 'player' ? 'opponent' : 'player';
    const opponent = this.engine.players[opponentId];
    if (!player || !opponent) return 0;

    const isMadamMalkinActive = this.engine.players.player.locations.some(l => l.name === "Madam Malkin's Robes") ||
                                 this.engine.players.opponent.locations.some(l => l.name === "Madam Malkin's Robes");

    let totalDmg = 0;
    player.creatures.forEach(creature => {
      let dmg = this.engine.getCreatureDamage ? this.engine.getCreatureDamage(playerId, creature) : (creature.damagePerTurn || 0);
      // Check Winged Keys prevention
      if (opponent.wingedKeysTargetInstanceId === creature.instanceId) {
        dmg = 0;
      }
      if (dmg > 0 && isMadamMalkinActive) {
        dmg = Math.max(0, dmg - 1);
      }
      totalDmg += dmg;
    });
    
    return totalDmg;
  }

  getLessonsTallyString(playerId) {
    const player = this.engine.players[playerId];
    if (!player) return '';
    const { counts, total } = player.lessonCounts;
    
    const abbreviationMap = {
      'Care of Magical Creatures': 'CoM',
      'Potions': 'P',
      'Charms': 'Cha',
      'Transfiguration': 'T',
      'Transfigurations': 'T',
      'Quidditch': 'Q'
    };

    const parts = [];
    const order = ['Care of Magical Creatures', 'Potions', 'Charms', 'Transfiguration', 'Quidditch'];
    
    order.forEach(type => {
      const count = counts[type] || 0;
      if (count > 0) {
        const abbr = abbreviationMap[type] || type;
        parts.push(`${abbr}:${count}`);
      }
    });

    if (parts.length === 0) return '';
    return `[Total: ${total}, ${parts.join(', ')}]`;
  }

  // Render cards in board zones
  renderZone(container, cards) {
    if (!container) return;
    
    // Restore default layout if changed by debug mode
    container.style.display = '';
    container.style.flexDirection = '';
    container.style.flexWrap = '';
    container.style.justifyContent = '';
    container.style.alignItems = '';
    container.style.padding = '';

    const isPlayerCreatures = container === this.el.playerCreatures;
    const isOpponentCreatures = container === this.el.opponentCreatures;
    const isCreaturesZone = isPlayerCreatures || isOpponentCreatures;
    
    // Retain the zone-label if present (or search parent container for shared stacked zones)
    let label = container.querySelector('.zone-label');
    let labelInParent = false;
    if (!label) {
      let current = container.parentElement;
      while (current) {
        label = current.querySelector(':scope > .zone-label');
        if (label) {
          labelInParent = true;
          break;
        }
        if (current.id === 'game-container' || current.tagName === 'BODY') break;
        current = current.parentElement;
      }
    }

    container.innerHTML = '';
    if (label) {
      if (isCreaturesZone) {
        const playerId = isPlayerCreatures ? 'player' : 'opponent';
        const totalDmg = this.getCreatureNextTurnDamage(playerId);
        label.innerHTML = `Creatures & Items <span class="creature-total-damage" style="color: var(--accent-gold); font-weight: bold; margin-left: 8px;">(Next Turn Dmg: ${totalDmg})</span>`;
      } else {
        // Reset label for other zones to their default
        if (container === this.el.playerLessons || container === this.el.opponentLessons) {
          const playerId = container === this.el.playerLessons ? 'player' : 'opponent';
          const tallyStr = this.getLessonsTallyString(playerId);
          label.innerHTML = `Lessons <span class="lessons-tally" style="color: var(--accent-gold); font-weight: bold; margin-left: 8px;">${tallyStr}</span>`;
        } else if (container === this.el.playerCharacter || container === this.el.opponentCharacter) {
          label.innerHTML = 'Wizard / Witch';
        } else if (container === this.el.playerItems || container === this.el.opponentItems) {
          label.innerHTML = 'Items';
        } else if (container === this.el.playerAdventures || container === this.el.opponentAdventures) {
          label.innerHTML = 'Adventure';
        } else if (container === this.el.playerLocations || container === this.el.opponentLocations) {
          label.innerHTML = 'Location';
        } else if (container === this.el.playerMatches || container === this.el.opponentMatches) {
          const activeMatch = this.engine.players.player.matches[0] || this.engine.players.opponent.matches[0];
          if (activeMatch) {
            const playerProgress = this.engine.players.player.matchDamageDealt || 0;
            const oppProgress = this.engine.players.opponent.matchDamageDealt || 0;
            let targetDamage = 12; // default
            const toWinMatch = activeMatch.text.match(/Do (\d+) damage/i);
            if (toWinMatch) {
              targetDamage = parseInt(toWinMatch[1], 10);
            } else if (activeMatch.name === 'Muddy Practice') {
              targetDamage = 5;
            }
            
            let playerVal = `(${playerProgress}/${targetDamage} DMG)`;
            let oppVal = `(${oppProgress}/${targetDamage} DMG)`;
            if (activeMatch.name === 'Muddy Practice') {
              playerVal = `(${playerProgress}/${targetDamage} Discarded)`;
              oppVal = `(${oppProgress}/${targetDamage} Discarded)`;
            }

            label.innerHTML = `
              <div class="match-scoreboard-title">Match</div>
              <div class="match-scoreboard-row">
                <span class="match-scoreboard-label">You:</span>
                <span class="match-scoreboard-value">${playerVal}</span>
              </div>
              <div class="match-scoreboard-row">
                <span class="match-scoreboard-label">Opp:</span>
                <span class="match-scoreboard-value">${oppVal}</span>
              </div>
            `;
          } else {
            label.innerHTML = 'Match';
          }
        }
      }
      if (!labelInParent) {
        container.appendChild(label);
      }
    }

    cards.forEach(card => {
      const cardEl = this.createCardElement(card, false);
      // Single click to preview modal
      cardEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showPreviewModal(card, false, cardEl);
      });

      if (isCreaturesZone && card.type === 'Creature') {
        const wrapper = document.createElement('div');
        wrapper.className = 'creature-field-wrapper';
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '6px';

        const maxHealth = this.engine.getCreatureHealth ? this.engine.getCreatureHealth(card) : card.health;
        const healthVal = maxHealth - (card.damage || 0);
        const healthEl = document.createElement('div');
        healthEl.className = 'creature-health-indicator';
        healthEl.style.fontSize = '0.72rem';
        healthEl.style.color = '#ff4d4d';
        healthEl.style.fontWeight = 'bold';
        healthEl.style.background = 'rgba(10, 12, 16, 0.8)';
        healthEl.style.border = '1px solid #ff4d4d';
        healthEl.style.borderRadius = '4px';
        healthEl.style.padding = '2px 6px';
        healthEl.style.whiteSpace = 'nowrap';
        healthEl.innerText = `HP: ${healthVal} / ${maxHealth}`;

        wrapper.appendChild(cardEl);
        wrapper.appendChild(healthEl);
        container.appendChild(wrapper);
      } else {
        container.appendChild(cardEl);
      }
    });
  }

  // Render vertical lessons tallies on the board
  renderLessonsTally(container, player) {
    if (!container) return;
    const tallyList = container.querySelector('.lessons-tally-list');
    if (!tallyList) return;

    tallyList.innerHTML = '';
    const counts = player.lessonCounts.counts || {};
    
    // Fixed order of all lesson types
    const order = [
      'Care of Magical Creatures',
      'Charms',
      'Transfiguration',
      'Potions',
      'Quidditch'
    ];
    
    const colorMap = {
      'Care of Magical Creatures': '#ff8c00', // Orange
      'Charms': '#00bfff',                  // Blue
      'Transfiguration': '#e066ff',         // Purple
      'Potions': '#32cd32',                 // Green
      'Quidditch': '#ffd700'                // Gold
    };

    order.forEach(type => {
      const count = counts[type] || 0;

      const row = document.createElement('div');
      row.className = 'lessons-tally-item';
      if (count === 0) {
        row.style.opacity = '0.35'; // Dim if 0 count
      }
      
      const iconName = document.createElement('div');
      iconName.className = 'lessons-tally-icon-name';
      
      const nameSpan = document.createElement('span');
      const abbrMap = {
        'Care of Magical Creatures': 'Creatures',
        'Charms': 'Charms',
        'Transfiguration': 'Transfig',
        'Potions': 'Potions',
        'Quidditch': 'Quidditch'
      };
      nameSpan.innerText = abbrMap[type] || type;
      nameSpan.style.color = colorMap[type] || 'var(--text-primary)';
      
      iconName.appendChild(nameSpan);
      
      const countSpan = document.createElement('span');
      countSpan.className = 'lessons-tally-count';
      countSpan.innerText = `x${count}`;
      countSpan.style.color = colorMap[type] || 'var(--text-primary)';
      
      row.appendChild(iconName);
      row.appendChild(countSpan);
      tallyList.appendChild(row);
    });

    // Update total count in title label if present
    const header = container.querySelector('.lessons-summary-title');
    if (header) {
      header.innerText = `Lessons (${player.lessonCounts.total})`;
    }
  }

  // Show lessons viewer modal
  showLessonsViewer(playerId, isUpdateOnly = false) {
    const player = this.engine.players[playerId];
    if (!player || !this.el.lessonsViewerModal || !this.el.lessonsViewerGrid || !this.el.lessonsViewerTitle) return;

    this.activeLessonsViewerPlayerId = playerId;
    this.el.lessonsViewerTitle.innerText = `${player.name === 'You' ? 'Your' : player.name + "'s"} Lessons (${player.lessons.length})`;
    this.el.lessonsViewerGrid.innerHTML = '';

    if (player.lessons.length === 0) {
      this.el.lessonsViewerGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;">No lessons in play.</div>`;
    } else {
      player.lessons.forEach(card => {
        const cardEl = this.createCardElement(card, false);
        cardEl.classList.remove('card-horizontal');
        cardEl.style.transform = 'none';
        cardEl.style.margin = '0';
        
        cardEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showPreviewModal(card, false, cardEl);
        });
        
        this.el.lessonsViewerGrid.appendChild(cardEl);
      });
    }

    if (!isUpdateOnly) {
      this.el.lessonsViewerModal.showModal();
    }
  }

  // Close lessons viewer modal
  closeLessonsViewer() {
    if (this.el.lessonsViewerModal) {
      this.el.lessonsViewerModal.close();
    }
  }

  // Create Card DOM element
  createCardElement(card, isHand, isFaceDown = false) {
    const el = document.createElement('div');
    if (isFaceDown) {
      el.className = 'card card-back';
      return el;
    }

    el.className = `card card-type-${card.type.toLowerCase()}`;
    el.setAttribute('data-instance-id', card.instanceId);

    
    const lessonType = card.lessonCost?.type || card.lessonType || '';
    if (lessonType) {
      el.setAttribute('data-lesson-type', lessonType);
    }



    if (card.image) {
      el.style.backgroundImage = `url('${card.image}')`;
      el.style.backgroundSize = '100% 100%';
      el.style.backgroundPosition = 'center';
      el.style.backgroundRepeat = 'no-repeat';
    }

    // Bind Hover listeners for errata / official rulings
    el.addEventListener('mouseenter', () => {
      this.displayCardRulings(card.name);
    });
    el.addEventListener('mouseleave', () => {
      this.clearCardRulings();
    });

    return el;
  }

  // Search and display card rulings errata matching card name
  displayCardRulings(cardName) {
    if (!this.el.rulingsContent) return;

    const rulings = this.engine.rulingsDatabase || [];
    const matching = rulings.filter(r => r.cards && r.cards.includes(cardName));

    if (matching.length === 0) {
      this.el.rulingsContent.innerHTML = `<span style="color: var(--text-muted); font-style: italic;">No official rulings or errata found for "${cardName}".</span>`;
      return;
    }

    this.el.rulingsContent.innerHTML = matching.map(r => `
      <div class="ruling-item">
        <div class="ruling-header">
          <span class="ruling-source">${r.source || 'Errata'}</span>
          <span class="ruling-date">${r.date || ''}</span>
        </div>
        <div class="ruling-text">${r.ruling}</div>
      </div>
    `).join('');
  }

  clearCardRulings() {
    if (this.el.rulingsContent) {
      this.el.rulingsContent.innerHTML = 'Hover over a card to view official rulings.';
    }
  }

  // Render game logs in sidebar
  renderLogs() {
    if (!this.el.logList) return;
    this.el.logList.innerHTML = '';
    
    // Show last 25 logs
    const visibleLogs = this.engine.logs.slice(-25);
    
    visibleLogs.forEach(log => {
      const li = document.createElement('li');
      li.className = `log-${log.type}`;
      li.innerHTML = `<strong>[${log.timestamp}]</strong> ${log.message}`;
      this.el.logList.appendChild(li);
    });

    // Auto-scroll to bottom of logs
    this.el.logList.scrollTop = this.el.logList.scrollHeight;
  }

  showPreviewModal(card, isPlayable, cardEl) {
    if (!this.el.cardPreviewModal || !this.el.modalCardImage) return;

    // Detect Owner & Zone immediately
    let cardOwner = null;
    let cardZone = null;
    const engine = this.engine;
    if (engine.players.player.hand.some(c => c.instanceId === card.instanceId)) { cardOwner = 'player'; cardZone = 'hand'; }
    else if (engine.players.player.deck.some(c => c.instanceId === card.instanceId)) { cardOwner = 'player'; cardZone = 'deck'; }
    else if (engine.players.player.discardPile.some(c => c.instanceId === card.instanceId)) { cardOwner = 'player'; cardZone = 'discard'; }
    else if (engine.players.player.lessons.some(c => c.instanceId === card.instanceId) ||
             engine.players.player.creatures.some(c => c.instanceId === card.instanceId) ||
             engine.players.player.characters.some(c => c.instanceId === card.instanceId) ||
             engine.players.player.items.some(c => c.instanceId === card.instanceId) ||
             engine.players.player.adventures.some(c => c.instanceId === card.instanceId) ||
             engine.players.player.locations.some(c => c.instanceId === card.instanceId) ||
             engine.players.player.matches.some(c => c.instanceId === card.instanceId)) { cardOwner = 'player'; cardZone = 'field'; }
             
    if (!cardZone) {
      if (engine.players.opponent.hand.some(c => c.instanceId === card.instanceId)) { cardOwner = 'opponent'; cardZone = 'hand'; }
      else if (engine.players.opponent.deck.some(c => c.instanceId === card.instanceId)) { cardOwner = 'opponent'; cardZone = 'deck'; }
      else if (engine.players.opponent.discardPile.some(c => c.instanceId === card.instanceId)) { cardOwner = 'opponent'; cardZone = 'discard'; }
      else if (engine.players.opponent.lessons.some(c => c.instanceId === card.instanceId) ||
               engine.players.opponent.creatures.some(c => c.instanceId === card.instanceId) ||
               engine.players.opponent.characters.some(c => c.instanceId === card.instanceId) ||
               engine.players.opponent.items.some(c => c.instanceId === card.instanceId) ||
               engine.players.opponent.adventures.some(c => c.instanceId === card.instanceId) ||
               engine.players.opponent.locations.some(c => c.instanceId === card.instanceId) ||
               engine.players.opponent.matches.some(c => c.instanceId === card.instanceId)) { cardOwner = 'opponent'; cardZone = 'field'; }
    }

    this.el.modalCardImage.src = card.image || '';
    this.el.modalCardImage.alt = card.name || 'Card Preview';

    // Determine orientation based on card type or field state
    let rotation = 0;

    // Apply rotation transforms
    this.el.modalCardImage.style.transform = 'none';
    this.el.modalCardImage.style.margin = '0';

    if (this.el.modalActions) {
      this.el.modalActions.innerHTML = '';
      this.el.modalActions.style.display = 'flex';
      this.el.modalActions.style.flexDirection = 'column';
      this.el.modalActions.style.alignItems = 'center';
      this.el.modalActions.style.gap = '12px';

      // Adventure progress display (field multi-turn adventures)
      if (cardZone === 'field' && card.type === 'Adventure') {
        const isSkipAdventure = card.name === "Gringotts' Cart Ride" || card.name === "Diagon Alley" || card.name === "Peeves Causes Trouble" || card.name === "Into the Forbidden Forest" || card.name === "Through the Arch";
        if (isSkipAdventure) {
          const targetSkips = card.name === "Diagon Alley" ? 7 : (card.name === "Through the Arch" ? 4 : 5);
          const currentSkips = card.skipCount || 0;
          
          const progressDiv = document.createElement('div');
          progressDiv.className = 'adventure-progress';
          progressDiv.style.color = 'var(--accent-gold)';
          progressDiv.style.fontWeight = 'bold';
          progressDiv.style.fontSize = '1.1rem';
          progressDiv.style.textShadow = '0 0 5px var(--accent-gold-glow)';
          progressDiv.style.marginBottom = '6px';
          progressDiv.innerText = `Progress: ${currentSkips} / ${targetSkips} Actions`;
          
          this.el.modalActions.appendChild(progressDiv);
        }
      }

      const mainActionsRow = document.createElement('div');
      mainActionsRow.style.display = 'flex';
      mainActionsRow.style.gap = '12px';
      mainActionsRow.style.justifyContent = 'center';
      mainActionsRow.style.width = '100%';
      this.el.modalActions.appendChild(mainActionsRow);

      const activeId = this.engine.activePlayerId;
      const isMyTurn = activeId === 'player' || (this.engine.isDebugMode && activeId === 'opponent');

      if (isPlayable && isMyTurn && this.engine.actionsRemaining > 0) {
        const btnPlay = document.createElement('button');
        btnPlay.className = 'btn';
        btnPlay.innerText = 'Play Card';
        btnPlay.style.width = '200px';
        btnPlay.addEventListener('click', () => {
          this.engine.playCard(activeId, card.instanceId);
          this.closePreviewModal();
        });
        mainActionsRow.appendChild(btnPlay);
      }
      
      // Determine owner of the card in play
      const ownerId = (cardZone === 'field') ? cardOwner : null;

      if (ownerId && ownerId === activeId && this.engine.actionsRemaining > 0) {
        // Character ability activation
        if (card.type === 'Character' && this.engine.canActivateCharacterAbility(ownerId, card)) {
          const btnActivate = document.createElement('button');
          btnActivate.className = 'btn';
          btnActivate.innerText = 'Activate Ability';
          btnActivate.style.width = '200px';
          btnActivate.addEventListener('click', () => {
            this.engine.activateCharacterAbility(ownerId, card.instanceId);
            this.closePreviewModal();
          });
          mainActionsRow.appendChild(btnActivate);
        }

        // Item ability activation
        if (card.type === 'Item' && this.engine.canActivateItemAbility(ownerId, card)) {
          const btnActivateItem = document.createElement('button');
          btnActivateItem.className = 'btn';
          btnActivateItem.innerText = 'Activate Ability';
          btnActivateItem.style.width = '200px';
          btnActivateItem.addEventListener('click', () => {
            this.engine.activateItemAbility(ownerId, card.instanceId);
            this.closePreviewModal();
          });
          mainActionsRow.appendChild(btnActivateItem);
        }

        // Adventure solve/work-on
        if (card.type === 'Adventure' && this.engine.canSolveAdventure(ownerId, card)) {
          const btnSolve = document.createElement('button');
          btnSolve.className = 'btn';
          const isSkipAdventure = card.name === "Gringotts' Cart Ride" || card.name === "Diagon Alley" || card.name === "Peeves Causes Trouble" || card.name === "Into the Forbidden Forest" || card.name === "Through the Arch";
          btnSolve.innerText = isSkipAdventure ? 'Work on Adventure' : 'Solve Adventure';
          btnSolve.style.width = '200px';
          btnSolve.addEventListener('click', () => {
            this.engine.solveAdventure(ownerId, card.instanceId);
            this.closePreviewModal();
          });
          mainActionsRow.appendChild(btnSolve);
        }
      }

      // Match active work trigger (Muddy Practice)
      if (cardZone === 'field' && this.engine.actionsRemaining > 0 && card.type === 'Match' && card.name === 'Muddy Practice' && activeId === ownerId) {
        const btnWorkMatch = document.createElement('button');
        btnWorkMatch.className = 'btn';
        btnWorkMatch.innerText = 'Discard to Work on Match';
        btnWorkMatch.style.width = '200px';
        btnWorkMatch.addEventListener('click', () => {
          this.engine.workOnMatch(activeId, card.instanceId);
          this.closePreviewModal();
        });
        mainActionsRow.appendChild(btnWorkMatch);
      }

      // Location active ability trigger
      if (cardZone === 'field' && this.engine.actionsRemaining > 0 && card.type === 'Location' && this.engine.canActivateLocationAbility && this.engine.canActivateLocationAbility(activeId, card)) {
        const btnActivateLocation = document.createElement('button');
        btnActivateLocation.className = 'btn';
        btnActivateLocation.innerText = 'Activate Ability';
        btnActivateLocation.style.width = '200px';
        btnActivateLocation.addEventListener('click', () => {
          this.engine.activateLocationAbility(activeId, card.instanceId);
          this.closePreviewModal();
        });
        mainActionsRow.appendChild(btnActivateLocation);
      }

      if (this.engine.isDebugMode && cardOwner && cardZone) {
        const debugContainer = document.createElement('div');
        debugContainer.style.display = 'flex';
        debugContainer.style.flexDirection = 'column';
        debugContainer.style.alignItems = 'center';
        debugContainer.style.gap = '8px';
        debugContainer.style.width = '100%';
        debugContainer.style.borderTop = '1px dashed var(--border-color)';
        debugContainer.style.paddingTop = '12px';
        debugContainer.style.marginTop = '12px';
 
        const debugLabel = document.createElement('div');
        let labelText = `Debug Move (${cardOwner}'s ${cardZone}):`;
        if (cardZone === 'field' && card.type === 'Creature') {
          const targetPlayer = this.engine.players[cardOwner];
          const creature = targetPlayer.creatures.find(c => c.instanceId === card.instanceId);
          if (creature) {
            const maxHealth = this.engine.getCreatureHealth ? this.engine.getCreatureHealth(creature) : creature.health;
            labelText += ` [Health: ${maxHealth - (creature.damage || 0)}/${maxHealth}]`;
          }
        }
        debugLabel.innerText = labelText;
        debugLabel.style.color = '#ff4d4d';
        debugLabel.style.fontSize = '0.8rem';
        debugLabel.style.fontWeight = 'bold';
        debugContainer.appendChild(debugLabel);

        // Own target row
        const ownLabel = document.createElement('div');
        ownLabel.innerText = "To Own:";
        ownLabel.style.color = 'var(--text-secondary)';
        ownLabel.style.fontSize = '0.75rem';
        debugContainer.appendChild(ownLabel);

        const ownButtonsRow = document.createElement('div');
        ownButtonsRow.style.display = 'flex';
        ownButtonsRow.style.gap = '8px';
        ownButtonsRow.style.justifyContent = 'center';
        ownButtonsRow.style.flexWrap = 'wrap';
        ownButtonsRow.style.width = '100%';
        debugContainer.appendChild(ownButtonsRow);

        const addDebugMoveButton = (label, targetZone, containerRow) => {
          const btn = document.createElement('button');
          btn.className = 'btn btn-secondary';
          btn.style.borderColor = '#ff4d4d';
          btn.innerText = label;
          btn.style.fontSize = '0.85rem';
          btn.style.padding = '6px 12px';
          btn.addEventListener('click', () => {
            this.engine.debugMoveCard(cardOwner, card.instanceId, cardZone, targetZone);
            this.closePreviewModal();
          });
          containerRow.appendChild(btn);
        };

        // Populate Own target buttons
        if (cardZone !== 'field') addDebugMoveButton('Field', 'field', ownButtonsRow);
        if (cardZone !== 'hand') addDebugMoveButton('Hand', 'hand', ownButtonsRow);
        if (cardZone !== 'deck') addDebugMoveButton('Deck', 'deck', ownButtonsRow);
        if (cardZone !== 'discard') addDebugMoveButton('Discard', 'discard', ownButtonsRow);

        if (cardZone === 'field' && card.type === 'Adventure') {
          const btnInstSolve = document.createElement('button');
          btnInstSolve.className = 'btn btn-secondary';
          btnInstSolve.style.borderColor = '#ff4d4d';
          btnInstSolve.innerText = 'Instantly Solve';
          btnInstSolve.style.fontSize = '0.85rem';
          btnInstSolve.style.padding = '6px 12px';
          btnInstSolve.addEventListener('click', () => {
            this.engine.debugSolveAdventure(cardOwner, card.instanceId);
            this.closePreviewModal();
          });
          ownButtonsRow.appendChild(btnInstSolve);
        }

        if (card.type === 'Match') {
          const btnInstWinPlayer = document.createElement('button');
          btnInstWinPlayer.className = 'btn btn-secondary';
          btnInstWinPlayer.style.borderColor = '#ff4d4d';
          btnInstWinPlayer.innerText = 'Instantly Win (You)';
          btnInstWinPlayer.style.fontSize = '0.85rem';
          btnInstWinPlayer.style.padding = '6px 12px';
          btnInstWinPlayer.addEventListener('click', () => {
            this.engine.debugWinMatch('player', card.instanceId);
            this.closePreviewModal();
          });
          ownButtonsRow.appendChild(btnInstWinPlayer);

          const btnInstWinOpp = document.createElement('button');
          btnInstWinOpp.className = 'btn btn-secondary';
          btnInstWinOpp.style.borderColor = '#ff4d4d';
          btnInstWinOpp.innerText = 'Instantly Win (Rival)';
          btnInstWinOpp.style.fontSize = '0.85rem';
          btnInstWinOpp.style.padding = '6px 12px';
          btnInstWinOpp.addEventListener('click', () => {
            this.engine.debugWinMatch('opponent', card.instanceId);
            this.closePreviewModal();
          });
          ownButtonsRow.appendChild(btnInstWinOpp);
        }

        if (cardZone === 'field' && card.type === 'Creature') {
          const btnDeductHealth = document.createElement('button');
          btnDeductHealth.className = 'btn btn-secondary';
          btnDeductHealth.style.borderColor = '#ff4d4d';
          btnDeductHealth.innerText = 'Deduct 1 Health';
          btnDeductHealth.style.fontSize = '0.85rem';
          btnDeductHealth.style.padding = '6px 12px';
          btnDeductHealth.addEventListener('click', () => {
            this.engine.damageCreature(cardOwner, card.instanceId, 1);
            const targetPlayer = this.engine.players[cardOwner];
            const stillInPlay = targetPlayer.creatures.some(c => c.instanceId === card.instanceId);
            if (stillInPlay) {
              this.showPreviewModal(card, isPlayable, cardEl);
            } else {
              this.closePreviewModal();
            }
          });
          ownButtonsRow.appendChild(btnDeductHealth);
        }

        // Opponent target row
        const oppLabel = document.createElement('div');
        oppLabel.innerText = "To Opponent's:";
        oppLabel.style.color = 'var(--text-secondary)';
        oppLabel.style.fontSize = '0.75rem';
        debugContainer.appendChild(oppLabel);

        const oppButtonsRow = document.createElement('div');
        oppButtonsRow.style.display = 'flex';
        oppButtonsRow.style.gap = '8px';
        oppButtonsRow.style.justifyContent = 'center';
        oppButtonsRow.style.flexWrap = 'wrap';
        oppButtonsRow.style.width = '100%';
        debugContainer.appendChild(oppButtonsRow);

        // Populate Opponent target buttons (always show all 4)
        addDebugMoveButton('Field', 'opp_field', oppButtonsRow);
        addDebugMoveButton('Hand', 'opp_hand', oppButtonsRow);
        addDebugMoveButton('Deck', 'opp_deck', oppButtonsRow);
        addDebugMoveButton('Discard', 'opp_discard', oppButtonsRow);

        this.el.modalActions.appendChild(debugContainer);
      }
    }

    this.el.cardPreviewModal.showModal();
  }

  closePreviewModal() {
    if (this.el.cardPreviewModal) {
      this.el.cardPreviewModal.close();
    }
  }

  showPlayErrorModal(message) {
    if (this.el.playErrorModal && this.el.playErrorMessage) {
      this.el.playErrorMessage.innerText = message;
      this.el.playErrorModal.showModal();
    }
  }

  closePlayErrorModal() {
    if (this.el.playErrorModal) {
      this.el.playErrorModal.close();
    }
  }

  showAdventureSolvedModal(adventure, rewardDescription, solverId) {
    if (this.el.adventureSolvedModal && this.el.adventureSolvedTitle && this.el.adventureSolvedSubtitle && this.el.adventureSolvedImage && this.el.adventureSolvedName && this.el.adventureSolvedReward) {
      if (solverId === 'player') {
        this.el.adventureSolvedTitle.innerText = "Adventure Solved!";
        this.el.adventureSolvedSubtitle.innerText = "You solved:";
      } else {
        this.el.adventureSolvedTitle.innerText = "Rival Solved Adventure!";
        this.el.adventureSolvedSubtitle.innerText = "Your rival solved:";
      }
      this.el.adventureSolvedImage.src = adventure.image || '';
      this.el.adventureSolvedImage.alt = adventure.name;
      this.el.adventureSolvedImage.style.transform = 'none';
      this.el.adventureSolvedImage.style.margin = '0';
      this.el.adventureSolvedName.innerText = adventure.name;
      this.el.adventureSolvedReward.innerText = rewardDescription;
      this.el.adventureSolvedModal.showModal();
    }
  }

  closeAdventureSolvedModal() {
    if (this.el.adventureSolvedModal) {
      this.el.adventureSolvedModal.close();
    }
  }

  showMatchWonModal(winnerId, matchCard) {
    if (this.el.matchWonModal) {
      const winnerName = this.engine.players[winnerId].name;
      if (winnerId === 'player') {
        this.el.matchWonTitle.innerText = "Match Won!";
        this.el.matchWonSubtitle.innerText = "You won the Match!";
      } else {
        this.el.matchWonTitle.innerText = "Rival Won Match!";
        this.el.matchWonSubtitle.innerText = "Your rival won the Match!";
      }
      this.el.matchWonImage.src = matchCard.image || '';
      this.el.matchWonImage.alt = matchCard.name;
      this.el.matchWonName.innerText = matchCard.name;
      this.el.matchWonPrize.innerText = matchCard.prize || 'No prize specified';
      this.el.matchWonModal.showModal();
    }
  }

  closeMatchWonModal() {
    if (this.el.matchWonModal) {
      this.el.matchWonModal.close();
    }
  }

  showActionErrorModal(message) {
    if (this.el.actionErrorModal && this.el.actionErrorMessage) {
      this.el.actionErrorMessage.innerText = message;
      this.el.actionErrorModal.showModal();
    }
  }

  closeActionErrorModal() {
    if (this.el.actionErrorModal) {
      this.el.actionErrorModal.close();
    }
  }

  showSpellCastZoom(card, playerId) {
    const modal = this.el.spellCastModal;
    const img = this.el.spellCastImage;
    const nameText = this.el.spellCastName;

    if (!modal || !img || !nameText) return;

    img.src = card.image || '';
    img.alt = card.name;
    nameText.innerText = card.name;

    const banner = modal.querySelector('.spell-cast-banner');
    if (banner) {
      if (playerId === 'player') {
        banner.innerText = 'You Cast a Spell!';
        banner.style.textShadow = '0 0 10px rgba(79, 172, 254, 0.8), 0 0 20px rgba(79, 172, 254, 0.5)';
      } else {
        banner.innerText = 'Rival Casts a Spell!';
        banner.style.textShadow = '0 0 10px rgba(255, 8, 68, 0.8), 0 0 20px rgba(255, 8, 68, 0.5)';
      }
    }

    modal.showModal();

    setTimeout(() => {
      modal.close();
    }, 2000);
  }

  showDiscardViewer(playerId, isUpdateOnly = false) {
    const player = this.engine.players[playerId];
    if (!player || !this.el.discardViewerModal || !this.el.discardViewerGrid || !this.el.discardViewerTitle) return;

    this.activeViewerPlayerId = playerId;
    this.el.discardViewerTitle.innerText = `${player.name === 'You' ? 'Your' : player.name + "'s"} Discard Pile (${player.discardPile.length})`;
    this.el.discardViewerGrid.innerHTML = '';

    if (player.discardPile.length === 0) {
      this.el.discardViewerGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;">The discard pile is empty.</div>`;
    } else {
      player.discardPile.forEach(card => {
        const cardEl = this.createCardElement(card, false);
        cardEl.classList.remove('card-horizontal');
        cardEl.style.transform = 'none';
        cardEl.style.margin = '0';
        
        cardEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showPreviewModal(card, false, cardEl);
        });
        
        this.el.discardViewerGrid.appendChild(cardEl);
      });
    }

    if (!isUpdateOnly) {
      this.el.discardViewerModal.showModal();
    }
  }

  closeDiscardViewer() {
    if (this.el.discardViewerModal) {
      this.el.discardViewerModal.close();
    }
  }

  showDeckViewer(playerId, isUpdateOnly = false) {
    const player = this.engine.players[playerId];
    if (!player || !this.el.deckViewerModal || !this.el.deckViewerGrid || !this.el.deckViewerTitle) return;

    this.activeViewerPlayerId = playerId;
    this.el.deckViewerTitle.innerText = `${player.name === 'You' ? 'Your' : player.name + "'s"} Deck (${player.deck.length})`;
    this.el.deckViewerGrid.innerHTML = '';

    if (player.deck.length === 0) {
      this.el.deckViewerGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;">The deck is empty.</div>`;
    } else {
      // Reverse deck array to display top cards first
      const deckCards = [...player.deck].reverse();
      deckCards.forEach(card => {
        const cardEl = this.createCardElement(card, false);
        cardEl.classList.remove('card-horizontal');
        cardEl.style.transform = 'none';
        cardEl.style.margin = '0';
        
        cardEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showPreviewModal(card, false, cardEl);
        });
        
        this.el.deckViewerGrid.appendChild(cardEl);
      });
    }

    if (!isUpdateOnly) {
      this.el.deckViewerModal.showModal();
    }
  }

  closeDeckViewer() {
    if (this.el.deckViewerModal) {
      this.el.deckViewerModal.close();
    }
  }

  showGameOverModal(message) {
    if (!this.el.gameOverModal) return;

    let localizedMessage = message;
    if (this.engine.winnerId) {
      if (this.engine.winnerId === 'player') {
        if (message.includes('ran out of cards')) {
          localizedMessage = 'Opponent ran out of cards! You win!';
        } else if (message.includes('Golden Snitch')) {
          if (message.includes('10+ more cards')) {
            localizedMessage = 'Golden Snitch: You win because your deck has 10+ more cards!';
          } else {
            localizedMessage = 'Golden Snitch: You win the game!';
          }
        } else {
          localizedMessage = 'You Win!';
        }
      } else if (this.engine.winnerId === 'opponent') {
        const oppName = this.engine.players.opponent.name || 'Hogwarts Rival';
        if (message.includes('ran out of cards')) {
          localizedMessage = `You ran out of cards! ${oppName} wins!`;
        } else if (message.includes('Golden Snitch')) {
          if (message.includes('10+ more cards')) {
            localizedMessage = `Golden Snitch: ${oppName} wins because their deck has 10+ more cards!`;
          } else {
            localizedMessage = `Golden Snitch: ${oppName} wins the game!`;
          }
        } else {
          localizedMessage = `${oppName} Wins!`;
        }
      } else if (this.engine.winnerId === 'tie') {
        localizedMessage = 'Both players ran out of cards! It is a Tie!';
      }
    }

    if (this.el.gameOverMessage) {
      this.el.gameOverMessage.innerText = localizedMessage;
    }
    if (!this.el.gameOverModal.open) {
      this.el.gameOverModal.showModal();
    }
  }

  closeGameOverModal() {
    if (this.el.gameOverModal && this.el.gameOverModal.open) {
      this.el.gameOverModal.close();
    }
  }

  showSpellTargetingModal(pendingSpell) {
    if (!this.el.spellTargetingModal || !this.el.spellTargetingOptions || !this.el.spellTargetingDesc) return;
    
    this.spellSelectionSequence = [];
    this.el.spellTargetingTitle.innerText = pendingSpell.card?.name || pendingSpell.title || "Choices Required";
    this.el.spellTargetingDesc.innerText = pendingSpell.card ? (pendingSpell.title || "Choose target:") : "Choose options:";
    this.el.spellTargetingOptions.innerHTML = '';
    
    const maxChoices = pendingSpell.maxChoices !== undefined ? pendingSpell.maxChoices : 1;
    const minChoices = pendingSpell.minChoices !== undefined ? pendingSpell.minChoices : 1;
    
    if (maxChoices > 1 || minChoices === 0) {
      if (this.el.spellTargetingActions) this.el.spellTargetingActions.style.display = 'flex';
      if (this.el.btnSpellCancel) {
        // Only show Cancel button if there is a card to refund
        this.el.btnSpellCancel.style.display = pendingSpell.card ? 'block' : 'none';
      }
    } else {
      if (this.el.spellTargetingActions) this.el.spellTargetingActions.style.display = 'none';
    }
    
    pendingSpell.choices.forEach(choice => {
      let choiceEl;
      let displayEl;
      if (choice.card) {
        const cardWrapper = document.createElement('div');
        cardWrapper.style.display = 'flex';
        cardWrapper.style.flexDirection = 'column';
        cardWrapper.style.alignItems = 'center';
        cardWrapper.style.gap = '8px';
        cardWrapper.style.cursor = 'pointer';
        cardWrapper.style.transition = 'transform 0.2s ease';
        cardWrapper.style.position = 'relative';
        
        const seqBadge = document.createElement('div');
        seqBadge.className = 'selection-sequence-badge';
        seqBadge.style.position = 'absolute';
        seqBadge.style.top = '6px';
        seqBadge.style.left = '6px';
        seqBadge.style.background = 'var(--accent-gold, #ffd700)';
        seqBadge.style.color = '#0c0e12';
        seqBadge.style.width = '24px';
        seqBadge.style.height = '24px';
        seqBadge.style.borderRadius = '50%';
        seqBadge.style.display = 'none';
        seqBadge.style.alignItems = 'center';
        seqBadge.style.justifyContent = 'center';
        seqBadge.style.fontWeight = 'bold';
        seqBadge.style.fontSize = '0.8rem';
        seqBadge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5)';
        seqBadge.style.zIndex = '10';
        seqBadge.style.border = '1px solid #0c0e12';
        cardWrapper.appendChild(seqBadge);
        
        choiceEl = this.createCardElement(choice.card, false);
        choiceEl.style.transform = 'none';
        choiceEl.style.margin = '0';
        
        cardWrapper.appendChild(choiceEl);
        
        let labelEl;
        const isCreatureInPlay = choice.id.includes('creature-');
        if (isCreatureInPlay) {
          labelEl = document.createElement('div');
          labelEl.className = 'creature-owner-label';
          
          const isPlayer = choice.id.includes(this.engine.players.player.id);
          let labelText = isPlayer ? 'Your Creature' : "Opponent's Creature";
          
          if (choice.label && choice.label.includes('Damage)')) {
            const dmgMatch = choice.label.match(/-\s*([^)]+Damage)/);
            if (dmgMatch) {
              labelText += ` (${dmgMatch[1]})`;
            }
          }
          
          labelEl.innerText = labelText;
          labelEl.style.fontSize = '0.75rem';
          labelEl.style.color = isPlayer ? 'var(--accent-gold, #ffd700)' : '#ff6b6b';
          labelEl.style.fontWeight = '600';
          labelEl.style.background = 'rgba(12, 14, 18, 0.85)';
          labelEl.style.border = `1px solid ${isPlayer ? 'rgba(255, 215, 0, 0.35)' : 'rgba(255, 107, 107, 0.35)'}`;
          labelEl.style.borderRadius = '6px';
          labelEl.style.padding = '4px 10px';
          labelEl.style.whiteSpace = 'nowrap';
          labelEl.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
          labelEl.style.pointerEvents = 'none';
          
          cardWrapper.appendChild(labelEl);
        }
        
        displayEl = cardWrapper;
        
        cardWrapper.addEventListener('mouseenter', () => {
          cardWrapper.style.transform = 'translateY(-4px) scale(1.03)';
          if (isCreatureInPlay && labelEl) {
            const isPlayer = choice.id.includes(this.engine.players.player.id);
            labelEl.style.border = `1px solid ${isPlayer ? 'var(--accent-gold, #ffd700)' : '#ff4d4d'}`;
            labelEl.style.boxShadow = `0 0 10px ${isPlayer ? 'rgba(255, 215, 0, 0.25)' : 'rgba(255, 107, 107, 0.25)'}`;
          }
        });
        cardWrapper.addEventListener('mouseleave', () => {
          cardWrapper.style.transform = 'none';
          if (isCreatureInPlay && labelEl) {
            const isPlayer = choice.id.includes(this.engine.players.player.id);
            labelEl.style.border = `1px solid ${isPlayer ? 'rgba(255, 215, 0, 0.35)' : 'rgba(255, 107, 107, 0.35)'}`;
            labelEl.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
          }
        });
      } else {
        choiceEl = document.createElement('button');
        choiceEl.className = 'spell-target-btn';
        choiceEl.innerText = choice.label;
        displayEl = choiceEl;
      }
      
      choiceEl.setAttribute('data-choice-id', choice.id);
      
      if (choice.disabled) {
        displayEl.style.opacity = '0.5';
        displayEl.style.pointerEvents = 'none';
      } else {
        displayEl.addEventListener('click', () => {
          if (maxChoices === 1 && minChoices === 1) {
            this.engine.resolvePendingSpell([choice.id]);
          } else {
            if (choiceEl.classList.contains('selected')) {
              choiceEl.classList.remove('selected');
              displayEl.classList.remove('selected');
              this.spellSelectionSequence = this.spellSelectionSequence.filter(id => id !== choice.id);
            } else {
              const selectedCount = this.spellSelectionSequence.length;
              if (selectedCount < maxChoices) {
                choiceEl.classList.add('selected');
                displayEl.classList.add('selected');
                this.spellSelectionSequence.push(choice.id);
              } else if (maxChoices === 1) {
                this.el.spellTargetingOptions.querySelectorAll('.selected').forEach(el => {
                  el.classList.remove('selected');
                });
                this.spellSelectionSequence = [];
                choiceEl.classList.add('selected');
                displayEl.classList.add('selected');
                this.spellSelectionSequence.push(choice.id);
              }
            }
            this.updateSpellSelectionBadges();
          }
        });
      }
      
      this.el.spellTargetingOptions.appendChild(displayEl);
    });

    // For optional selections, append a beautifully styled "Choose None / Skip" button
    if (minChoices === 0) {
      const noneEl = document.createElement('button');
      noneEl.className = 'spell-target-btn none-btn';
      noneEl.innerText = 'Choose None / Skip';
      noneEl.style.backgroundColor = 'rgba(220, 53, 69, 0.15)';
      noneEl.style.color = '#ff6b6b';
      noneEl.style.border = '1px solid rgba(220, 53, 69, 0.4)';
      noneEl.style.borderRadius = '8px';
      noneEl.style.padding = '10px 20px';
      noneEl.style.cursor = 'pointer';
      noneEl.style.transition = 'all 0.2s ease';
      
      noneEl.addEventListener('mouseenter', () => {
        noneEl.style.backgroundColor = 'rgba(220, 53, 69, 0.35)';
        noneEl.style.borderColor = '#ff4d4d';
        noneEl.style.transform = 'scale(1.02)';
      });
      noneEl.addEventListener('mouseleave', () => {
        noneEl.style.backgroundColor = 'rgba(220, 53, 69, 0.15)';
        noneEl.style.borderColor = 'rgba(220, 53, 69, 0.4)';
        noneEl.style.transform = 'none';
      });
      
      noneEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.engine.resolvePendingSpell([]);
      });
      
      this.el.spellTargetingOptions.appendChild(noneEl);
    }
    
    if (!this.el.spellTargetingModal.open) {
      this.el.spellTargetingModal.showModal();
    }
  }

  closeSpellTargetingModal() {
    if (this.el.spellTargetingModal && this.el.spellTargetingModal.open) {
      this.el.spellTargetingModal.close();
    }
  }

  updateSpellSelectionBadges() {
    if (!this.el.spellTargetingOptions) return;
    const optionContainers = this.el.spellTargetingOptions.children;
    Array.from(optionContainers).forEach(container => {
      const choiceId = container.querySelector('[data-choice-id]')?.getAttribute('data-choice-id') || container.getAttribute('data-choice-id');
      const badge = container.querySelector('.selection-sequence-badge');
      if (badge && choiceId) {
        const index = this.spellSelectionSequence.indexOf(choiceId);
        if (index !== -1) {
          badge.innerText = index + 1;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }
    });
  }
}
