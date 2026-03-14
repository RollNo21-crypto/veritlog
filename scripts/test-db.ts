import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config();

async function testDatabase() {
    console.log("=== Testing RDS Database Connection ===");

    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error("❌ DATABASE_URL is not set in .env");
        return;
    }

    // Mask password for logging
    const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':***@');
    console.log("Connecting to:", maskedUrl);

    try {
        // Connect using the driver
        const sql = postgres(databaseUrl, {
            ssl: 'require',     // Necessary for AWS RDS
            max: 1,
            idle_timeout: 5     // Don't hang if idle
        });

        const result = await sql`SELECT version()`;

        console.log("\n✅ Database Connection Successful!");
        console.log("PostgreSQL Version:", result[0].version);

        // Ensure we close the connection
        await sql.end();
    } catch (error) {
        console.error("\n❌ Database Connection Failed:");
        console.error(error);
    }
}

testDatabase();
