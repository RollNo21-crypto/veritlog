import "dotenv/config";
import {
    S3Client,
    CreateBucketCommand,
    PutBucketCorsCommand,
    PutPublicAccessBlockCommand,
    HeadBucketCommand
} from "@aws-sdk/client-s3";

const setupS3 = async () => {
    console.log("🚀 Starting Automatic AWS S3 Setup...");

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error("❌ Missing AWS Credentials in .env");
        process.exit(1);
    }

    const region = process.env.AWS_REGION || "ap-south-1";
    // Using exactly the name the user requested
    const bucketName = "veritlog-notices-mumbai";

    const s3 = new S3Client({
        region,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });

    try {
        // 1. Create the Bucket
        console.log(`📦 Creating Bucket: ${bucketName} in ${region}...`);
        await s3.send(new CreateBucketCommand({
            Bucket: bucketName,
            CreateBucketConfiguration: region === "us-east-1" ? undefined : {
                LocationConstraint: region as any
            }
        }));
        console.log("✅ Bucket created successfully!");

        // 2. Block Public Access (Security First!)
        console.log("🔒 Securing bucket (Blocking public access)...");
        await s3.send(new PutPublicAccessBlockCommand({
            Bucket: bucketName,
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: true,
                IgnorePublicAcls: true,
                BlockPublicPolicy: true,
                RestrictPublicBuckets: true,
            }
        }));
        console.log("✅ Bucket secured!");

        // 3. Set CORS policy (Required for uploading from the browser later if using presigned URLs)
        console.log("🌐 Setting CORS policy...");
        await s3.send(new PutBucketCorsCommand({
            Bucket: bucketName,
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedHeaders: ["*"],
                        AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
                        AllowedOrigins: ["*"], // Restrict this to actual domains in production!
                        ExposeHeaders: ["ETag"],
                        MaxAgeSeconds: 3000
                    }
                ]
            }
        }));
        console.log("✅ CORS policy configured!");

        console.log("\n🎉 S3 SETUP COMPLETE! 🎉");
        console.log("=========================================");
        console.log(`Update your .env file with this exactly:`);
        console.log(`S3_BUCKET_NAME="${bucketName}"`);
        console.log("=========================================\n");

    } catch (error: any) {
        if (error.name === "BucketAlreadyExists" || error.name === "BucketAlreadyOwnedByYou") {
            console.error(`❌ Bucket name '${bucketName}' is already taken globally. Please run the script again to generate a new random suffix.`);
        } else {
            console.error("❌ Failed to set up S3:", error);
        }
    }
};

setupS3();
