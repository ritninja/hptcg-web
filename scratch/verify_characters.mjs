import fs from 'fs';
import { GameEngine, PlayerState } from '../js/game-engine.js';

// Mock normalizeCards (copied from app.js)
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
    const discardLessonTypeMatch = effectText.match(/discard (\d+) of your (Charms|Transfiguration|Potions|Herbology|Care of Magical Creatures?)\s+Lessons?\s+from\s+play/i);
    const discardGenericLessonMatch = effectText.match(/discard (\d+) of your Lessons?\s+from\s+play/i);

    if (discardLessonTypeMatch) {
      let type = discardLessonTypeMatch[2];
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

    return normalized;
  });
}

// 1. Setup Mock Card Database and Game Rules
const cardsDataRaw = JSON.parse(fs.readFileSync('./data/base_set/cards.json', 'utf8'));
const cardsDb = normalizeCards(cardsDataRaw.cards);

const rulesConfig = {
  setup: {
    deckSize: 60,
    startingHandSize: 7,
    startingActions: 2,
    startingCharactersCount: 1
  }
};

const engine = new GameEngine(cardsDb, rulesConfig);

// Helper to assert conditions
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log("=== Character Verification Tests Initiated ===");

// Find required character card definitions
const harryDef = cardsDb.find(c => c.name === 'Harry Potter');
const hermioneDef = cardsDb.find(c => c.name === 'Hermione Granger');
const deanDef = cardsDb.find(c => c.name === 'Dean Thomas');
const ronDef = cardsDb.find(c => c.name === 'Ron Weasley');
const hagridDef = cardsDb.find(c => c.name === 'Rubeus Hagrid');
const dracoDef = cardsDb.find(c => c.name === 'Draco Malfoy') || { id: '2', name: 'Draco Malfoy', type: 'Character' };

assert(harryDef !== undefined, "Found Harry Potter definition");
assert(hermioneDef !== undefined, "Found Hermione Granger definition");
assert(deanDef !== undefined, "Found Dean Thomas definition");
assert(ronDef !== undefined, "Found Ron Weasley definition");
assert(hagridDef !== undefined, "Found Rubeus Hagrid definition");

// TEST 1: Harry Potter Draw Passive
{
  engine.players.player = new PlayerState('player', 'You', { ...harryDef, instanceId: 'player-starting-char' });
  engine.players.opponent = new PlayerState('opponent', 'Hogwarts Rival', { ...dracoDef, instanceId: 'opponent-starting-char' });
  
  // Fill deck
  engine.players.player.deck = [{ name: 'Lesson 1' }, { name: 'Lesson 2' }, { name: 'Lesson 3' }];
  engine.actionsRemaining = 2;
  engine.activePlayerId = 'player';

  // Action Draw
  console.log("Harry Potter drawing card...");
  engine.drawCard('player', true);
  assert(engine.players.player.hand.length === 2, "Harry Potter drew 2 cards instead of 1 on action cost draw");
  assert(engine.actionsRemaining === 1, "Only spent 1 action point");
}

// TEST 2: Rubeus Hagrid Creature Damage Booster
{
  const testChar = { ...hagridDef, instanceId: 'hagrid-char' };
  engine.players.player = new PlayerState('player', 'You', testChar);
  engine.players.opponent = new PlayerState('opponent', 'Hogwarts Rival', { ...dracoDef, instanceId: 'opponent-starting-char' });

  engine.players.opponent.deck = Array(10).fill(null).map((_, i) => ({ name: `Mock Card ${i}` }));

  // Add 3-damage creature
  engine.players.player.creatures.push({
    name: 'Vicious Wolf',
    type: 'Creature',
    damagePerTurn: 3,
    health: 3,
    instanceId: 'wolf-inst'
  });

  engine.activePlayerId = 'player';
  console.log("Ending turn with Hagrid in play and Vicious Wolf...");
  
  console.log("Active Player ID:", engine.activePlayerId);
  console.log("Active Player Characters:", engine.players.player.characters.map(c => c.name));
  console.log("Active Player Creatures:", engine.players.player.creatures.map(c => ({ name: c.name, dmg: c.damagePerTurn })));
  
  const preOppDeck = engine.players.opponent.deck.length;
  engine.endTurn(); // wolf should attack and do 3 + 2 = 5 damage
  
  console.log("Opponent Deck size after attack:", engine.players.opponent.deck.length);
  console.log("Deck size reduction:", preOppDeck - engine.players.opponent.deck.length);

  assert(engine.players.opponent.deck.length === preOppDeck - 6, "Hagrid boosted Vicious Wolf's damage from 3 to 5 (plus 1 card drawn at start of turn)");
}

