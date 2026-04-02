const { OAuth2Client } = require('google-auth-library');

/**
 * Verifies a Google ID token (JWT) from the client and returns the payload.
 * @param {string} idToken
 * @returns {Promise<import('google-auth-library').TokenPayload>}
 */
async function verifyGoogleIdToken(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured on the server');
  }

  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Invalid Google token payload');
  }

  return payload;
}

module.exports = verifyGoogleIdToken;
