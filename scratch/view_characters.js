import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data/cards.json', 'utf8'));
const characters = data.cards.filter(c => c.type && c.type.includes('Character'));

console.log(`Found ${characters.length} characters.`);
characters.forEach(c => {
  console.log(`- ${c.name} (${c.subTypes ? c.subTypes.join(', ') : 'None'}): ${c.effect ? c.effect.join(' // ') : (c.flavorText || 'No effect text')}`);
});
