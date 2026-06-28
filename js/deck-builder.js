/**
 * Harry Potter TCG - Deck Builder Module
 * Manages custom deck lists, local storage, card catalog browser, and validation rules.
 */

export function validateDeck(deck, cardsDb) {
  const errors = [];
  const cardCounts = {};

  // Check main character
  if (!deck.characterId) {
    errors.push("No starting Character card selected.");
  } else {
    const charCard = cardsDb.find(c => c.id === deck.characterId);
    if (!charCard) {
      errors.push("Invalid starting Character card ID.");
    } else {
      const isWitchOrWizard = charCard.subTypes?.includes("Witch") || charCard.subTypes?.includes("Wizard");
      if (!isWitchOrWizard) {
        errors.push(`Starting character must be a Witch or Wizard. ("${charCard.name}" is not).`);
      }
    }
  }

  // Count cards
  deck.cardIds.forEach(id => {
    const card = cardsDb.find(c => c.id === id);
    if (!card) {
      errors.push(`Invalid card ID: ${id}`);
      return;
    }
    cardCounts[card.name] = (cardCounts[card.name] || 0) + 1;
  });

  const totalCards = deck.cardIds.length;
  if (totalCards !== 60) {
    errors.push(`Deck must have exactly 60 cards (currently has ${totalCards} cards).`);
  }

  // Check copy limits (max 4 copies of any card except Lessons)
  Object.keys(cardCounts).forEach(name => {
    const count = cardCounts[name];
    const firstCard = cardsDb.find(c => c.name === name);
    if (firstCard && firstCard.type !== 'Lesson') {
      if (count > 4) {
        errors.push(`Too many copies of "${name}": max 4 copies (currently has ${count} copies).`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function getPresetDecks(cardsDb) {
  return [];
}

export class DeckBuilder {
  constructor(cardsDb, onBackCallback) {
    this.cardsDb = cardsDb;
    this.onBack = onBackCallback;

    this.decks = [];
    this.currentDeck = null;
    this.activeFilter = 'All';
    this.activeLessonFilter = 'All';
    this.deckCardTypeFilter = 'All';
    this.deckLessonTypeFilter = 'All';
    this.searchQuery = '';

    // Cache elements on construction
    this.el = {
      container: document.getElementById('deck-builder-container'),
      selectDeck: document.getElementById('deck-builder-select'),
      btnNew: document.getElementById('btn-new-deck'),
      btnDelete: document.getElementById('btn-delete-deck'),
      btnClear: document.getElementById('btn-clear-deck'),
      inputName: document.getElementById('deck-name-input'),
      selectChar: document.getElementById('deck-char-select'),
      previewChar: document.getElementById('deck-char-preview-img'),
      statsCount: document.getElementById('deck-stats-count'),
      statsValidity: document.getElementById('deck-stats-validity'),
      validationErrors: document.getElementById('deck-validation-errors'),
      cardsList: document.getElementById('deck-builder-cards-grid'),
      btnSave: document.getElementById('btn-save-deck'),
      btnBack: document.getElementById('btn-deck-builder-back'),
      inputSearch: document.getElementById('card-catalog-search'),
      filterButtons: document.getElementById('card-catalog-filters'),
      catalogGrid: document.getElementById('card-catalog-grid'),
      inputLessonFilter: document.getElementById('card-catalog-lesson-filter'),
      deckCardTypeFilterSelect: document.getElementById('deck-card-type-filter'),
      deckLessonTypeFilterSelect: document.getElementById('deck-lesson-type-filter')
    };

    this.initDecks();
    this.bindEvents();
    this.populateCharactersDropdown();
  }

  // Load custom decks from LocalStorage
  initDecks() {
    const raw = localStorage.getItem('hptcg_custom_decks');
    let loadedDecks = [];
    if (raw) {
      try {
        loadedDecks = JSON.parse(raw);
      } catch (e) {
        console.error("Error reading custom decks from localStorage", e);
      }
    }

    // Filter out old preset decks, keeping only user-created custom decks
    const customDecks = loadedDecks.filter(d => !d.isPreset);
    // Get fresh preset decks
    const presets = getPresetDecks(this.cardsDb);
    // Combine custom decks and presets
    this.decks = [...presets, ...customDecks];
    
    // Save to storage to ensure changes to presets are persisted
    this.saveDecksToStorage();

    if (this.decks.length > 0) {
      this.currentDeck = this.decks[0];
    } else {
      this.createNewDeck("My Custom Deck");
    }
  }

  saveDecksToStorage() {
    localStorage.setItem('hptcg_custom_decks', JSON.stringify(this.decks));
  }

  populateCharactersDropdown() {
    if (!this.el.selectChar) return;
    this.el.selectChar.innerHTML = '';
    
    // Only characters who are Witch or Wizard can be starting characters
    const characters = this.cardsDb.filter(c => 
      c.type === 'Character' && 
      (c.subTypes.includes('Witch') || c.subTypes.includes('Wizard'))
    );
    
    // Deduplicate options by character name to avoid duplicates (e.g., 3 Hermiones/Dracos)
    const seenNames = new Set();
    const uniqueCharacters = [];
    
    characters.forEach(char => {
      if (!seenNames.has(char.name)) {
        seenNames.add(char.name);
        uniqueCharacters.push(char);
      }
    });
    
    uniqueCharacters.forEach(char => {
      const opt = document.createElement('option');
      opt.value = char.id;
      opt.innerText = char.name;
      this.el.selectChar.appendChild(opt);
    });
  }

  bindEvents() {
    // Back to Main Menu
    if (this.el.btnBack) {
      this.el.btnBack.addEventListener('click', () => {
        if (this.onBack) this.onBack();
      });
    }

    // Select Deck to Edit
    if (this.el.selectDeck) {
      this.el.selectDeck.addEventListener('change', (e) => {
        const deck = this.decks.find(d => d.id === e.target.value);
        if (deck) {
          this.currentDeck = deck;
          this.loadCurrentDeckToUI();
        }
      });
    }

    // Create New Deck
    if (this.el.btnNew) {
      this.el.btnNew.addEventListener('click', () => {
        const name = prompt("Enter a name for your new deck:", "New Custom Deck");
        if (name) {
          this.createNewDeck(name);
        }
      });
    }

    // Delete Deck
    if (this.el.btnDelete) {
      this.el.btnDelete.addEventListener('click', () => {
        if (!this.currentDeck) return;
        if (this.currentDeck.isPreset) {
          alert("Preset decks are read-only and cannot be deleted. You can create a new custom deck instead.");
          return;
        }

        if (confirm(`Are you sure you want to delete "${this.currentDeck.name}"?`)) {
          this.decks = this.decks.filter(d => d.id !== this.currentDeck.id);
          this.saveDecksToStorage();
          this.initDecks();
          this.populateDecksDropdown();
          this.loadCurrentDeckToUI();
        }
      });
    }

    // Empty/Clear Deck
    if (this.el.btnClear) {
      this.el.btnClear.addEventListener('click', () => {
        if (!this.currentDeck) return;
        if (this.currentDeck.isPreset) {
          this.cloneCurrentPreset();
        }

        if (confirm(`Are you sure you want to empty all cards in "${this.currentDeck.name}"?`)) {
          this.currentDeck.cardIds = [];
          this.saveDecksToStorage();
          this.loadCurrentDeckToUI();
        }
      });
    }

    // Deck Name Edit Input
    if (this.el.inputName) {
      this.el.inputName.addEventListener('input', (e) => {
        if (this.currentDeck) {
          if (this.currentDeck.isPreset) {
            this.cloneCurrentPreset(e.target.value);
          } else {
            this.currentDeck.name = e.target.value;
            this.updateDeckSelectLabel(this.currentDeck.id, e.target.value);
          }
        }
      });
    }

    // Character Selection
    if (this.el.selectChar) {
      this.el.selectChar.addEventListener('change', (e) => {
        if (this.currentDeck) {
          if (this.currentDeck.isPreset) {
            this.cloneCurrentPreset();
          }
          this.currentDeck.characterId = e.target.value;
          this.updateCharacterPreview();
          this.validateAndRenderStatus();
        }
      });
    }

    // Save Deck
    if (this.el.btnSave) {
      this.el.btnSave.addEventListener('click', () => {
        if (!this.currentDeck) return;
        
        this.saveDecksToStorage();
        this.populateDecksDropdown();
        alert(`Deck "${this.currentDeck.name}" saved successfully!`);
      });
    }

    // Search input catalog
    if (this.el.inputSearch) {
      this.el.inputSearch.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.renderCatalog();
      });
    }

    // Filter tabs
    if (this.el.filterButtons) {
      this.el.filterButtons.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        
        this.el.filterButtons.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        this.activeFilter = btn.getAttribute('data-filter');
        this.renderCatalog();
      });
    }

    // Catalog Lesson Type Filter Select
    if (this.el.inputLessonFilter) {
      this.el.inputLessonFilter.addEventListener('change', (e) => {
        this.activeLessonFilter = e.target.value;
        this.renderCatalog();
      });
    }

    // Deck Card Type Filter Select
    if (this.el.deckCardTypeFilterSelect) {
      this.el.deckCardTypeFilterSelect.addEventListener('change', (e) => {
        this.deckCardTypeFilter = e.target.value;
        this.renderCurrentDeckCards();
      });
    }

    // Deck Lesson Type Filter Select
    if (this.el.deckLessonTypeFilterSelect) {
      this.el.deckLessonTypeFilterSelect.addEventListener('change', (e) => {
        this.deckLessonTypeFilter = e.target.value;
        this.renderCurrentDeckCards();
      });
    }
  }

  // Clone a preset deck when the user makes changes to it
  cloneCurrentPreset(newName = null) {
    const copy = {
      id: `deck-${Date.now()}`,
      name: newName || `Copy of ${this.currentDeck.name}`,
      characterId: this.currentDeck.characterId,
      cardIds: [...this.currentDeck.cardIds]
    };
    this.decks.push(copy);
    this.currentDeck = copy;
    this.saveDecksToStorage();
    this.populateDecksDropdown();
    this.loadCurrentDeckToUI();
  }

  createNewDeck(name) {
    const newDeck = {
      id: `deck-${Date.now()}`,
      name: name,
      characterId: "9", 
      cardIds: []
    };
    this.decks.push(newDeck);
    this.currentDeck = newDeck;
    this.saveDecksToStorage();
    this.populateDecksDropdown();
    this.loadCurrentDeckToUI();
  }

  populateDecksDropdown() {
    if (!this.el.selectDeck) return;
    const currentId = this.currentDeck ? this.currentDeck.id : '';
    this.el.selectDeck.innerHTML = '';
    
    this.decks.forEach(deck => {
      const opt = document.createElement('option');
      opt.value = deck.id;
      opt.innerText = deck.name + (deck.isPreset ? " (Preset)" : "");
      this.el.selectDeck.appendChild(opt);
    });

    this.el.selectDeck.value = currentId;
  }

  updateDeckSelectLabel(id, name) {
    if (!this.el.selectDeck) return;
    const opt = this.el.selectDeck.querySelector(`option[value="${id}"]`);
    if (opt) {
      opt.innerText = name;
    }
  }

  loadCurrentDeckToUI() {
    if (!this.currentDeck) return;

    this.populateDecksDropdown();
    
    if (this.el.inputName) {
      this.el.inputName.value = this.currentDeck.name;
    }

    if (this.el.selectChar) {
      this.el.selectChar.value = this.currentDeck.characterId;
    }

    // Reset filters to All when switching/loading decks
    if (this.el.inputLessonFilter) this.el.inputLessonFilter.value = 'All';
    if (this.el.deckCardTypeFilterSelect) this.el.deckCardTypeFilterSelect.value = 'All';
    if (this.el.deckLessonTypeFilterSelect) this.el.deckLessonTypeFilterSelect.value = 'All';
    this.activeLessonFilter = 'All';
    this.deckCardTypeFilter = 'All';
    this.deckLessonTypeFilter = 'All';

    this.updateCharacterPreview();
    this.validateAndRenderStatus();
    this.renderCurrentDeckCards();
    this.renderCatalog();
  }

  updateCharacterPreview() {
    if (!this.el.previewChar) return;
    const char = this.cardsDb.find(c => c.id === this.currentDeck.characterId);
    if (char && char.image) {
      this.el.previewChar.src = char.image;
      this.el.previewChar.style.display = 'block';
    } else {
      this.el.previewChar.style.display = 'none';
    }
  }

  validateAndRenderStatus() {
    if (!this.currentDeck) return;

    const validation = validateDeck(this.currentDeck, this.cardsDb);
    
    // Render Stats
    if (this.el.statsCount) {
      this.el.statsCount.innerText = this.currentDeck.cardIds.length;
    }

    if (this.el.statsValidity) {
      if (validation.isValid) {
        this.el.statsValidity.innerText = "VALID DECK";
        this.el.statsValidity.className = "validity-indicator valid";
      } else {
        this.el.statsValidity.innerText = "INVALID DECK";
        this.el.statsValidity.className = "validity-indicator invalid";
      }
    }

    // Render error messages
    if (this.el.validationErrors) {
      this.el.validationErrors.innerHTML = '';
      validation.errors.forEach(err => {
        const li = document.createElement('li');
        li.innerText = err;
        this.el.validationErrors.appendChild(li);
      });
    }
  }

  renderCurrentDeckCards() {
    if (!this.el.cardsList || !this.currentDeck) return;
    this.el.cardsList.innerHTML = '';

    // Apply active deck list filters
    const filteredCardIds = this.currentDeck.cardIds.filter(id => {
      const card = this.cardsDb.find(c => c.id === id);
      if (!card) return false;

      // Filter by card type
      if (this.deckCardTypeFilter && this.deckCardTypeFilter !== 'All') {
        if (card.type !== this.deckCardTypeFilter) return false;
      }

      // Filter by lesson type
      if (this.deckLessonTypeFilter && this.deckLessonTypeFilter !== 'All') {
        const cardLessonType = card.type === 'Lesson' ? (card.provides?.type || card.lessonType) : card.lessonCost?.type;
        if (cardLessonType !== this.deckLessonTypeFilter) return false;
      }

      return true;
    });

    // Group cards by name
    const grouped = {};
    filteredCardIds.forEach(id => {
      const card = this.cardsDb.find(c => c.id === id);
      if (card) {
        if (!grouped[card.name]) {
          grouped[card.name] = {
            card,
            count: 0
          };
        }
        grouped[card.name].count++;
      }
    });

    // Sort: Lessons first, then others alphabetically
    const sorted = Object.values(grouped).sort((a, b) => {
      if (a.card.type === 'Lesson' && b.card.type !== 'Lesson') return -1;
      if (a.card.type !== 'Lesson' && b.card.type === 'Lesson') return 1;
      return a.card.name.localeCompare(b.card.name);
    });

    if (sorted.length === 0) {
      const isFiltered = (this.deckCardTypeFilter !== 'All' || this.deckLessonTypeFilter !== 'All');
      const msg = isFiltered
        ? "No cards in deck match the active filters."
        : 'No cards in deck yet. Click "Add to Deck" on the left to add them!';
      this.el.cardsList.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-style: italic; padding: 40px;">${msg}</div>`;
      return;
    }

    sorted.forEach(group => {
      const cardEl = document.createElement('div');
      cardEl.className = 'catalog-card-item';
      
      const thumb = document.createElement('div');
      thumb.className = 'catalog-card-thumbnail';
      thumb.style.cursor = 'pointer';
      thumb.title = 'Click to zoom card';
      if (group.card.image) {
        thumb.style.backgroundImage = `url('${group.card.image}')`;
        thumb.style.backgroundSize = 'cover';
        thumb.style.backgroundPosition = 'center';
      }
      thumb.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showCardZoom(group.card);
      });

      // Badge displays the count of this card in the deck
      const badge = document.createElement('span');
      badge.className = 'catalog-card-badge';
      badge.innerText = `x${group.count}`;
      badge.style.display = 'block';
      thumb.appendChild(badge);

      const info = document.createElement('div');
      info.className = 'catalog-card-info';
      
      const name = document.createElement('div');
      name.className = 'catalog-card-name';
      name.innerText = group.card.name;
      if (group.card.type === 'Lesson') {
        name.style.color = `var(--color-${(group.card.provides?.type || group.card.lessonType || 'charms').toLowerCase().replace(/\s+/g, '-')})`;
      }

      const typeCost = document.createElement('div');
      typeCost.className = 'catalog-card-meta';
      const costText = group.card.lessonCost ? ` (${group.card.lessonCost.total} ${group.card.lessonCost.type})` : '';
      typeCost.innerText = `${group.card.type}${costText}`;

      const desc = document.createElement('div');
      desc.className = 'catalog-card-desc';
      desc.innerText = group.card.text || '';

      // Controls row: - and + buttons to adjust copies
      const btnRow = document.createElement('div');
      btnRow.className = 'deck-card-controls';
      btnRow.style.marginTop = '6px';
      btnRow.style.display = 'flex';
      btnRow.style.gap = '8px';
      btnRow.style.alignSelf = 'flex-start';

      const btnMinus = document.createElement('button');
      btnMinus.className = 'btn btn-icon btn-small';
      btnMinus.innerText = '-';
      btnMinus.style.width = '28px';
      btnMinus.style.height = '28px';
      btnMinus.style.display = 'flex';
      btnMinus.style.alignItems = 'center';
      btnMinus.style.justifyContent = 'center';
      btnMinus.addEventListener('click', () => {
        this.removeCardFromDeck(group.card.id);
      });

      const btnPlus = document.createElement('button');
      btnPlus.className = 'btn btn-icon btn-small';
      btnPlus.innerText = '+';
      btnPlus.style.width = '28px';
      btnPlus.style.height = '28px';
      btnPlus.style.display = 'flex';
      btnPlus.style.alignItems = 'center';
      btnPlus.style.justifyContent = 'center';
      
      if (group.card.type !== 'Lesson' && group.count >= 4) {
        btnPlus.classList.add('disabled');
        btnPlus.disabled = true;
      }
      
      btnPlus.addEventListener('click', () => {
        this.addCardToDeck(group.card.id);
      });

      btnRow.appendChild(btnMinus);
      btnRow.appendChild(btnPlus);

      // Add "+5" button for Lesson cards in deck view
      if (group.card.type === 'Lesson') {
        const btnPlusFive = document.createElement('button');
        btnPlusFive.className = 'btn btn-icon btn-small btn-secondary';
        btnPlusFive.innerText = '+5';
        btnPlusFive.style.width = '36px';
        btnPlusFive.style.height = '28px';
        btnPlusFive.style.display = 'flex';
        btnPlusFive.style.alignItems = 'center';
        btnPlusFive.style.justifyContent = 'center';
        btnPlusFive.addEventListener('click', () => {
          for (let i = 0; i < 5; i++) {
            this.addCardToDeck(group.card.id);
          }
        });
        btnRow.appendChild(btnPlusFive);
      }

      info.appendChild(name);
      info.appendChild(typeCost);
      info.appendChild(desc);
      info.appendChild(btnRow);

      cardEl.appendChild(thumb);
      cardEl.appendChild(info);
      this.el.cardsList.appendChild(cardEl);
    });
  }

  addCardToDeck(cardId) {
    if (!this.currentDeck) return;
    
    if (this.currentDeck.isPreset) {
      this.cloneCurrentPreset();
    }

    const card = this.cardsDb.find(c => c.id === cardId);
    if (!card) return;

    if (card.type !== 'Lesson') {
      const currentCount = this.currentDeck.cardIds.filter(id => id === cardId).length;
      if (currentCount >= 4) {
        alert(`Cannot add more copies of "${card.name}". Maximum of 4 copies allowed for non-Lesson cards!`);
        return;
      }
    }

    this.currentDeck.cardIds.push(cardId);
    this.validateAndRenderStatus();
    this.renderCurrentDeckCards();
    this.renderCatalog();
  }

  removeCardFromDeck(cardId) {
    if (!this.currentDeck) return;

    if (this.currentDeck.isPreset) {
      this.cloneCurrentPreset();
    }

    const index = this.currentDeck.cardIds.indexOf(cardId);
    if (index !== -1) {
      this.currentDeck.cardIds.splice(index, 1);
      this.validateAndRenderStatus();
      this.renderCurrentDeckCards();
      this.renderCatalog();
    }
  }

  renderCatalog() {
    if (!this.el.catalogGrid || !this.currentDeck) return;
    this.el.catalogGrid.innerHTML = '';

    let filtered = this.cardsDb.filter(c => {
      if (this.activeFilter !== 'All' && c.type !== this.activeFilter) {
        return false;
      }
      
      if (this.searchQuery && !c.name.toLowerCase().includes(this.searchQuery)) {
        return false;
      }

      // Apply active lesson type filter
      if (this.activeLessonFilter && this.activeLessonFilter !== 'All') {
        const cardLessonType = c.type === 'Lesson' ? (c.provides?.type || c.lessonType) : c.lessonCost?.type;
        if (cardLessonType !== this.activeLessonFilter) {
          return false;
        }
      }

      return true;
    });

    filtered.sort((a, b) => a.name.localeCompare(b.name));

    if (filtered.length === 0) {
      this.el.catalogGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-style: italic; padding: 40px;">No cards found matching filters.</div>`;
      return;
    }

    filtered.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = 'catalog-card-item';
      
      const thumb = document.createElement('div');
      thumb.className = 'catalog-card-thumbnail';
      thumb.style.cursor = 'pointer';
      thumb.title = 'Click to zoom card';
      if (card.image) {
        thumb.style.backgroundImage = `url('${card.image}')`;
        thumb.style.backgroundSize = 'cover';
        thumb.style.backgroundPosition = 'center';
      }
      thumb.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showCardZoom(card);
      });

      const countInDeck = this.currentDeck.cardIds.filter(id => id === card.id).length;
      
      const badge = document.createElement('span');
      badge.className = 'catalog-card-badge';
      badge.innerText = `x${countInDeck}`;
      if (countInDeck > 0) {
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
      thumb.appendChild(badge);

      const info = document.createElement('div');
      info.className = 'catalog-card-info';
      
      const name = document.createElement('div');
      name.className = 'catalog-card-name';
      name.innerText = card.name;
      if (card.type === 'Lesson') {
        name.style.color = `var(--color-${(card.provides?.type || card.lessonType || 'charms').toLowerCase().replace(/\s+/g, '-')})`;
      }

      const typeCost = document.createElement('div');
      typeCost.className = 'catalog-card-meta';
      const costText = card.lessonCost ? ` (${card.lessonCost.total} ${card.lessonCost.type})` : '';
      typeCost.innerText = `${card.type}${costText}`;

      const desc = document.createElement('div');
      desc.className = 'catalog-card-desc';
      desc.innerText = card.text || '';

      info.appendChild(name);
      info.appendChild(typeCost);
      info.appendChild(desc);

      if (card.type === 'Lesson') {
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '8px';
        btnContainer.style.marginTop = '6px';
        btnContainer.style.alignSelf = 'flex-start';

        const btnAdd = document.createElement('button');
        btnAdd.className = 'btn btn-small';
        btnAdd.innerText = 'Add 1';
        btnAdd.style.height = '28px';
        btnAdd.style.padding = '0 10px';
        btnAdd.style.fontSize = '0.78rem';
        btnAdd.addEventListener('click', () => {
          this.addCardToDeck(card.id);
        });

        const btnAddFive = document.createElement('button');
        btnAddFive.className = 'btn btn-small btn-secondary';
        btnAddFive.innerText = 'Add 5';
        btnAddFive.style.height = '28px';
        btnAddFive.style.padding = '0 10px';
        btnAddFive.style.fontSize = '0.78rem';
        btnAddFive.addEventListener('click', () => {
          for (let i = 0; i < 5; i++) {
            this.addCardToDeck(card.id);
          }
        });

        btnContainer.appendChild(btnAdd);
        btnContainer.appendChild(btnAddFive);
        info.appendChild(btnContainer);
      } else {
        const btnAdd = document.createElement('button');
        btnAdd.className = 'btn btn-small';
        btnAdd.innerText = 'Add to Deck';
        
        if (countInDeck >= 4) {
          btnAdd.classList.add('disabled');
          btnAdd.disabled = true;
          btnAdd.innerText = 'Max copies';
        }

        btnAdd.addEventListener('click', () => {
          this.addCardToDeck(card.id);
        });

        info.appendChild(btnAdd);
      }

      cardEl.appendChild(thumb);
      cardEl.appendChild(info);
      this.el.catalogGrid.appendChild(cardEl);
    });
  }

  showCardZoom(card) {
    const modal = document.getElementById('card-preview-modal');
    const img = document.getElementById('modal-card-image');
    const actions = document.getElementById('modal-actions');

    if (!modal || !img) return;

    img.src = card.image || '';
    img.alt = card.name || 'Card Preview';

    let isHorizontal = card.type !== 'Spell';
    let rotation = isHorizontal ? 90 : 0;

    img.style.transform = rotation ? `rotate(${rotation}deg)` : 'none';
    img.style.margin = rotation ? '40px 0' : '0';

    if (actions) {
      actions.innerHTML = ''; // No in-game actions in Deck Builder
    }

    modal.showModal();
  }

  show() {
    if (this.el.container) {
      this.el.container.classList.remove('hidden');
    }
    this.loadCurrentDeckToUI();
  }

  hide() {
    if (this.el.container) {
      this.el.container.classList.add('hidden');
    }
  }
}
