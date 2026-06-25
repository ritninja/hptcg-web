import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data/cards.json', 'utf8'));
const creatures = data.cards.filter(c => c.type && c.type.includes('Creature'));

console.log(`Found ${creatures.length} creatures:`);
creatures.forEach(c => {
  console.log(`- [${c.number}] ${c.name}:`);
  console.log(`  Lesson cost: ${c.cost} ${c.lesson ? c.lesson[0] : 'None'}`);
  console.log(`  Stats: DMG=${c.dmgEachTurn || 0}, Health=${c.health || 0}`);
  console.log(`  Effect: ${c.effect ? c.effect.join(' // ') : 'None'}`);
  console.log(`  Flavor: ${c.flavorText || 'None'}`);
  console.log();
});