// TEST 3: Ron Weasley Play Cost Modifier
{
  const testChar = { ...ronDef, instanceId: 'ron-char' };
  engine.players.player = new PlayerState('player', 'You', testChar);
  engine.players.opponent = new PlayerState('opponent', 'Hogwarts Rival', { ...dracoDef, instanceId: 'opponent-starting-char' });

  // Give player Dean Thomas card in hand
  const deanHandCard = { ...deanDef, instanceId: 'dean-hand-inst' };
  engine.players.player.hand = [deanHandCard];
  engine.actionsRemaining = 2;
  engine.activePlayerId = 'player';

  console.log("Playing Dean Thomas from hand with Ron Weasley in play...");
  const success = engine.playCard('player', 'dean-hand-inst');
  assert(success, "Successfully played Dean Thomas");
  assert(engine.players.player.characters.some(c => c.name === 'Dean Thomas'), "Dean Thomas is in play");
  assert(engine.actionsRemaining === 1, "Playing character card only cost 1 action instead of 2 due to Ron Weasley");
}

// TEST 4: Dean Thomas Activated Ability
{
  const testChar = { ...deanDef, instanceId: 'dean-char' };
  engine.players.player = new PlayerState('player', 'You', testChar);
  engine.players.opponent = new PlayerState('opponent', 'Hogwarts Rival', { ...dracoDef, instanceId: 'opponent-starting-char' });

  engine.players.player.deck = [{ name: 'C1', instanceId: 'c1' }, { name: 'C2', instanceId: 'c2' }, { name: 'C3', instanceId: 'c3' }, { name: 'C4', instanceId: 'c4' }];
  engine.actionsRemaining = 1;
  engine.activePlayerId = 'player';

  console.log("Activating Dean Thomas...");
  assert(engine.canActivateCharacterAbility('player', testChar), "Can activate Dean Thomas");
  engine.activateCharacterAbility('player', 'dean-char');
  assert(engine.players.player.hand.length === 3, "Dean Thomas drew 3 cards");
  assert(!engine.canActivateCharacterAbility('player', testChar), "Cannot activate Dean Thomas again (once per game)");
}

// TEST 5: Draco Malfoy Activated Ability
{
  const testChar = { ...dracoDef, instanceId: 'draco-char' };
  engine.players.player = new PlayerState('player', 'You', testChar);
  engine.players.opponent = new PlayerState('opponent', 'Hogwarts Rival', { ...dracoDef, instanceId: 'opponent-starting-char' });

  engine.players.player.hand = [
    { name: 'Discard Cost', instanceId: 'cost-inst', type: 'Lesson' },
    { name: 'Keep Card', instanceId: 'keep-inst', type: 'Lesson' }
  ];
  engine.players.opponent.hand = [
    { name: 'Opponent Discard', instanceId: 'opp-discard-inst', type: 'Lesson' }
  ];
  engine.actionsRemaining = 1;
  engine.activePlayerId = 'player';

  console.log("Activating Draco Malfoy...");
  assert(engine.canActivateCharacterAbility('player', testChar), "Can activate Draco Malfoy");
  engine.activateCharacterAbility('player', 'draco-char');
  
  assert(engine.pendingSpell !== null, "Draco prompted for cost card");
  assert(engine.pendingSpell.title.includes("Choose 1 card from hand to discard as cost"), "Cost choice title matches");
  
  // Resolve first prompt (cost)
  engine.resolvePendingSpell(['hand-player-cost-inst']);
  
  // Hand should now be keep-inst, and cost-inst in discard
  assert(engine.players.player.hand.some(c => c.instanceId === 'keep-inst'), "Keep card is still in hand");
  assert(!engine.players.player.hand.some(c => c.instanceId === 'cost-inst'), "Cost card removed from hand");
  assert(engine.players.player.discardPile.some(c => c.instanceId === 'cost-inst'), "Cost card in discard pile");

  // Should have second prompt for opponent's hand
  assert(engine.pendingSpell !== null, "Draco prompted for opponent hand discard");
  assert(engine.pendingSpell.title.includes("Choose 1 card in Hogwarts Rival's hand to discard"), "Opponent choice title matches");

  // Resolve second prompt (opponent hand discard)
  engine.resolvePendingSpell(['hand-opponent-opp-discard-inst']);
  assert(engine.players.opponent.hand.length === 0, "Opponent hand is empty");
  assert(engine.players.opponent.discardPile.some(c => c.instanceId === 'opp-discard-inst'), "Opponent card in discard");
  assert(engine.actionsRemaining === 0, "Draco Malfoy activation cost 1 action");
}

