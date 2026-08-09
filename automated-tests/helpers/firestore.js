/**
 * Firestore REST helpers (Node side) — used to create/read/delete test games
 * without the browser. The app has NO auth and PROD/DEV rules allow reads/writes,
 * so the public REST API works directly.
 *
 * Docs: https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents
 */

const { FIRESTORE_BASE } = require('./env');

// ---------------------------------------------------------------------------
// Value <-> JS conversion (Firestore proto)
// ---------------------------------------------------------------------------
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  const t = typeof v;
  if (t === 'string') return { stringValue: v };
  if (t === 'boolean') return { booleanValue: v };
  if (t === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(toValue) } };
  }
  if (t === 'object') {
    if (v instanceof Date) return { timestampValue: v.toISOString() };
    const fields = {};
    for (const k of Object.keys(v)) fields[k] = toValue(v[k]);
    return { mapValue: { fields } };
  }
  throw new Error('Unsupported value type: ' + t);
}

function fromValue(v) {
  if (!v) return v;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue) return (v.arrayValue.values || []).map(fromValue);
  if (v.mapValue) {
    const out = {};
    for (const k of Object.keys(v.mapValue.fields || {})) out[k] = fromValue(v.mapValue.fields[k]);
    return out;
  }
  if (v.timestampValue) return v.timestampValue;
  return v;
}

// ---------------------------------------------------------------------------
// Low-level request
// ---------------------------------------------------------------------------
async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(FIRESTORE_BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore ${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.status === 204 ? null : res.json();
}

// ---------------------------------------------------------------------------
// Document CRUD
// ---------------------------------------------------------------------------
async function createDocument(collection, documentId, data) {
  const fields = toValue(data).mapValue.fields;
  return request(`/${collection}?documentId=${encodeURIComponent(documentId)}`, {
    method: 'POST',
    body: { fields }
  });
}

async function getDocument(collection, documentId) {
  const json = await request(`/${collection}/${encodeURIComponent(documentId)}`);
  if (!json || !json.fields) return null;
  const out = {};
  for (const k of Object.keys(json.fields)) out[k] = fromValue(json.fields[k]);
  return out;
}

async function deleteDocument(collection, documentId) {
  return request(`/${collection}/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
}

/**
 * Update top-level fields. Nested keys can be passed as dot paths, e.g.
 * { 'locks.f1': { ... } } (Firestore REST encodes the path with backticks on
 * numeric segments automatically via fieldPaths escaping).
 */
async function updateDocument(collection, documentId, patch) {
  const fields = toValue(patch).mapValue.fields;
  const fieldPaths = Object.keys(patch).map((k) => k.split('.').join('.'));
  const qs = fieldPaths
    .map((fp) => 'updateMask.fieldPaths=' + encodeURIComponent(fp))
    .join('&');
  return request(
    `/${collection}/${encodeURIComponent(documentId)}?${qs}`,
    { method: 'PATCH', body: { fields } }
  );
}

module.exports = { createDocument, getDocument, deleteDocument, updateDocument, toValue, fromValue };
