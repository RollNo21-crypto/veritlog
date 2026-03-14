
import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function migrate() {
    try {
        console.log("Starting manual migration...");

        // 1. Update notices.amount to bigint
        console.log("Updating notices.amount to bigint...");
        await sql`ALTER TABLE "notices" ALTER COLUMN "amount" TYPE bigint;`;

        // 2. Create payments table
        console.log("Creating payments table...");
        await sql`
            CREATE TABLE IF NOT EXISTS "payments" (
                "id" text PRIMARY KEY NOT NULL,
                "notice_id" text NOT NULL,
                "tenant_id" text NOT NULL,
                "order_id" text NOT NULL,
                "amount" bigint NOT NULL,
                "status" text NOT NULL,
                "payment_method" text,
                "raw_response" jsonb,
                "created_at" timestamp DEFAULT now() NOT NULL
            );
        `;

        // 3. Add foreign keys for payments
        console.log("Adding foreign keys for payments...");
        try {
            await sql`ALTER TABLE "payments" ADD CONSTRAINT "payments_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE no action ON UPDATE no action;`;
        } catch (e) { console.log("FK notice_id might already exist"); }

        try {
            await sql`ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;`;
        } catch (e) { console.log("FK tenant_id might already exist"); }

        console.log("✅ Manual migration successful!");
    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        await sql.end();
        process.exit(0);
    }
}

migrate();
