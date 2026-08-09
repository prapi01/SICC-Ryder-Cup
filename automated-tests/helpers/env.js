/**
 * Test environment resolution.
 *
 * BASE_URL (default PROD — the only env with the current app code; DEV/staging is
 * not synced with MAIN and is out of scope):
 *   https://sicc-ryder-cup.pages.dev        → PROD  (Firestore project sicc-ryder-cup)
 *   https://staging.sicc-ryder-cup.pages.dev → DEV   (Firestore project sicc-ryder-cup-dev)
 *   https://<preview-hash>.sicc-ryder-cup.pages.dev → DEV
 *   http://localhost:PORT                   → DEV
 *
 * FIREBASE_PROJECT can be set explicitly to override hostname detection.
 * TEST_MODE = 'headless' (assert suite, default) | 'step' (interactive Step Runner — Phase 2+)
 */

const BASE_URL = (process.env.BASE_URL || 'https://sicc-ryder-cup.pages.dev').replace(/\/+$/, '');

function detectProject(hostname) {
  if (/^[a-f0-9]{7,8}\./.test(hostname)) return 'sicc-ryder-cup-dev';
  if (hostname.startsWith('staging.')) return 'sicc-ryder-cup-dev';
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'sicc-ryder-cup-dev';
  return 'sicc-ryder-cup';
}

const FIREBASE_PROJECT =
  process.env.FIREBASE_PROJECT || detectProject(new URL(BASE_URL).hostname);

const FIRESTORE_BASE =
  `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

const TEST_MODE = process.env.TEST_MODE || 'headless'; // 'step' | 'headless'

module.exports = { BASE_URL, FIREBASE_PROJECT, FIRESTORE_BASE, TEST_MODE, detectProject };
