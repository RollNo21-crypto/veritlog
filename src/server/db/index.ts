import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * AWS / Standard Node.js database connection via postgres-js.
 * DATABASE_URL should be a standard PostgreSQL connection string, e.g.:
 *   postgresql://user:password@rds-hostname:5432/veritlog
 *
 * For local development, use a local Postgres instance (see docker-compose.yml).
 */
const client = postgres(process.env.DATABASE_URL!, {
    // Disable prefetch as it's not supported for Drizzle transactions
    prepare: false,
});

export const db = drizzle(client, { schema });
