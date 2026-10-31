// PM2 process file for the VPS:  pm2 start deploy/ecosystem.config.cjs && pm2 save
//
// Run exactly ONE instance (fork mode). Live updates (Server-Sent Events) and the
// scheduler (reminders, upload cleanup) live inside this process.
module.exports = {
  apps: [
    {
      name: "klyron-crm",
      cwd: __dirname + "/..",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      exec_mode: "fork",
      instances: 1,
      env: { NODE_ENV: "production" },
      max_memory_restart: "1G",
      time: true,
    },
    {
      name: "klyron-mail",
      cwd: __dirname + "/..",
      script: "haraka/node_modules/.bin/haraka",
      args: "-c haraka",
      exec_mode: "fork",
      instances: 1,
      env: { NODE_ENV: "production" },
      max_memory_restart: "512M",
      time: true,
    },
    {
      // Nightly database + uploads backup at 03:00 server time (scripts/backup.mjs).
      name: "klyron-backup",
      cwd: __dirname + "/..",
      script: "scripts/backup.mjs",
      node_args: "--env-file=.env",
      cron_restart: "0 3 * * *",
      autorestart: false,
      time: true,
    },
  ],
}
