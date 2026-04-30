// PM2 ecosystem for the litellm OpenAI-compat proxy. Keep this app
// separate from labhub-app so the chatbot backend can be
// reloaded/replaced without affecting the main site.
//
// Start with:
//   pm2 start services/litellm/ecosystem.litellm.config.js
//   pm2 save
//
// Requires CHATBOT_KEY and CHATBOT_MODEL set in /home/dgu/research_dashboard/.env.local
require('dotenv').config({ path: '/home/dgu/research_dashboard/.env.local' });

module.exports = {
  apps: [
    {
      name: 'litellm-proxy',
      cwd: '/home/dgu/research_dashboard',
      script: '/home/dgu/litellm-proxy/venv/bin/litellm',
      args: '--config services/litellm/config.yaml --host 127.0.0.1 --port 4001',
      interpreter: 'none',
      env: {
        CHATBOT_KEY: process.env.CHATBOT_KEY ?? '',
        CHATBOT_MODEL: process.env.CHATBOT_MODEL ?? '',
        LITELLM_MASTER_KEY: process.env.LITELLM_MASTER_KEY ?? 'sk-local-only',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 5000,
    },
  ],
};
