import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

async function testS3() {
    console.log("=== Testing S3 ===");
    console.log("AWS_REGION:", process.env.AWS_REGION);
    console.log("S3_BUCKET_NAME:", process.env.S3_BUCKET_NAME);

    try {
        const s3 = new S3Client({
            region: process.env.AWS_REGION || "ap-south-1",
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });

        const command = new ListObjectsV2Command({
            Bucket: process.env.S3_BUCKET_NAME!,
            MaxKeys: 1
        });

        const response = await s3.send(command);
        console.log("✅ S3 Connection Successful!");
        console.log("Found objects:", response.Contents?.length || 0);
    } catch (error) {
        console.error("❌ S3 Connection Failed:");
        console.error(error);
    }
}

async function testBedrock() {
    console.log("\n=== Testing Bedrock ===");
    try {
        const bedrock = new BedrockRuntimeClient({
            region: "us-east-1",
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });

        const command = new ConverseCommand({
            modelId: "us.amazon.nova-pro-v1:0",
            system: [{ text: "You are a test bot." }],
            messages: [{ role: "user", content: [{ text: "Say hello!" }] }],
            inferenceConfig: { temperature: 0.1, maxTokens: 10 },
        });

        const response = await bedrock.send(command);
        console.log("✅ Bedrock Connection Successful!");
        console.log("Response:", response.output?.message?.content?.[0]?.text);
    } catch (error) {
        console.error("❌ Bedrock Connection Failed:");
        console.error(error);
    }
}

async function run() {
    await testS3();
    await testBedrock();
}

run();
