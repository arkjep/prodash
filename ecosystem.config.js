module.exports = {
  apps: [{
    name: 'prodash',
    script: './index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3006
    },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '300M',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
