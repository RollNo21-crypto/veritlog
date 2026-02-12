import { type Config } from "drizzle-kit";

import { env } from "~/env";

export default {
    schema: "./src/server/db/schema.ts",
    dialect: "sqlite", // D1 is SQLite
    out: "./drizzle",
    driver: "d1-http",
    dbCredentials: {
        accountId: "YOUR_CLOUDFLARE_ACCOUNT_ID",
        databaseId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        token: "YOUR_CLOUDFLARE_API_TOKEN",
    },
} satisfies Config;
