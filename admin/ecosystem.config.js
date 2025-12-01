module.exports = {
  apps: [{
    name: 'docker-mirror',
    script: 'index.js',
    cwd: '/var/www/docker-mirror',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'production',
      PORT: 3100
    },
    error_file: '/var/log/docker-mirror/error.log',
    out_file: '/var/log/docker-mirror/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
