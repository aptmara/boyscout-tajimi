/**
 * PM2 設定ファイル
 * VPSでのアプリケーション管理に使用
 * 
 * 使用方法:
 *   pm2 start ecosystem.config.js
 *   pm2 reload ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: 'boyscout-tajimi',
      script: 'src/server/server.js',
      cwd: '/var/www/boyscout-tajimi',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        INITIAL_ADMIN_USERNAME: 'admin',
        INITIAL_ADMIN_PASSWORD: 'password123'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        INITIAL_ADMIN_USERNAME: 'admin',
        INITIAL_ADMIN_PASSWORD: 'password123'
      },
      // ログ設定
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/www/boyscout-tajimi/logs/error.log',
      out_file: '/var/www/boyscout-tajimi/logs/out.log',
      merge_logs: true,
      // 再起動設定
      restart_delay: 4000,
      kill_timeout: 5000
    }
  ]
};
