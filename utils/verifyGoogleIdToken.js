const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { OAuth2Client } = require('google-auth-library');

/**
 * PM2 / old dotenv often loads .env from process cwd (e.g. /home/ubuntu), not from
 * backend/.env — so GOOGLE_CLIENT_ID stays empty. Read backend/.env via __dirname
 * (always points at this project folder) and merge into process.env.
 */
function ensureGoogleClientIdFromBackendEnvFile() {
  if (process.env.GOOGLE_CLIENT_ID) {
    return;
  }
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }
  try {
    const parsed = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
    const raw = parsed.GOOGLE_CLIENT_ID;
    if (raw) {
      process.env.GOOGLE_CLIENT_ID = String(raw)
        .trim()
        .replace(/\r/g, '')
        .replace(/^["']|["']$/g, '');
      console.log(
        '[verifyGoogleIdToken] GOOGLE_CLIENT_ID loaded from file:',
        envPath,
        `(len=${process.env.GOOGLE_CLIENT_ID.length})`
      );
    }
  } catch (e) {
    console.error('[verifyGoogleIdToken] Could not parse .env at', envPath, e.message);
  }
}

/**
 * OAuth Web Client ID(s) from env — comma-separated if you use more than one
 * (e.g. old + new client, or typo fix) so token `aud` matches one of them.
 */
function getGoogleAudienceList() {
  ensureGoogleClientIdFromBackendEnvFile();

  const raw = process.env.GOOGLE_CLIENT_ID || '';
  return raw
    .split(',')
    .map((id) =>
      id
        .trim()
        .replace(/\r/g, '')
        .replace(/^["']|["']$/g, '')
    )
    .filter(Boolean);
}

/**
 * Verifies a Google ID token (JWT) from the client and returns the payload.
 * @param {string} idToken
 */
async function verifyGoogleIdToken(idToken) {
  const audiences = getGoogleAudienceList();
  if (audiences.length === 0) {
    throw new Error('GOOGLE_CLIENT_ID is not configured on the server');
  }

  const client = new OAuth2Client(audiences[0]);
  const audience = audiences.length === 1 ? audiences[0] : audiences;

  const ticket = await client.verifyIdToken({
    idToken,
    audience
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Invalid Google token payload');
  }

  return payload;
}

module.exports = verifyGoogleIdToken;
module.exports.getGoogleAudienceList = getGoogleAudienceList;
module.exports.ensureGoogleClientIdFromBackendEnvFile = ensureGoogleClientIdFromBackendEnvFile;
