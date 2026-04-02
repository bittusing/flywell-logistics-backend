const { OAuth2Client } = require('google-auth-library');

/**
 * OAuth Web Client ID(s) from env — comma-separated if you use more than one
 * (e.g. old + new client, or typo fix) so token `aud` matches one of them.
 */
function getGoogleAudienceList() {
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

  // Use primary Web client ID in constructor (matches Google’s own samples; avoids edge-case failures).
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
