import "dotenv/config";
import { getPresignedUrl } from "../src/server/services/storage";

async function main() {
    // Test with a real notice ID from DB
    const noticeId = "notice_1772954573090_9ul7es";
    const s3Key = `user_39xltCPscXXLj4JyQpR0HvlZhpo/${noticeId}/notice_drc01_attachment.pdf`;
    const url = await getPresignedUrl(s3Key, 60);
    console.log("✅ Presigned URL generated:");
    console.log(url);
    console.log("\n🔍 Endpoint check:", url.includes("ap-south-1") ? "✅ Has ap-south-1 region" : "❌ Missing regional endpoint!");
}
main().catch(console.error).finally(() => process.exit(0));
