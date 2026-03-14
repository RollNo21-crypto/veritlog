"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import {
    ShieldCheck,
    Lock,
    Loader2,
    AlertTriangle,
    Building2,
    Calendar,
    XCircle,
    RefreshCcw,
    User,
    Mail,
    Phone,
    MapPin,
    Smartphone,
    CheckCircle2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { toast } from "sonner";

/**
 * /pay/[noticeId]
 *
 * Unidirectional flow:
 *   1. User fills billing details and clicks "Pay"
 *   2. We call POST /api/pine-labs/create-order → get checkoutUrl
 *   3. Browser redirects to Pine Labs hosted checkout page
 *   4. Pine Labs POSTs back to /api/pine-labs/callback (server-side)
 *      └── callback verifies, closes notice, writes audit log
 *      └── On SUCCESS → redirects to /api/notice/[id]/audit-report
 *      └── On FAILURE → redirects back here with ?pl_status=FAILED
 *   5. If ?pl_status=FAILED → show retry screen
 *
 * This page NEVER calls the verify API — that is entirely handled server-side in callback.
 */
export default function PublicPaymentPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const noticeId = params.id as string;
    const paymentFailed = searchParams.get("pl_status") === "FAILED";

    const [isProcessing, setIsProcessing] = useState(false);

    // Form state
    const [customerName, setCustomerName] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [billingAddress1, setBillingAddress1] = useState("");
    const [billingCity, setBillingCity] = useState("");
    const [billingState, setBillingState] = useState("");
    const [billingPincode, setBillingPincode] = useState("");

    const { data: notice, isLoading, error } = api.notice.getPublicDetails.useQuery({ id: noticeId });

    // ── Loading ──────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
                    <p className="text-sm font-medium text-slate-600 font-mono tracking-tight">
                        SECURE PAYMENT CHANNEL INITIALIZING...
                    </p>
                </div>
            </div>
        );
    }

    // ── Error / Not Found ────────────────────────────────────────────────────
    if (error || !notice) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50 p-6">
                <Card className="max-w-md w-full border-red-100 shadow-xl shadow-red-900/5">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                        <CardTitle className="text-xl text-slate-900">Payment Link Expired</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center text-slate-600 pb-8">
                        This payment request is no longer active or the notice could not be found.
                        Please contact your Chartered Accountant for a new link.
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ── Already Paid ─────────────────────────────────────────────────────────
    // Notice is closed in DB — prevent any further action
    if (notice.status === "closed") {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50 p-6">
                <div className="max-w-md w-full text-center rounded-2xl bg-white p-8 shadow-2xl border border-emerald-50">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Already Paid</h1>
                    <p className="text-slate-600 mb-6 leading-relaxed">
                        This notice from <strong>{notice.authority}</strong> has already been resolved and marked closed.
                        No further payment is required.
                    </p>
                    <Button
                        variant="outline"
                        className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                        onClick={() => window.open(`/api/notice/${noticeId}/audit-report`, "_blank")}
                    >
                        View Audit Report
                    </Button>
                </div>
            </div>
        );
    }

    // ── Payment Failed / Cancelled State ─────────────────────────────────────
    // Pine Labs redirected back with ?pl_status=FAILED
    if (paymentFailed) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50 p-6">
                <div className="max-w-md w-full">
                    <div className="rounded-2xl bg-white p-8 shadow-2xl border border-red-50 text-center">
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                            <XCircle className="h-10 w-10 text-red-500" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment Unsuccessful</h1>
                        <p className="text-slate-600 mb-8 leading-relaxed">
                            Your payment was not completed. No amount has been charged.
                            Please try again or contact your CA.
                        </p>
                        <Button
                            className="w-full h-12 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 flex items-center justify-center gap-2"
                            onClick={() => window.location.href = `/pay/${noticeId}`}
                        >
                            <RefreshCcw className="h-4 w-4" />
                            Try Again
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Main Payment Page ─────────────────────────────────────────────────────
    const handlePayment = async () => {
        if (!notice?.clientId) {
            if (!customerName || !customerEmail || !customerPhone || !billingAddress1 || !billingCity || !billingState || !billingPincode) {
                toast.error("Please fill in all billing details.");
                return;
            }
        }

        setIsProcessing(true);
        const toastId = toast.loading("Connecting to Pine Labs Secure Gateway...");

        try {
            const res = await fetch("/api/pine-labs/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    noticeId,
                    customerName,
                    customerEmail,
                    customerPhone,
                    billingAddress1,
                    billingCity,
                    billingState,
                    billingPincode,
                }),
            });

            if (!res.ok) {
                const errData = (await res.json()) as { error?: string };
                throw new Error(errData.error ?? `Server error (${res.status})`);
            }

            const data = (await res.json()) as { checkoutUrl: string; orderId: string };
            toast.success("Redirecting to secure checkout...", { id: toastId });

            // Hand off to Pine Labs hosted checkout
            // After payment, Pine Labs will POST to /api/pine-labs/callback
            // which handles everything server-side and issues the final redirect.
            window.location.href = data.checkoutUrl;
        } catch (err) {
            console.error("[PayPage] Order creation failed:", err);
            toast.error(
                err instanceof Error ? err.message : "Failed to connect to payment gateway",
                { id: toastId }
            );
            setIsProcessing(false);
        }
        // Note: do NOT reset isProcessing on success — the page will navigate away
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-6">
            <header className="mb-12 text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-lg">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <span className="text-2xl font-black tracking-tighter text-slate-900 uppercase">Veritlog</span>
                </div>
                <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Secure Client Payment Terminal</p>
            </header>

            <main className="max-w-lg w-full">
                <Card className="border-none shadow-2xl bg-white overflow-hidden rounded-2xl">
                    <div className="h-2 bg-emerald-600 w-full" />
                    <CardHeader className="p-8 pb-0">
                        <div className="flex justify-between items-start mb-6">
                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider border-slate-200 text-slate-500">
                                Demand Notice Resolution
                            </Badge>
                            <div className="text-xs font-mono text-slate-400 uppercase tracking-tighter">
                                ID: {noticeId.slice(0, 12)}
                            </div>
                        </div>
                        <CardTitle className="text-2xl font-extrabold text-slate-900">
                            Penalty Payment
                        </CardTitle>
                        <p className="text-slate-500 text-sm mt-1">
                            Issued by {notice.authority}
                        </p>
                    </CardHeader>

                    <CardContent className="p-8">
                        <div className="space-y-6">
                            {/* Amount Summary Box */}
                            <div className="rounded-xl bg-slate-900 p-6 text-white shadow-lg">
                                <div className="flex justify-between items-center mb-1 text-slate-400 text-xs uppercase font-bold tracking-widest">
                                    <span>Amount Demanded</span>
                                    <Building2 className="h-3 w-3" />
                                </div>
                                <div className="text-3xl font-black tracking-tight">
                                    ₹{notice.amount ? (notice.amount / 100).toLocaleString("en-IN") : "0"}
                                </div>
                                <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-1.5 opacity-80">
                                        <Calendar className="h-3 w-3" />
                                        <span>Deadline: {notice.deadline || "NA"}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-tighter text-emerald-400 italic">
                                        <ShieldCheck className="h-3 w-3" />
                                        Pine Labs Escrow
                                    </div>
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-400 tracking-widest uppercase px-1">
                                    Payment Method
                                </label>
                                <div className="border-2 border-indigo-600 bg-indigo-50/50 p-4 rounded-xl ring-2 ring-indigo-600/10 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 bg-white rounded-lg shadow-sm border border-indigo-100 flex items-center justify-center">
                                            <Smartphone className="h-5 w-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">UPI / Cards / Net Banking</p>
                                            <p className="text-[10px] text-slate-500">Powered by Pine Labs Plural 🛡️</p>
                                        </div>
                                    </div>
                                    <div className="h-5 w-5 rounded-full border-[6px] border-indigo-600" />
                                </div>
                            </div>

                            {/* Billing Details Form — only shown when notice has no linked client */}
                            {!notice.clientId && (
                                <div className="space-y-4 pt-6 border-t border-slate-100">
                                    <div className="flex items-center gap-2 mb-4">
                                        <User className="h-4 w-4 text-indigo-600" />
                                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Billing Details</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="customerName" className="text-xs text-slate-500">Full Name</Label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                                <Input id="customerName" placeholder="John Doe" className="pl-9" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="customerPhone" className="text-xs text-slate-500">Phone Number</Label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                                <Input id="customerPhone" placeholder="9999999999" className="pl-9" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label htmlFor="customerEmail" className="text-xs text-slate-500">Email Address</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                                <Input id="customerEmail" type="email" placeholder="john@example.com" className="pl-9" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label htmlFor="billingAddress1" className="text-xs text-slate-500">Street Address</Label>
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                                <Input id="billingAddress1" placeholder="123 Main St" className="pl-9" value={billingAddress1} onChange={(e) => setBillingAddress1(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="billingCity" className="text-xs text-slate-500">City</Label>
                                            <Input id="billingCity" placeholder="Mumbai" value={billingCity} onChange={(e) => setBillingCity(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="billingState" className="text-xs text-slate-500">State</Label>
                                            <Input id="billingState" placeholder="Maharashtra" value={billingState} onChange={(e) => setBillingState(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="billingPincode" className="text-xs text-slate-500">Pincode</Label>
                                            <Input id="billingPincode" placeholder="400001" value={billingPincode} onChange={(e) => setBillingPincode(e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>

                    <CardFooter className="p-8 pt-0 flex flex-col gap-4">
                        <Button
                            className="w-full h-14 bg-slate-900 text-white text-lg font-bold rounded-xl shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                            onClick={handlePayment}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Opening Secure Checkout...
                                </>
                            ) : (
                                <>
                                    Pay ₹{notice.amount ? (notice.amount / 100).toLocaleString("en-IN") : "0"} via Pine Labs
                                </>
                            )}
                        </Button>
                        <div className="flex items-center justify-center gap-2 text-slate-400">
                            <Lock className="h-3 w-3" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">
                                PCI-DSS 4.0 Secure Gateway · Pine Labs Plural
                            </span>
                        </div>
                    </CardFooter>
                </Card>

                <div className="mt-8 flex items-center justify-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-600 tracking-tighter uppercase">Fraud Protection Active</span>
                </div>
            </main>

            <footer className="mt-auto pt-12 text-slate-400 text-[10px] font-medium uppercase tracking-widest text-center">
                © 2026 Veritlog Technologies Private Limited. All Rights Reserved.
            </footer>
        </div>
    );
}
