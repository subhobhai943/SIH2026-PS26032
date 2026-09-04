module.exports = {
  apps: [
    {
      name: 'sih-backend',
      script: 'src/index.js',
      instances: 'max', // Automatically spin up one worker process per CPU core for load balancing
      exec_mode: 'cluster', // PM2 built-in round-robin load balancer
      watch: false,
      max_memory_restart: '350M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      // Zero-downtime rolling reload settings
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true,
    },
  ],
};
