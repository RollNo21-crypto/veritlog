import { db } from "../src/server/db";
import { notices } from "../src/server/db/schema";

async function testQuery() {
    try {
        console.log("Testing DB Query...");
        const result = await db.select().from(notices).limit(1);
        console.log("Success! Query result:", result);
    } catch (error) {
        console.error("Test Error:", error);
    }
}

testQuery();