// TEST 6: Hannah Abbott Activated Ability
{
  const hannahDef = cardsDb.find(c => c.name === 'Hannah Abbott');
  const testChar = { ...hannahDef, instanceId: 'hannah-char' };
  engine.players.player = new PlayerState('player', 'You', testChar);
  engine.players.opponent = new PlayerState('opponent', 'Hogwarts Rival', { ...dracoDef, instanceId: 'opponent-starting-char' });

  engine.players.player.hand = [
    { name: 'H1', instanceId: 'h1', type: 'Lesson' },
    { name: 'H2', instanceId: 'h2', type: 'Lesson' }
  ];
  engine.players.player.discardPile = [
    { name: 'D1', instanceId: 'd1', type: 'Lesson', subTypes: [] },
    { name: 'D2', instanceId: 'd2', type: 'Lesson', subTypes: [] },
    { name: 'Heal1', instanceId: 'heal1', type: 'Spell', subTypes: ['Healing'] }
  ];
  engine.actionsRemaining = 1;
  engine.activePlayerId = 'player';

  console.log("Activating Hannah Abbott...");
  assert(engine.canActivateCharacterAbility('player', testChar), "Can activate Hannah Abbott");
  engine.activateCharacterAbility('player', 'hannah-char');

  assert(engine.pendingSpell !== null, "Hannah prompted for hand cards to discard");
  engine.resolvePendingSpell(['hand-player-h1', 'hand-player-h2']);

  assert(engine.pendingSpell !== null, "Hannah prompted for non-healing discard cards to retrieve");
  // Retrieve d1 and d2
  engine.resolvePendingSpell(['discard-player-d1', 'discard-player-d2']);

  assert(engine.players.player.hand.some(c => c.instanceId === 'd1') && engine.players.player.hand.some(c => c.instanceId === 'd2'), "d1 and d2 retrieved into hand");
  assert(engine.players.player.hand.length === 2, "Hand has 2 cards");
  assert(engine.players.player.discardPile.some(c => c.instanceId === 'h1') && engine.players.player.discardPile.some(c => c.instanceId === 'h2'), "h1 and h2 discarded");
  assert(!engine.canActivateCharacterAbility('player', testChar), "Hannah Abbott cannot be activated again (once per game)");
}

// TEST 7: Nearly Headless Nick Activated Ability
{
  const nickDef = cardsDb.find(c => c.name === 'Nearly Headless Nick');
  const testChar = { ...nickDef, instanceId: 'nick-char' };
  engine.players.player = new PlayerState('player', 'You', testChar);
  engine.players.opponent = new PlayerState('opponent', 'Hogwarts Rival', { ...dracoDef, instanceId: 'opponent-starting-char' });

  engine.players.player.deck = [
    { name: 'Item 1', instanceId: 'item1', type: 'Item' },
    { name: 'Lesson 1', instanceId: 'lesson1', type: 'Lesson' },
    { name: 'Item 2', instanceId: 'item2', type: 'Item' }
  ];
  engine.actionsRemaining = 1;
  engine.activePlayerId = 'player';

  console.log("Activating Nearly Headless Nick...");
  assert(engine.canActivateCharacterAbility('player', testChar), "Can activate Nearly Headless Nick");
  engine.activateCharacterAbility('player', 'nick-char');

  assert(engine.pendingSpell !== null, "Nick prompted for items to find");
  engine.resolvePendingSpell(['deck-player-item1', 'deck-player-item2']);

  assert(engine.players.player.hand.some(c => c.instanceId === 'item1') && engine.players.player.hand.some(c => c.instanceId === 'item2'), "Items put into hand");
  assert(!engine.players.player.deck.some(c => c.type === 'Item'), "No items left in deck");
  assert(!engine.canActivateCharacterAbility('player', testChar), "Nearly Headless Nick cannot be activated again (once per game)");
}

