/**
 * PM2: copy to ecosystem.config.js and set GOOGLE_CLIENT_ID, then:
 *   pm2 start ecosystem.config.js
 * Use this if .env is not deployed to the server (e.g. only env vars in PM2).
 */
module.exports = {
  apps: [
    {
      name: 'flywell-backend',
      script: 'server.js',
      cwd: '/home/ubuntu/flywell-logistics-backend',
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        GOOGLE_CLIENT_ID: '174263048488-rgrphiihpk0em96r26atmoun9lan4shc.apps.googleusercontent.com'
      }
    }
  ]
};
