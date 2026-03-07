import { db } from "../src/server/db/index";
import * as schema from "../src/server/db/schema";
import { eq } from "drizzle-orm";

async function run() {
    await db.update(schema.notices)
        .set({
            summary: "GST Department issued a show cause notice regarding discrepancies found in GSTR-3B vs GSTR-2A for the financial year.",
            nextSteps: "• Review the notice thoroughly against filed returns\n• Reconcile ITC claimed with GSTR-2A\n• Prepare a comprehensive draft reply with evidence",
            requiredDocuments: "• Complete GSTR-2A/2B reconciliations\n• Original purchase invoices for the disputed amount\n• Bank statements showing payment to corresponding suppliers",
        })
        .where(eq(schema.notices.id, "notice_1772772720941_6vsxro"));

    console.log("Updated notice_1772772720941_6vsxro with AI data");
    process.exit(0);
}

run();
