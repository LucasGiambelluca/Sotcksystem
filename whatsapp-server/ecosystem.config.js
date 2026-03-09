module.exports = {
  apps: [
    {
      name: 'whatsapp-bot',
      script: 'dist/index.js',          // Compiled JS output
      cwd: __dirname,
      instances: 1,                      // Single instance (WhatsApp only allows one connection)
      autorestart: true,                 // Auto-restart on crash
      watch: false,                      // Don't watch files in production
      max_memory_restart: '512M',        // Restart if memory exceeds 512MB (safety net)
      restart_delay: 3000,               // Wait 3s before restarting after a crash
      max_restarts: 15,                  // Max 15 restarts in a row before giving up
      min_uptime: 10000,                 // Must run for 10s to be considered stable
      env: {
        NODE_ENV: 'production',
      },
      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
