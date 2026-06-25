/**
 * Harry Potter TCG - UI Manager
 * Handles DOM rendering, card template generation, animations, and event bindings.
 */

export class UIManager {
  constructor(engine) {
    this.engine = engine;
    this.selectedCardId = null;

    // Cache DOM Elements
    this.el = {
      playerHand: document.getElementById('hand-area'),
      playerLessons: document.getElementById('player-lessons-zone'),
      playerCreatures: document.getElementById('player-creatures-zone'),
      playerPermanents: document.getElementById('player-permanents-zone'),
      playerCharacter: document.getElementById('player-character-zone'),
      
      opponentLessons: document.getElementById('opponent-lessons-zone'),
      opponentCreatures: document.getElementById('opponent-creatures-zone'),
      opponentPermanents: document.getElementById('opponent-permanents-zone'),
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
      spellCastName: document.getElementById('spell-cast-name')
    };

    // Listen for spell play events
    this.engine.onSpellPlayed((card, playerId) => {
      this.showSpellCastZoom(card, playerId);
    });

    this.bindGlobalEvents();
  }

  // Bind top level controls
  bindGlobalEvents() {
    if (this.el.btnDraw) {
      this.el.btnDraw.addEventListener('click', () => {
        this.engine.drawCard('player', true);
      });
    }

    if (this.el.btnEndTurn) {
      this.el.btnEndTurn.addEventListener('click', () => {
        // If it's the player's turn, end it.
        if (this.engine.activePlayerId === 'player') {
          this.engine.endTurn();
          
          // Simple AI Opponent Simulation for local play:
          // Wait 1.5s, then let opponent run their turn automatically.
          setTimeout(() => this.runOpponentTurnSimulation(), 1200);
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
        const selectedEls = this.el.spellTargetingOptions.querySelectorAll('.selected');
        const selectedIds = Array.from(selectedEls).map(el => el.getAttribute('data-choice-id'));
        this.engine.resolvePendingSpell(selectedIds);
        this.closeSpellTargetingModal();
      });
    }

    if (this.el.btnSpellCancel) {
      this.el.btnSpellCancel.addEventListener('click', () => {
        const pending = this.engine.pendingSpell;
        if (pending && pending.casterId === 'player') {
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
  }

  // Very simple opponent play script to keep offline local play interactive
  runOpponentTurnSimulation() {
    if (this.engine.activePlayerId !== 'opponent') return;

    this.engine.log("--- Rival is planning actions... ---", "turn");
    
    // AI Loop: Try to play cards in hand or draw
    const opponent = this.engine.players.opponent;
    let actionsMade = 0;

    // Helper to evaluate and play
    const tryPlayAI = () => {
      if (this.engine.actionsRemaining <= 0 || this.engine.activePlayerId !== 'opponent') {
        // No actions, end turn
        setTimeout(() => this.engine.endTurn(), 800);
        return;
      }

      // 1. Look for a Lesson to play first
      const lesson = opponent.hand.find(c => c.type === 'Lesson');
      if (lesson) {
        this.engine.playCard('opponent', lesson.instanceId);
        setTimeout(tryPlayAI, 800);
        return;
      }

      // 2. Try to play other cards if requirements are met
      const playable = opponent.hand.find(card => {
        if (!card.lessonCost) return true;
        const { counts, total } = opponent.lessonCounts;
        return total >= card.lessonCost.total && counts[card.lessonCost.type] >= 1;
      });

      if (playable) {
        const isSpell = playable.type === 'Spell';
        this.engine.playCard('opponent', playable.instanceId);
        setTimeout(tryPlayAI, isSpell ? 3000 : 800);
        return;
      }

      // 3. Otherwise draw a card
      this.engine.drawCard('opponent', true);
      setTimeout(tryPlayAI, 800);
    };

    setTimeout(tryPlayAI, 800);
  }

  // Main Render Loop
  render() {
    const player = this.engine.players.player;
    const opponent = this.engine.players.opponent;

    if (!player || !opponent) return;

    // Render Hands
    this.renderHand(this.el.playerHand, player.hand, true);
    this.renderOpponentHand();
    
    // Render Board Zones
    this.renderZone(this.el.playerCharacter, player.characters);
    this.renderZone(this.el.playerLessons, player.lessons);
    this.renderZone(this.el.playerCreatures, player.creatures);
    this.renderZone(this.el.playerPermanents, [...player.items, ...player.adventures]);
    
    this.renderZone(this.el.opponentCharacter, opponent.characters);
    this.renderZone(this.el.opponentLessons, opponent.lessons);
    this.renderZone(this.el.opponentCreatures, opponent.creatures);
    this.renderZone(this.el.opponentPermanents, [...opponent.items, ...opponent.adventures]);

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
  }

  // Render hand cards
  renderHand(container, hand, isInteractive) {
    if (!container) return;
    container.innerHTML = '';

    hand.forEach(card => {
      const cardEl = this.createCardElement(card, isInteractive);
      if (isInteractive) {
        // Single click to preview modal (with play button)
        cardEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showPreviewModal(card, true, cardEl);
        });
        // Double click to play immediately
        cardEl.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.engine.playCard('player', card.instanceId);
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
    const revealOpponentHand = hasMrsNorris || opponent.revealHandRestOfGame || opponent.adventures.some(a => a.name === 'Meet the Centaurs');
    
    opponent.hand.forEach(card => {
      const cardEl = this.createCardElement(card, false, !revealOpponentHand);
      // If hand is revealed, clicking allows viewing the card preview modal (non-interactive)
      if (revealOpponentHand) {
        cardEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showPreviewModal(card, false, cardEl);
        });
      }
      container.appendChild(cardEl);
    });
  }

  // Render cards in board zones
  renderZone(container, cards) {
    if (!container) return;
    
    // Retain the zone-label if present
    const label = container.querySelector('.zone-label');
    container.innerHTML = '';
    if (label) container.appendChild(label);

    cards.forEach(card => {
      const cardEl = this.createCardElement(card, false);
      // Single click to preview modal
      cardEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showPreviewModal(card, false, cardEl);
      });
      container.appendChild(cardEl);
    });
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

    if (card.type === 'Adventure') {
      el.classList.add('card-horizontal');
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

    this.el.modalCardImage.src = card.image || '';
    this.el.modalCardImage.alt = card.name || 'Card Preview';

    // Determine orientation based on card type or field state
    let isHorizontal = false;
    if (card.type === 'Lesson' || card.type === 'Adventure' || card.type === 'Character') {
      isHorizontal = true;
    }
    if (cardEl) {
      const isOpponentMat = cardEl.closest('#opponent-playmat') || cardEl.closest('#opponent-character-zone');
      const isPlayerMat = cardEl.closest('#player-playmat') || cardEl.closest('#player-character-zone');
      const isHorizontalInHand = cardEl.classList.contains('card-horizontal');
      if (isOpponentMat || isPlayerMat || isHorizontalInHand) {
        isHorizontal = true;
      }
    }

    let rotation = isHorizontal ? 90 : 0;

    // Apply rotation transforms
    this.el.modalCardImage.style.transform = rotation ? `rotate(${rotation}deg)` : 'none';
    if (rotation !== 0) {
      // Swapping horizontal dimensions requires layout margin
      this.el.modalCardImage.style.margin = '40px 0';
    } else {
      this.el.modalCardImage.style.margin = '0';
    }

    if (this.el.modalActions) {
      this.el.modalActions.innerHTML = '';
      if (isPlayable && this.engine.activePlayerId === 'player' && this.engine.actionsRemaining > 0) {
        const btnPlay = document.createElement('button');
        btnPlay.className = 'btn';
        btnPlay.innerText = 'Play Card';
        btnPlay.style.width = '200px';
        btnPlay.addEventListener('click', () => {
          this.engine.playCard('player', card.instanceId);
          this.closePreviewModal();
        });
        this.el.modalActions.appendChild(btnPlay);
      }
      
      const isInPlayerCharacters = this.engine.players.player.characters.some(c => c.instanceId === card.instanceId);
      if (isInPlayerCharacters && this.engine.canActivateCharacterAbility('player', card)) {
        const btnActivate = document.createElement('button');
        btnActivate.className = 'btn';
        btnActivate.innerText = 'Activate Ability';
        btnActivate.style.width = '200px';
        btnActivate.addEventListener('click', () => {
          this.engine.activateCharacterAbility('player', card.instanceId);
          this.closePreviewModal();
        });
        this.el.modalActions.appendChild(btnActivate);
      }

      // Check for Item activated abilities
      const isInPlayerItems = this.engine.players.player.items.some(i => i.instanceId === card.instanceId);
      if (isInPlayerItems && this.engine.canActivateItemAbility('player', card)) {
        const btnActivateItem = document.createElement('button');
        btnActivateItem.className = 'btn';
        btnActivateItem.innerText = 'Activate Ability';
        btnActivateItem.style.width = '200px';
        btnActivateItem.addEventListener('click', () => {
          this.engine.activateItemAbility('player', card.instanceId);
          this.closePreviewModal();
        });
        this.el.modalActions.appendChild(btnActivateItem);
      }

      // Check for Adventure solve/work-on
      const isInPlayerAdventures = this.engine.players.player.adventures.some(a => a.instanceId === card.instanceId);
      if (isInPlayerAdventures && this.engine.canSolveAdventure('player', card)) {
        const btnSolve = document.createElement('button');
        btnSolve.className = 'btn';
        const isSkipAdventure = card.name === "Gringotts' Cart Ride" || card.name === "Diagon Alley" || card.name === "Peeves Causes Trouble";
        btnSolve.innerText = isSkipAdventure ? 'Work on Adventure' : 'Solve Adventure';
        btnSolve.style.width = '200px';
        btnSolve.addEventListener('click', () => {
          this.engine.solveAdventure('player', card.instanceId);
          this.closePreviewModal();
        });
        this.el.modalActions.appendChild(btnSolve);
      }
    }

    this.el.cardPreviewModal.showModal();
  }

  closePreviewModal() {
    if (this.el.cardPreviewModal) {
      this.el.cardPreviewModal.close();
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

  showDiscardViewer(playerId) {
    const player = this.engine.players[playerId];
    if (!player || !this.el.discardViewerModal || !this.el.discardViewerGrid || !this.el.discardViewerTitle) return;

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

    this.el.discardViewerModal.showModal();
  }

  closeDiscardViewer() {
    if (this.el.discardViewerModal) {
      this.el.discardViewerModal.close();
    }
  }

  showGameOverModal(message) {
    if (!this.el.gameOverModal) return;
    if (this.el.gameOverMessage) {
      this.el.gameOverMessage.innerText = message;
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
    
    this.el.spellTargetingTitle.innerText = pendingSpell.card?.name || pendingSpell.title || "Choices Required";
    this.el.spellTargetingDesc.innerText = pendingSpell.card ? (pendingSpell.title || "Choose target:") : "Choose options:";
    this.el.spellTargetingOptions.innerHTML = '';
    
    const maxChoices = pendingSpell.maxChoices || 1;
    const minChoices = pendingSpell.minChoices || 1;
    
    if (maxChoices > 1 || minChoices === 0) {
      if (this.el.spellTargetingActions) this.el.spellTargetingActions.style.display = 'flex';
    } else {
      if (this.el.spellTargetingActions) this.el.spellTargetingActions.style.display = 'none';
    }
    
    pendingSpell.choices.forEach(choice => {
      let choiceEl;
      if (choice.card) {
        choiceEl = this.createCardElement(choice.card, false);
        choiceEl.style.transform = 'none';
        choiceEl.style.margin = '0';
      } else {
        choiceEl = document.createElement('button');
        choiceEl.className = 'spell-target-btn';
        choiceEl.innerText = choice.label;
      }
      choiceEl.setAttribute('data-choice-id', choice.id);
      
      if (choice.disabled) {
        choiceEl.style.opacity = '0.5';
        choiceEl.style.pointerEvents = 'none';
      } else {
        choiceEl.addEventListener('click', () => {
          if (maxChoices === 1 && minChoices === 1) {
            this.engine.resolvePendingSpell([choice.id]);
            this.closeSpellTargetingModal();
          } else {
            if (choiceEl.classList.contains('selected')) {
              choiceEl.classList.remove('selected');
            } else {
              const selectedCount = this.el.spellTargetingOptions.querySelectorAll('.selected').length;
              if (selectedCount < maxChoices) {
                choiceEl.classList.add('selected');
              } else if (maxChoices === 1) {
                this.el.spellTargetingOptions.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
                choiceEl.classList.add('selected');
              }
            }
          }
        });
      }
      
      this.el.spellTargetingOptions.appendChild(choiceEl);
    });
    
    if (!this.el.spellTargetingModal.open) {
      this.el.spellTargetingModal.showModal();
    }
  }

  closeSpellTargetingModal() {
    if (this.el.spellTargetingModal && this.el.spellTargetingModal.open) {
      this.el.spellTargetingModal.close();
    }
  }
}
