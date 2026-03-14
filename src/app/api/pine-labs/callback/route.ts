import { type NextRequest, NextResponse } from "next/server";

/**
 * GET/POST /api/pine-labs/callback
 * 
 * Pine Labs redirects back to this URL after payment. 
 * We handle this here to avoid conflicts with the GET-only /[id] page.
 */
export async function POST(req: NextRequest) {
    return handleCallback(req);
}

export async function GET(req: NextRequest) {
    return handleCallback(req);
}

async function handleCallback(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    let noticeId = searchParams.get("noticeId");
    let plOrderId = searchParams.get("pl_order_id");

    // Extract from body if POST (from form-data)
    if (req.method === "POST") {
        try {
            const formData = await req.formData();
            plOrderId = plOrderId || (formData.get("pl_order_id") as string) || (formData.get("order_id") as string);
            noticeId = noticeId || (formData.get("noticeId") as string);
        } catch {
            // Not form data
        }
    }

    if (!noticeId) {
        return new NextResponse("Notice ID missing in callback", { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
    const redirectUrl = new URL(`${appUrl}/pay/${noticeId}`);

    if (plOrderId) {
        redirectUrl.searchParams.set("pl_order_id", plOrderId);
        redirectUrl.searchParams.set("pl_status", "SUCCESS"); // Hint for UI verification
    }

    // 303 See Other for POST-to-GET redirect
    return NextResponse.redirect(redirectUrl.toString(), 303);
}
