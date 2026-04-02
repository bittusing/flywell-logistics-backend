/**
 * Loads env before the rest of the app. PM2 cwd is often not the backend folder.
 *
 * 1) Always tries backend/.env (next to this file: config/ → .. = backend root)
 * 2) Optional: DOTENV_CONFIG_PATH or BACKEND_ENV_FILE = absolute path to .env
 * 3) If GOOGLE_CLIENT_ID still empty, tries a few more paths (override: true)
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

/**
 * Last resort if .env / PM2 env never provides GOOGLE_CLIENT_ID (same Web client as frontend).
 * Replace or remove when production .env is reliable — env always wins if set above.
 */
const GOOGLE_CLIENT_ID_FALLBACK =
  '174263048488-rgrphiihpk0em96r26atmoun9lan4shc.apps.googleusercontent.com';

const backendRoot = path.join(__dirname, '..');
const primaryEnvPath = path.join(backendRoot, '.env');

function mergeGoogleFromParsed(parsed) {
  const raw =
    parsed.GOOGLE_CLIENT_ID ||
    parsed.GOOGLE_OAUTH_WEB_CLIENT_ID ||
    parsed.GOOGLE_WEB_CLIENT_ID;
  if (!raw) return false;
  process.env.GOOGLE_CLIENT_ID = String(raw)
    .trim()
    .replace(/\r/g, '')
    .replace(/^["']|["']$/g, '');
  return true;
}

// 1) User override (full path to .env on server)
const userPath = process.env.DOTENV_CONFIG_PATH || process.env.BACKEND_ENV_FILE;
if (userPath && fs.existsSync(userPath)) {
  dotenv.config({ path: userPath });
  console.log('[loadEnv] Loaded from DOTENV_CONFIG_PATH / BACKEND_ENV_FILE:', userPath);
} else if (fs.existsSync(primaryEnvPath)) {
  dotenv.config({ path: primaryEnvPath });
  console.log('[loadEnv] Loaded primary:', primaryEnvPath);
} else {
  console.warn('[loadEnv] Primary .env not found:', primaryEnvPath);
}

// 2) If Google id missing, parse primary file line-by-line fallback (BOM / odd formatting)
if (!process.env.GOOGLE_CLIENT_ID && fs.existsSync(primaryEnvPath)) {
  try {
    const parsed = dotenv.parse(fs.readFileSync(primaryEnvPath, 'utf8'));
    if (mergeGoogleFromParsed(parsed)) {
      console.log('[loadEnv] GOOGLE_CLIENT_ID from manual parse of primary .env');
    }
  } catch (e) {
    console.error('[loadEnv] Manual parse primary failed:', e.message);
  }
}

// 3) Merge from other locations (do not let an empty cwd .env block us — we only add missing keys)
const extraPaths = [
  userPath && userPath !== primaryEnvPath ? userPath : null,
  path.join(process.cwd(), 'flywell-logistics-backend', '.env'),
  path.join(process.cwd(), 'backend', '.env'),
  path.join(process.cwd(), '.env')
].filter((p, i, arr) => p && fs.existsSync(p) && arr.indexOf(p) === i);

for (const p of extraPaths) {
  if (process.env.GOOGLE_CLIENT_ID) break;
  if (p === primaryEnvPath) continue;
  try {
    dotenv.config({ path: p, override: false });
    const parsed = dotenv.parse(fs.readFileSync(p, 'utf8'));
    if (mergeGoogleFromParsed(parsed)) {
      console.log('[loadEnv] GOOGLE_CLIENT_ID from:', p);
      break;
    }
  } catch (e) {
    console.error('[loadEnv] skip', p, e.message);
  }
}

// 4) Hardcoded fallback — only if still empty (lets Google login work until .env is fixed on server)
if (!process.env.GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID_FALLBACK) {
  process.env.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID_FALLBACK;
  console.warn(
    '[loadEnv] GOOGLE_CLIENT_ID was empty — using built-in fallback. Add to .env and remove fallback when stable.'
  );
}

const gid = process.env.GOOGLE_CLIENT_ID;
if (gid) {
  console.log(
    `[loadEnv] GOOGLE_CLIENT_ID ok (len=${gid.length}) ${gid.slice(0, 8)}...${gid.slice(-6)}`
  );
} else {
  console.warn(
    '[loadEnv] GOOGLE_CLIENT_ID still empty. On the server run:\n' +
      `  echo 'GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com' >> ${primaryEnvPath}\n` +
      'Or set env in PM2: DOTENV_CONFIG_PATH=/full/path/to/.env'
  );
}

function ensureGoogleClientIdLoaded() {
  if (process.env.GOOGLE_CLIENT_ID) return;
  if (fs.existsSync(primaryEnvPath)) {
    try {
      const parsed = dotenv.parse(fs.readFileSync(primaryEnvPath, 'utf8'));
      if (mergeGoogleFromParsed(parsed)) {
        console.log('[loadEnv] ensureGoogleClientIdLoaded: fixed from', primaryEnvPath);
        return;
      }
    } catch (e) {
      console.error('[loadEnv] ensureGoogleClientIdLoaded:', e.message);
    }
  }
  if (!process.env.GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID_FALLBACK) {
    process.env.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID_FALLBACK;
  }
}

module.exports = { ensureGoogleClientIdLoaded, primaryEnvPath };
