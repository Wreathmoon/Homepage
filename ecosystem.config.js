module.exports = {
  apps: [
    {
      name: 'api-server',
      script: './server/app.js',
      cwd: '/data/quotation-app/Homepage',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      log_file: './logs/api-server.log',
      error_file: './logs/api-server-error.log',
      out_file: './logs/api-server-out.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'ai-server',
      script: './server.js',
      cwd: '/data/quotation-app/Homepage',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      log_file: './logs/ai-server.log',
      error_file: './logs/ai-server-error.log',
      out_file: './logs/ai-server-out.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G'
    }
  ]
}; 