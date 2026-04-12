const axios = require('axios');

/**
 * Mailgun HTTP API — used for password reset and future transactional mail.
 * https://documentation.mailgun.com/en/latest/api-sending.html#sending
 */
class EmailService {
  getConfig() {
    const apiKey = process.env.MAIL_API_KEY || process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    const baseUrl =
      (process.env.MAILGUN_API_BASE_URL || 'https://api.mailgun.net/v3').replace(/\/$/, '');

    return { apiKey, domain, baseUrl };
  }

  isConfigured() {
    const { apiKey, domain } = this.getConfig();
    return Boolean(apiKey && domain);
  }

  /**
   * Low-level send — use for any future templates (notifications, receipts, etc.).
   * @param {{ to: string, subject: string, text?: string, html?: string, from?: string }} opts
   */
  async sendMessage(opts) {
    const { to, subject, text, html } = opts;
    const { apiKey, domain, baseUrl } = this.getConfig();

    const from =
      opts.from ||
      process.env.MAILGUN_FROM ||
      'Flywell Logistics <no-reply@verification.flywelllogistics.com>';

    if (!apiKey || !domain) {
      console.warn(
        '[EmailService] Mailgun not configured. Set MAIL_API_KEY and MAILGUN_DOMAIN in .env'
      );
      return { sent: false };
    }

    const url = `${baseUrl}/${domain}/messages`;

    const body = new URLSearchParams();
    body.append('from', from);
    body.append('to', to);
    body.append('subject', subject);
    if (text) body.append('text', text);
    if (html) body.append('html', html);

<<<<<<< HEAD
    try {
      const response = await axios.post(url, body.toString(), {
        auth: {
          username: 'api',
          password: apiKey
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      });

      console.log(`[EmailService] SUCCESS: Message sent to ${to}. ID: ${response.data?.id}`);
      return { sent: true, id: response.data?.id };
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;
      console.error(`[EmailService] FAILED to send email to ${to}:`, {
        status,
        message: data?.message || error.message,
        details: data
      });
      return { sent: false, error: data?.message || error.message };
    }
=======
    await axios.post(url, body.toString(), {
      auth: {
        username: 'api',
        password: apiKey
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    return { sent: true };
>>>>>>> e173c96881d6134e0904d3ff749bc7ec6eb3cc5a
  }

  /**
   * @param {string} to
   * @param {string} resetUrl
   */
  async sendPasswordResetEmail(to, resetUrl) {
    const subject = 'Reset your Flywell Logistics password';
    const text = `You requested a password reset. Open this link to set a new password (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`;
    const html = `<p>You requested a password reset.</p><p><a href="${resetUrl}">Reset your password</a> (link valid for 1 hour)</p><p>If you did not request this, you can ignore this email.</p>`;

    return this.sendMessage({ to, subject, text, html });
  }
}

module.exports = new EmailService();
