module.exports = {
  apps: [
    {
      name: 'wss-backend',
      script: './Backend/server.js',
      instances: 'max', // Utilizes all available CPU cores for clustering
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8000
      },
      watch: false,
      max_memory_restart: '1G',
      error_file: './Logs/err.log',
      out_file: './Logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
