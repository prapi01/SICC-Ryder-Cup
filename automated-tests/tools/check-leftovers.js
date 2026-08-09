/** Diagnostics: report leftover test games in scheduledGames. */
const { FIRESTORE_BASE } = require('../helpers/env');

(async () => {
  const res = await fetch(FIRESTORE_BASE + '/scheduledGames?pageSize=300');
  const json = await res.json();
  const docs = json.documents || [];
  const testDocs = docs.filter((d) => d.fields.testGame && d.fields.testGame.booleanValue === true);
  console.log('scheduledGames total:', docs.length);
  console.log(
    'leftover testGame:',
    testDocs.map((d) => d.name.split('/').pop()).join(', ') || 'none'
  );
  console.log('non-test games:', docs.length - testDocs.length);
})().catch((e) => {
  console.error('ERROR', e.message);
  process.exit(1);
});
