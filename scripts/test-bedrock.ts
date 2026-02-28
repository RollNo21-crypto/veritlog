import "dotenv/config";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const testBedrock = async () => {
    console.log("🤖 Initializing AWS Bedrock Client...");

    // Check for credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error("❌ Missing AWS Access Keys in .env");
        process.exit(1);
    }

    const client = new BedrockRuntimeClient({
        region: "us-east-1",
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });

    console.log(`📡 Sending test message to Bedrock (Region: us-east-1)...`);

    // We'll test with the model specified in extraction.ts (Amazon Nova Pro)
    const modelId = "us.amazon.nova-pro-v1:0";

    try {
        const command = new ConverseCommand({
            modelId,
            messages: [
                {
                    role: "user",
                    content: [{ text: "Respond with exactly the word 'SUCCESS' if you receive this message." }]
                }
            ],
        });

        const response = await client.send(command);
        const outputText = response.output?.message?.content?.[0]?.text;

        console.log(`✅ Bedrock Response Received: "${outputText}"`);
        console.log("🎉 Bedrock is fully configured and working!");
        process.exit(0);
    } catch (error: any) {
        console.error("❌ Bedrock API Error:");
        console.error(error.message || error);

        if (error.name === "AccessDeniedException") {
            console.error("\n👉 This means your AWS IAM User does not have the 'AmazonBedrockFullAccess' permission policy attached, OR the API keys are invalid.");
        } else if (error.name === "ValidationException" && error.message.includes("modelId")) {
            console.error(`\n👉 This means you don't have access to the model '${modelId}'. You may need to request access in the AWS Bedrock console.`);
        }
        process.exit(1);
    }
};

testBedrock();
