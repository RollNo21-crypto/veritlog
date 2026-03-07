import "dotenv/config";
import { db } from "../src/server/db/index";
import { tenants, clients, notices } from "../src/server/db/schema";
import { uploadToS3 } from "../src/server/services/storage";
import { PDFDocument, rgb } from "pdf-lib";

async function createMockPdf(title: string, summary: string): Promise<ArrayBuffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    page.drawText(title, { x: 50, y: 350, size: 24, color: rgb(0.8, 0.1, 0.1) });
    page.drawText(summary, { x: 50, y: 300, size: 12, color: rgb(0, 0, 0) });
    page.drawText("CONFIDENTIAL - SYSTEM GENERATED MOCK", { x: 50, y: 50, size: 10, color: rgb(0.5, 0.5, 0.5) });
    const pdfBytes = await pdfDoc.save();
    return (pdfBytes.buffer as ArrayBuffer).slice(pdfBytes.byteOffset, pdfBytes.byteLength + pdfBytes.byteOffset);
}

const seed = async () => {
    console.log("🌱 Starting database seeding...");

    const targetEmail = "gokarnkark09@gmail.com";
    console.log(`🔍 Looking up Clerk User ID for ${targetEmail}...`);

    const clerkRes = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(targetEmail)}`, {
        headers: {
            Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`
        }
    });

    if (!clerkRes.ok) {
        throw new Error(`Failed to fetch from Clerk API: ${clerkRes.status} ${clerkRes.statusText}`);
    }

    const clerkUsers = (await clerkRes.json()) as any[];
    if (!clerkUsers || clerkUsers.length === 0) {
        console.error(`❌ User with email ${targetEmail} not found in your Clerk project.`);
        console.error(`Please make sure you have created an account with that email first!`);
        process.exit(1);
    }

    const tenantId = clerkUsers[0].id;
    console.log(`✅ Found Clerk User! Using ID: ${tenantId}`);

    // Clear existing data (optional, careful in prod!)
    await db.delete(notices);
    await db.delete(clients);
    await db.delete(tenants);

    await db.insert(tenants).values({
        id: tenantId,
        name: "Demo CA Firm",
        plan: "pro",
    });
    console.log("✅ Created Tenant");

    // 2. Create some sample clients
    const client1Id = "client_1001";
    const client2Id = "client_1002";
    const client3Id = "client_1003";

    await db.insert(clients).values([
        {
            id: client1Id,
            tenantId,
            businessName: "Acme Corp India",
            gstin: "27ABCDE1234F1Z5",
            pan: "ABCDE1234F",
            contactName: "Rahul Sharma",
            contactEmail: "rahul@acme.in",
        },
        {
            id: client2Id,
            tenantId,
            businessName: "TechNova Solutions",
            gstin: "15XYZAB9876C1Z2",
            pan: "XYZAB9876C",
            contactName: "Priya Patel",
            contactEmail: "priya@technova.in",
        },
        {
            id: client3Id,
            tenantId,
            businessName: "Global Exports Ltd",
            gstin: "07PQRST5432R1Z9",
            pan: "PQRST5432R",
            contactName: "Amit Singh",
        }
    ]);
    console.log("✅ Created Clients");

    // 3. Create realistic sample notices with ACTUAL S3 PDFs
    console.log("📄 Generating and uploading mock PDF documents to S3...");

    const mockNotices = [
        {
            id: "notice_881",
            tenantId,
            clientId: client1Id,
            fileName: "gst_show_cause_march2024.pdf",
            title: "GST Show Cause Notice",
            authority: "GST Department, Maharashtra",
            noticeType: "Show Cause Notice",
            amount: 55000000,
            deadline: "2024-04-15",
            section: "Section 73 of CGST Act",
            financialYear: "2023-24",
            summary: "Demand of INR 5.5L for mismatch in ITC claimed in GSTR-3B vs GSTR-2B.",
            confidence: "high",
            riskLevel: "high",
            status: "review_needed",
            source: "upload",
        },
        {
            id: "notice_882",
            tenantId,
            clientId: client2Id,
            fileName: "income_tax_demand_ay22_23.pdf",
            title: "Income Tax Demand",
            authority: "Income Tax Department",
            noticeType: "Demand Notice",
            amount: 1500000,
            deadline: "2024-03-30",
            section: "Section 143(1)(a)",
            financialYear: "2021-22",
            summary: "Intimation under section 143(1) highlighting a minor tax discrepancy.",
            confidence: "high",
            riskLevel: "low",
            status: "verified",
            source: "email",
        },
        {
            id: "notice_883",
            tenantId,
            clientId: client1Id,
            fileName: "customs_query_import_dec.pdf",
            title: "Customs Query Memo",
            authority: "Customs Authority, Nhava Sheva",
            noticeType: "Query Memo",
            amount: null,
            deadline: "2024-03-25",
            section: "Section 17 of Customs Act",
            financialYear: null,
            summary: "Query raised regarding classification of imported machinery parts.",
            confidence: "medium",
            riskLevel: "medium",
            status: "processing",
            source: "upload",
        },
        {
            id: "notice_884",
            tenantId,
            clientId: client3Id,
            fileName: "pf_compliance_delay.pdf",
            title: "EPFO Compliance Alert",
            authority: "EPFO",
            noticeType: "Compliance Notice",
            amount: 4500000,
            deadline: "2024-05-10",
            section: "Section 14B of EPF Act",
            financialYear: "2023-24",
            summary: "Notice for delayed remittance of PF dues for October 2023.",
            confidence: "low",
            riskLevel: "high",
            status: "in_progress",
            source: "email",
        }
    ];

    const finalNotices = [];
    for (const notice of mockNotices) {
        // Generate a real binary PDF
        const pdfBuffer = await createMockPdf(notice.title, notice.summary);
        const objectKey = `${tenantId}/${notice.id}/${notice.fileName}`;

        // Upload to configured S3 bucket
        const uploadResult = await uploadToS3(objectKey, pdfBuffer, "application/pdf");
        console.log(`  Uploaded ${notice.fileName} -> ${uploadResult.fileUrl}`);

        const { title, ...dbNotice } = notice;
        finalNotices.push({
            ...dbNotice,
            fileUrl: uploadResult.fileUrl // Use the actual proxy URL hooked up to real S3
        });
    }

    await db.insert(notices).values(finalNotices);
    console.log("✅ Created Sample Notices");

    console.log("🎉 Seeding complete! You can now view this data in the Dashboard UI.");
    process.exit(0);
};

seed().catch((e) => {
    console.error("❌ Seeding failed:");
    console.error(e);
    process.exit(1);
});
