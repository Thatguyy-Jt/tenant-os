import mongoose from "mongoose";
import type { Env } from "./env";

export async function connectDatabase(uri: string, env: Env["NODE_ENV"]): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  if (env === "development") {
    mongoose.set("debug", false);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
