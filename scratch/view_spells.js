import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data/cards.json', 'utf8'));
const spells = data.cards.filter(c => c.type && c.type.includes('Spell'));

const list = spells.map(s => ({
  name: s.name,
  lesson: s.lesson ? s.lesson[0] : 'None',
  cost: parseInt(s.cost || '0', 10),
  effect: s.effect ? s.effect.join(' // ') : ''
}));

fs.writeFileSync('./scratch/spells_list.json', JSON.stringify(list, null, 2), 'utf8');
console.log(`Wrote ${list.length} spells to scratch/spells_list.json`);