// TEST 8: Professor Filius Flitwick Activated Ability
{
  const flitwickDef = cardsDb.find(c => c.name === 'Professor Filius Flitwick');
  const testChar = { ...flitwickDef, instanceId: 'flitwick-char' };
  engine.players.player = new PlayerState('player', 'You', testChar);
  engine.players.opponent = new PlayerState('opponent', 'Hogwarts Rival', { ...dracoDef, instanceId: 'opponent-starting-char' });

  engine.players.player.hand = [
    { name: 'F1', instanceId: 'f1', type: 'Lesson' },
    { name: 'F2', instanceId: 'f2', type: 'Lesson' }
  ];
  engine.players.player.discardPile = [
    { name: 'Charms Lesson', instanceId: 'charms-lesson-inst', type: 'Lesson', lessonCost: { type: 'Charms', total: 1 } },
    { name: 'Other Lesson', instanceId: 'other-lesson-inst', type: 'Lesson' }
  ];
  engine.actionsRemaining = 1;
  engine.activePlayerId = 'player';

  console.log("Activating Professor Filius Flitwick...");
  assert(engine.canActivateCharacterAbility('player', testChar), "Can activate Professor Filius Flitwick");
  engine.activateCharacterAbility('player', 'flitwick-char');

  assert(engine.pendingSpell !== null, "Flitwick prompted for hand discard");
  engine.resolvePendingSpell(['hand-player-f1', 'hand-player-f2']);

  assert(engine.pendingSpell !== null, "Flitwick prompted for charms retrieval");
  engine.resolvePendingSpell(['discard-player-charms-lesson-inst']);

  assert(engine.players.player.hand.some(c => c.instanceId === 'charms-lesson-inst'), "Charms lesson retrieved into hand");
  assert(engine.players.player.hand.length === 1, "Hand has 1 card");
  assert(!engine.canActivateCharacterAbility('player', testChar), "Flitwick cannot be activated again (once per game)");
}

// TEST 9: Professor Severus Snape Activated Ability
{
  const snapeDef = cardsDb.find(c => c.name === 'Professor Severus Snape');
  const testChar = { ...snapeDef, instanceId: 'snape-char' };
  engine.players.player = new PlayerState('player', 'You', testChar);
  engine.players.opponent = new PlayerState('opponent', 'Hogwarts Rival', { ...dracoDef, instanceId: 'opponent-starting-char' });

  engine.players.player.discardPile = [
    { name: 'D1', instanceId: 'd1', subTypes: [] },
    { name: 'D2', instanceId: 'd2', subTypes: [] },
    { name: 'D3', instanceId: 'd3', subTypes: [] },
    { name: 'D4', instanceId: 'd4', subTypes: [] },
    { name: 'D5', instanceId: 'd5', subTypes: [] },
    { name: 'D6', instanceId: 'd6', subTypes: [] },
    { name: 'D7', instanceId: 'd7', subTypes: [] },
    { name: 'D8', instanceId: 'd8', subTypes: [] },
    { name: 'Heal1', instanceId: 'heal1', subTypes: ['Healing'] }
  ];
  engine.actionsRemaining = 1;
  engine.activePlayerId = 'player';

  console.log("Activating Severus Snape...");
  assert(engine.canActivateCharacterAbility('player', testChar), "Can activate Severus Snape");
  engine.activateCharacterAbility('player', 'snape-char');

  assert(engine.pendingSpell !== null, "Snape prompted for cards to shuffle");
  // Choose 7 non-healing cards
  engine.resolvePendingSpell([
    'discard-player-d1',
    'discard-player-d2',
    'discard-player-d3',
    'discard-player-d4',
    'discard-player-d5',
    'discard-player-d6',
    'discard-player-d7'
  ]);

  assert(engine.players.player.deck.length === 7, "Shuffled exactly 7 cards back to deck");
  assert(engine.players.player.discardPile.length === 2, "Left 2 cards in discard (D8 and Heal1)");
  assert(engine.players.player.discardPile.some(c => c.instanceId === 'heal1'), "Healing card was NOT shuffled");
  assert(!engine.canActivateCharacterAbility('player', testChar), "Snape cannot be activated again (once per game)");
}

// TEST 10: Hermione Granger Passive Ability
{
  const testChar = { ...hermioneDef, instanceId: 'hermione-char' };
  engine.players.player = new PlayerState('player', 'You', testChar);
  engine.players.opponent = new PlayerState('opponent', 'Hogwarts Rival', { ...dracoDef, instanceId: 'opponent-starting-char' });

  // Give 2 lessons in play
  engine.players.player.lessons = [
    { name: 'Lesson 1', instanceId: 'l1', type: 'Lesson' },
    { name: 'Lesson 2', instanceId: 'l2', type: 'Lesson' }
  ];

  // Give 2 lessons in hand
  engine.players.player.hand = [
    { name: 'Lesson 3', instanceId: 'l3', type: 'Lesson' },
    { name: 'Lesson 4', instanceId: 'l4', type: 'Lesson' }
  ];

  engine.actionsRemaining = 2;
  engine.activePlayerId = 'player';

  console.log("Playing Lesson with Hermione Granger in play...");
  engine.playCard('player', 'l3');

  assert(engine.pendingSpell !== null, "Hermione Granger prompted to play a second lesson");
  engine.resolvePendingSpell(['hand-player-l4']);

  assert(engine.players.player.lessons.length === 4, "Played both lessons");
  assert(engine.players.player.hand.length === 0, "No lessons left in hand");
  assert(engine.actionsRemaining === 1, "Only spent 1 action total for both lessons");
}

