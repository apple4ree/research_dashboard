module.exports = {
  apps: [
    {
      name: 'labhub-app',
      cwd: '/home/dgu/research_dashboard',
      script: './node_modules/next/dist/bin/next',
      args: 'start --port 3000',
      interpreter: 'node',
      env: { NODE_ENV: 'production' },
      max_restarts: 10,
      restart_delay: 2000,
      kill_timeout: 10000,
    },
  ],
};
