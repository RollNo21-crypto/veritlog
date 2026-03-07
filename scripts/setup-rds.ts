// @ts-nocheck
import "dotenv/config";
import { RDSClient, DescribeDBInstancesCommand } from "@aws-sdk/client-rds";
import { EC2Client, AuthorizeSecurityGroupIngressCommand } from "@aws-sdk/client-ec2";

const setupRDS = async () => {
    console.log("🚀 Starting Automatic AWS RDS Networking Setup...");

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error("❌ Missing AWS Credentials in .env");
        process.exit(1);
    }

    const region = process.env.AWS_REGION || "ap-south-1";

    const rds = new RDSClient({
        region,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });

    const ec2 = new EC2Client({
        region,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });

    try {
        console.log(`🔍 Scanning for PostgreSQL RDS instances in ${region}...`);
        const { DBInstances } = await rds.send(new DescribeDBInstancesCommand({}));

        if (!DBInstances || DBInstances.length === 0) {
            console.error("❌ No RDS instances found in your account.");
            process.exit(1);
        }

        const db = DBInstances.find((instance: any) => instance.Engine?.includes("postgres"));
        if (!db) {
            console.error("❌ No PostgreSQL RDS instances found.");
            process.exit(1);
        }

        console.log(`✅ Found PostgreSQL Database: ${db.DBInstanceIdentifier}`);
        console.log(`🌍 Endpoint: ${db.Endpoint?.Address}:${db.Endpoint?.Port}`);
        console.log(`🔓 Publicly Accessible: ${db.PubliclyAccessible ? 'YES' : 'NO (Required for Vercel/Local dev to connect!)'}`);

        if (db.VpcSecurityGroups && db.VpcSecurityGroups.length > 0) {
            const sgId = db.VpcSecurityGroups[0].VpcSecurityGroupId;
            console.log(`🛡️ Modifying VPC Security Group: ${sgId} to allow Vercel and local connections...`);

            try {
                await ec2.send(new AuthorizeSecurityGroupIngressCommand({
                    GroupId: sgId,
                    IpPermissions: [
                        {
                            IpProtocol: "tcp",
                            FromPort: 5432,
                            ToPort: 5432,
                            IpRanges: [{ CidrIp: "0.0.0.0/0", Description: "Allow anywhere (Vercel/Local Desktop connection)" }]
                        }
                    ]
                }));
                console.log("✅ Firewall opened for Postgres port 5432 inside the VPC Security Group!");
            } catch (sgError: any) {
                if (sgError.name === "InvalidPermission.Duplicate") {
                    console.log("✅ Firewall already open for port 5432!");
                } else {
                    console.error("⚠️ Failed to modify Security Group:", sgError.message);
                }
            }
        }

        console.log("\n🎉 RDS NETWORKING SETUP COMPLETE! 🎉");

        if (!db.PubliclyAccessible) {
            console.log("\n⚠️ ACTION REQUIRED: Your database is currently blocked from being accessed from the internet.");
            console.log("If your Next.js app is going to be deployed to Vercel, you must click one button in AWS:");
            console.log("1. Go to AWS RDS -> Databases -> click your instance.");
            console.log("2. Click 'Modify'.");
            console.log("3. Under 'Connectivity', expand 'Additional configuration', and change 'Publicly accessible' to 'Yes'.");
            console.log("4. Click 'Continue' and 'Apply immediately'.");
        }

        console.log("\n=========================================");
        console.log(`Please update the DATABASE_URL your .env file with this format:`);
        console.log(`postgresql://<YOUR_DB_USERNAME>:<YOUR_DB_PASSWORD>@${db.Endpoint?.Address}:${db.Endpoint?.Port}/<DB_NAME>?sslmode=require`);
        console.log("=========================================\n");

    } catch (error: any) {
        console.error("❌ Failed to scan RDS:", error.message);
    }
};

setupRDS();
