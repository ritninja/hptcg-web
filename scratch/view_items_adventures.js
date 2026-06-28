import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data/base_set/cards.json', 'utf8'));

const items = data.cards.filter(c => c.type && c.type.includes('Item'));
const adventures = data.cards.filter(c => c.type && c.type.includes('Adventure'));

console.log(`=== FOUND ${items.length} ITEMS ===`);
items.forEach(c => {
  console.log(`- [${c.number}] ${c.name} (${c.subTypes ? c.subTypes.join(', ') : 'None'}):`);
  console.log(`  Cost: ${c.cost} ${c.lesson ? c.lesson[0] : 'None'}`);
  console.log(`  Effect: ${c.effect ? c.effect.join(' // ') : (c.flavorText || 'No effect text')}`);
  console.log();
});

console.log(`=== FOUND ${adventures.length} ADVENTURES ===`);
adventures.forEach(c => {
  console.log(`- [${c.number}] ${c.name}:`);
  console.log(`  Cost: ${c.cost} ${c.lesson ? c.lesson[0] : 'None'}`);
  console.log(`  Effect: ${c.effect ? c.effect.join(' // ') : 'None'}`);
  console.log();
});
