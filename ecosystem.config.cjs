module.exports = {
  apps: [
    {
      name: "molding-mis-api",
      script: "server/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1024M",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
    },
  ],
};
