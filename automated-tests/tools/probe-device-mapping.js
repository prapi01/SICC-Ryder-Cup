/** Diagnostics: count deviceMapping accumulation (the DEV-## allocation bottleneck). */
const { FIRESTORE_BASE } = require('../helpers/env');

(async () => {
  const res = await fetch(FIRESTORE_BASE + '/deviceMapping?pageSize=300');
  const json = await res.json();
  const docs = json.documents || [];
  const taken = docs.map((d) => d.fields.shortName && d.fields.shortName.stringValue).filter(Boolean);
  const devNums = taken
    .filter((n) => /^DEV-\d\d$/.test(n))
    .map((n) => parseInt(n.slice(4), 10));
  const unique = new Set(devNums);
  console.log('total deviceMapping docs:', docs.length);
  console.log('docs with shortName:', taken.length, '| distinct:', new Set(taken).size);
  console.log('DEV-## count:', devNums.length, '| unique DEV-##:', unique.size);
  if (devNums.length) console.log('DEV-## range:', Math.min(...devNums) + '..' + Math.max(...devNums));
  const missing = [];
  for (let i = 1; i <= 99; i++) if (!unique.has(i)) missing.push(i);
  console.log('missing DEV numbers (1-99):', missing.length);
})().catch((e) => {
  console.error('ERROR', e.message);
  process.exit(1);
});
