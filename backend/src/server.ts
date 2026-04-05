import "dotenv/config";
import { loadEnv } from "./config/env";
import { connectDatabase } from "./config/database";
import { createApp } from "./app";
import { startReminderWorker, closeReminderQueue } from "./queues/reminders";

async function main() {
  const env = loadEnv();
  await connectDatabase(env.MONGODB_URI, env.NODE_ENV);

  const app = createApp();
  const server = app.listen(env.PORT, async () => {
    console.log(`TenantOS API listening on port ${env.PORT} (${env.NODE_ENV})`);
    try {
      await startReminderWorker();
    } catch (e) {
      console.error("[reminders] failed to start", e);
    }
  });

  const shutdown = async () => {
    console.log("Shutting down...");
    server.close();
    await closeReminderQueue();
    const { disconnectDatabase } = await import("./config/database");
    await disconnectDatabase();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
