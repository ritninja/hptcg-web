# Harry Potter Trading Card Game - Local Web Edition

A local, web-based implementation of the classic Wizards of the Coast Harry Potter Trading Card Game. This application runs completely offline and locally on your computer, making it playable on macOS, Windows, or Linux.

---

## 📁 Directory Structure
Below is the directory structure created for this project:

```text
HPTCG/
├── index.html            # Main game layout and user interface dashboard
├── README.md             # This instruction manual
├── assets/               # Media assets
│   ├── images/
│   │   ├── cards/        # Place card artwork images here (matching JSON filename references)
│   │   └── ui/           # Game board icons, lesson indicators
│   └── sounds/           # Sound files for card plays, damage, win/lose triggers
├── css/
│   └── styles.css        # Premium dark themed styling, HSL palette variables & fonts
├── data/
│   ├── cards.json        # The central card database (Lessons, Creatures, Spells, Items, Adventures)
│   └── rules.json        # Game parameter configurations, turn loops, phases, and win-conditions
└── js/
    ├── app.js            # Bootstrapper: loads JSON databases, builds decks, and hooks up the game
    ├── game-engine.js    # Rules manager: validates actions, manages turn phases, and processes damage
    └── ui.js             # Visual manager: renders hand/board zones, updates game state changes, simulated AI
```

---

## 🚀 How to Run the Game Locally

Modern web browsers block loading local JSON databases (`fetch`) and JavaScript modules (`import/export`) directly via the `file://` protocol due to **CORS (Cross-Origin Resource Sharing)** security measures. 

To run the game, launch a lightweight local web server in the game directory. Below are the easiest ways to do this across all operating systems:

### Option A: Using Python (Mac & Linux - Pre-installed)
Open your terminal, navigate to the game directory, and run:
```bash
python3 -m http.server 8000
```
Then open your web browser and navigate to: **`http://localhost:8000`**

### Option B: Using Node.js / npx (Windows, Mac, Linux)
If you have Node.js installed, open your terminal/command prompt and run:
```bash
npx serve .
```
This automatically downloads a local server and prints the URL (usually **`http://localhost:3000`** or similar).

### Option C: VS Code (Live Server Extension)
If you use VS Code:
1. Open the `HPTCG` folder in VS Code.
2. Install the **Live Server** extension by Ritwick Dey.
3. Click the **Go Live** button in the bottom status bar.

---

## 🃏 Customizing Cards and Rules

You can add cards or change rules by editing the JSON files in the `data/` directory.

### 1. Adding Cards to `data/cards.json`
To add a card, append an object to the JSON array. Follow this template depending on the card type:

#### A Lesson Card:
```json
{
  "id": "lesson-potions-new",
  "name": "Potions Lesson",
  "type": "Lesson",
  "lessonType": "Potions",
  "text": "Provides 1 Potions lesson.",
  "provides": {
    "type": "Potions",
    "amount": 1
  },
  "image": "lesson_potions.jpg"
}
```

#### A Spell Card:
```json
{
  "id": "spell-vermillious",
  "name": "Vermillious",
  "type": "Spell",
  "lessonCost": {
    "total": 1,
    "type": "Transfiguration"
  },
  "text": "Does 2 damage to your opponent.",
  "effects": {
    "damage": 2,
    "target": "opponent"
  },
  "image": "spell_vermillious.jpg"
}
```

#### A Creature Card:
```json
{
  "id": "creature-snarling-stump",
  "name": "Snarling Stump",
  "type": "Creature",
  "lessonCost": {
    "total": 3,
    "type": "Care of Magical Creatures"
  },
  "damagePerTurn": 2,
  "health": 3,
  "text": "Does 2 damage each turn. Defeat cost: 3.",
  "image": "creature_snarling_stump.jpg"
}
```

---

## 🎮 Gameplay Overview
1. **Starting setup**: Both players start with 1 Starting Character face up, a 60-card deck, and draw 7 cards (Harry Potter starts with 8).
2. **Turn loop**:
   - Draw 1 card at start of turn.
   - You get **2 Actions** per turn.
   - Action costs:
     - **Play any card**: Costs 1 Action.
     - **Draw 1 card**: Costs 1 Action.
     - **Use card ability**: Costs 1 Action.
3. **Playing Card Rules**: To play Spells, Creatures, Items, or Adventures, you must have:
   - At least the total lessons count matching the card's cost (e.g. 3 Transfiguration means you must have 3 lessons of *any* type in play).
   - At least 1 lesson of the specified type (e.g. at least 1 Transfiguration Lesson).
4. **Attacking**: At the end of your turn, your Creatures automatically deal damage to your opponent.
5. **Damage**: When a player takes damage, they discard that many cards from the top of their deck.
6. **Winning**: A player wins when their opponent must draw or discard cards but has an empty deck (deck depletion).
