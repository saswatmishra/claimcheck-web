import postgres from "postgres";

let client = null;

export class Database {
  static get url() {
    return process.env.DATABASE_URL;
  }

  static get sql() {
    if (!Database.url) {
      throw new Error("DATABASE_URL is not configured");
    }

    if (!client) {
      client = postgres(Database.url, {
        ssl: "require",
        max: Number(process.env.DATABASE_POOL_MAX || 5),
        idle_timeout: Number(process.env.DATABASE_IDLE_TIMEOUT || 20),
        connect_timeout: Number(process.env.DATABASE_CONNECT_TIMEOUT || 10),
      });
    }

    return client;
  }

  static async healthcheck() {
    const rows = await Database.sql`select 1 as ok`;
    return rows[0]?.ok === 1;
  }

  static async close() {
    if (!client) return;
    await client.end({ timeout: 5 });
    client = null;
  }
}
