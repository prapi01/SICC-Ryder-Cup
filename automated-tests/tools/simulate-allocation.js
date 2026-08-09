/**
 * Dry-run validation of the v1.02 allocation algorithm against real PROD
 * deviceMapping data (which currently has all 99 DEV-## names taken).
 * Replicates session.js getShortDeviceName() logic in-memory; does NOT write.
 */
const { FIRESTORE_BASE } = require('../helpers/env');

const DEVICE_MAPPING_STALE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_DEVICE_NUM = 99;
const TEST_DEVICE = 'dev_validator_' + Date.now();

(async () => {
  const t0 = Date.now();
  const res = await fetch(FIRESTORE_BASE + '/deviceMapping?pageSize=1000');
  const json = await res.json();
  const docs = json.documents || [];
  const t1 = Date.now();

  const usedNames = {};
  const staleDocs = [];
  let counterData = null;
  const now = Date.now();
  for (const doc of docs) {
    const id = doc.name.split('/').pop();
    if (id === 'counter') { counterData = doc.fields; continue; }
    const shortName = doc.fields.shortName && doc.fields.shortName.stringValue;
    if (!shortName) continue;
    const lastSeen = doc.fields.lastSeen && (doc.fields.lastSeen.integerValue || doc.fields.lastSeen.doubleValue);
    if (lastSeen && (now - Number(lastSeen) > DEVICE_MAPPING_STALE_MS)) { staleDocs.push(id); continue; }
    usedNames[shortName] = true;
  }
  const t2 = Date.now();

  let nextNumber = 1;
  if (counterData && counterData.lastNumber) {
    nextNumber = (Number(counterData.lastNumber.integerValue) % MAX_DEVICE_NUM) + 1;
  }
  let newShortName = null;
  for (let attempts = 0; attempts < MAX_DEVICE_NUM; attempts++) {
    const candidate = 'DEV-' + String(nextNumber).padStart(2, '0');
    if (!usedNames[candidate]) { newShortName = candidate; break; }
    nextNumber = (nextNumber % MAX_DEVICE_NUM) + 1;
  }
  const t3 = Date.now();

  let reaped = null;
  if (!newShortName) {
    let oldestDoc = null;
    let oldestLastSeen = Infinity;
    for (const doc of docs) {
      const id = doc.name.split('/').pop();
      if (id === 'counter') continue;
      const shortName = doc.fields.shortName && doc.fields.shortName.stringValue;
      if (!shortName) continue;
      const ls = Number((doc.fields.lastSeen && (doc.fields.lastSeen.integerValue || doc.fields.lastSeen.doubleValue)) || 0);
      if (ls < oldestLastSeen) { oldestLastSeen = ls; oldestDoc = id; }
    }
    if (oldestDoc) { reaped = oldestDoc; newShortName = usedNamesSnapshotName(oldestDoc, docs); }
  }
  const t4 = Date.now();

  function usedNamesSnapshotName(id, docsList) {
    const d = docsList.find((x) => x.name.split('/').pop() === id);
    return d && d.fields.shortName && d.fields.shortName.stringValue;
  }

  console.log('=== VALIDATION vs real PROD data ===');
  console.log('docs read:', docs.length, '| stale (will prune):', staleDocs.length, '| distinct used:', Object.keys(usedNames).length);
  console.log('timing: fetch=' + (t1 - t0) + 'ms build=' + (t2 - t1) + 'ms scan=' + (t3 - t2) + 'ms reap=' + (t4 - t3) + 'ms');
  console.log('allocated name:', newShortName, '| reaped oldest mapping:', reaped || 'n/a');
  if (!newShortName || !/^DEV-\d\d$/.test(newShortName)) {
    console.error('INVALID result');
    process.exit(1);
  }
  console.log('OK — allocation completes in O(1) network calls with a valid name');
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