// TEST 11: Creature Abilities - Unicorn, Delivery Owl, Pet Toad / Kelpie
{
  console.log("=== Running Creature Ability Tests ===");
  const unicornDef = cardsDb.find(c => c.name === 'Unicorn');
  const owlDef = cardsDb.find(c => c.name === 'Delivery Owl');
  const toadDef = cardsDb.find(c => c.name === 'Pet Toad');
  
  assert(unicornDef !== undefined, "Found Unicorn card definition");
  assert(owlDef !== undefined, "Found Delivery Owl card definition");
  assert(toadDef !== undefined, "Found Pet Toad card definition");

  // Reset engine states
  engine.players.player = new PlayerState('player', 'You', { ...harryDef, instanceId: 'player-starting-char' });
  engine.players.opponent = new PlayerState('opponent', 'Hogwarts Rival', { ...dracoDef, instanceId: 'opponent-starting-char' });

  // Give player 6 Care of Magical Creatures lessons in play
  engine.players.player.lessons = Array(6).fill(null).map((_, i) => ({
    name: 'Care of Magical Creatures',
    type: 'Lesson',
    lessonType: 'Care of Magical Creatures',
    provides: { type: 'Care of Magical Creatures', amount: 1 },
    instanceId: `comc-l-${i}`
  }));

  // 1. Unicorn summon action grant
  engine.players.player.hand = [{ ...unicornDef, instanceId: 'unicorn-hand' }];
  engine.actionsRemaining = 2;
  engine.activePlayerId = 'player';
  const success = engine.playCard('player', 'unicorn-hand');
  console.log("Play success:", success);
  console.log("Actions remaining:", engine.actionsRemaining);
  console.log("Last engine logs:", engine.logs.slice(-3));

  assert(engine.players.player.creatures.some(c => c.name === 'Unicorn'), "Unicorn is in play");
  assert(engine.actionsRemaining === 2, "Unicorn played successfully (cost 1 action, but granted 1 back so net remaining is 2)");

  // 2. Delivery Owl start of turn draw and Unicorn start of turn action grant
  // Give opponent turn, then opponent ends turn
  engine.actionsRemaining = 0;
  engine.players.player.creatures.push({ ...owlDef, instanceId: 'owl-in-play' }); // add Delivery Owl to play
  engine.players.player.deck = [{ name: 'Owl Draw 1' }, { name: 'Normal Draw 1' }];

  console.log("Ending turn to let opponent play and then start player turn...");
  engine.endTurn(); // Switches active to opponent, opponent draws 1
  
  // Opponent ends turn immediately
  engine.endTurn(); // Switches active back to player. This should trigger Delivery Owl and Unicorn!
  
  assert(engine.activePlayerId === 'player', "Player's turn again");
  assert(engine.actionsRemaining === 3, "Unicorn granted +1 action at turn start (total 3 actions)");
  assert(engine.players.player.hand.length === 2, "Player drew 2 cards (1 from Delivery Owl, 1 from normal turn-start draw)");

  // 3. Pet Toad spell damage redirection
  engine.players.player.creatures.push({ ...toadDef, instanceId: 'toad-in-play', health: 1, damage: 0 });
  engine.players.player.deck = [{ name: 'Deck Card 1' }, { name: 'Deck Card 2' }];
  
  console.log("Simulating spell damage to player with Pet Toad in play...");
  engine.dealDamage('player', 1, 'spell');

  assert(engine.pendingSpell !== null, "Redirect Spell Damage choice prompted");
  assert(engine.pendingSpell.title.includes("Redirect Spell Damage"), "Redirect prompt title matches");

  // Select redirect option
  engine.resolvePendingSpell(['redirect-toad-in-play']);

  const toadInPlay = engine.players.player.discardPile.find(c => c.instanceId === 'toad-in-play');
  assert(toadInPlay !== undefined, "Pet Toad took damage, was defeated, and is in discard pile");
  assert(engine.players.player.deck.length === 2, "Player deck was not damaged (still has 2 cards)");
}


