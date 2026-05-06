module.exports = {
  apps: [
    {
      name: 'whatsapp-bot',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,                      // Single instance (WhatsApp only allows one connection)
      autorestart: true,                 // Auto-restart on crash
      watch: false,                      // Don't watch files in production
      max_memory_restart: '512M',        // Restart if memory exceeds 512MB
      restart_delay: 5000,               // Wait 5s before restarting after a crash
      max_restarts: 20,                  // Max 20 restarts before giving up
      min_uptime: 15000,                 // Must run for 15s to be considered stable
      exp_backoff_restart_delay: 1000,   // Exponential backoff: doubles delay on each consecutive crash
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
      },
      // Logging — PM2 level (app also writes to its own logs/app.log via Winston)
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Log rotation (requires: pm2 install pm2-logrotate)
      // Configure with: pm2 set pm2-logrotate:max_size 10M
      //                  pm2 set pm2-logrotate:retain 7
      //                  pm2 set pm2-logrotate:compress true
    },
  ],
};
