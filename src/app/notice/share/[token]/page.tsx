"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
    AlertTriangle,
    Clock,
    CheckCircle,
    Lock,
    FileText,
    Loader2,
    Shield,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

type NoticeSummary = {
    id: string;
    noticeType: string | null;
    authority: string | null;
    amount: number | null;
    deadline: string | null;
    status: string;
    riskLevel: string | null;
    summary: string | null;
};

function getRiskColor(risk: string | null) {
    if (risk === "high") return "border-red-500/50 bg-red-50 dark:bg-red-950/20";
    if (risk === "medium") return "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20";
    return "border-green-500/50 bg-green-50 dark:bg-green-950/20";
}

function getRiskBadge(risk: string | null) {
    if (risk === "high") return "bg-red-500/15 text-red-600 dark:text-red-400";
    if (risk === "medium") return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    return "bg-green-500/15 text-green-600 dark:text-green-400";
}

function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { dateStyle: "long" });
}

function daysLeft(d: string | null) {
    if (!d) return null;
    const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
    return days;
}

function formatAmount(paise: number | null) {
    if (!paise) return "—";
    return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

const STATUS_LABEL: Record<string, string> = {
    processing: "Processing",
    review_needed: "Under Review",
    in_progress: "In Progress",
    verified: "Verified",
    approval_pending: "Awaiting Approval",
    approved: "Approved",
    closed: "Closed",
};

export default function NoticeSharePage() {
    const params = useParams();
    const token = params.token as string;

    const [notice, setNotice] = useState<NoticeSummary | null>(null);
    const [exp, setExp] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/notice/share/${token}`);
                const data = await res.json() as { notice?: NoticeSummary; exp?: number; error?: string };
                if (!res.ok) {
                    setError(data.error ?? "Failed to load notice");
                } else {
                    setNotice(data.notice ?? null);
                    setExp(data.exp ?? null);
                }
            } catch {
                setError("Network error. Please try again.");
            } finally {
                setLoading(false);
            }
        }
        void load();
    }, [token]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
                <Lock className="h-12 w-12 text-destructive/40" />
                <h1 className="text-xl font-bold text-foreground">Link Expired or Invalid</h1>
                <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
                <p className="text-xs text-muted-foreground">Contact your CA to request a new link.</p>
            </div>
        );
    }

    if (!notice) return null;

    const days = daysLeft(notice.deadline);
    const isUrgent = days !== null && days <= 3;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-8">
            {/* Header */}
            <div className="mx-auto max-w-lg">
                <div className="mb-6 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
                        <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm font-bold uppercase tracking-wider text-foreground">VERITLOG</p>
                        <p className="text-[10px] text-muted-foreground">Notice Summary</p>
                    </div>
                </div>

                {/* Risk banner */}
                <div className={`mb-4 rounded-2xl border p-5 ${getRiskColor(notice.riskLevel)}`}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <h1 className="text-lg font-bold text-foreground">
                                    {notice.noticeType ?? "Tax Notice"}
                                </h1>
                                <Badge className={`${getRiskBadge(notice.riskLevel)} border-0 text-xs`}>
                                    {notice.riskLevel?.toUpperCase() ?? "LOW"} RISK
                                </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {notice.authority ?? "Issuing Authority"}
                            </p>
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0">
                            {STATUS_LABEL[notice.status] ?? notice.status}
                        </Badge>
                    </div>
                </div>

                {/* Key facts */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* Deadline */}
                    <div className={`rounded-xl border p-4 ${isUrgent ? "border-red-500/30 bg-red-50 dark:bg-red-950/10" : "border-border bg-card"}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                            {isUrgent
                                ? <AlertTriangle className="h-4 w-4 text-red-500" />
                                : <Clock className="h-4 w-4 text-muted-foreground" />
                            }
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deadline</span>
                        </div>
                        <p className="font-bold text-foreground">{formatDate(notice.deadline)}</p>
                        {days !== null && (
                            <p className={`text-xs mt-0.5 font-medium ${isUrgent ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                                {days <= 0 ? "OVERDUE" : `${days} days left`}
                            </p>
                        )}
                    </div>

                    {/* Amount */}
                    <div className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</span>
                        </div>
                        <p className="font-bold text-foreground text-lg">{formatAmount(notice.amount)}</p>
                    </div>
                </div>

                {/* AI Summary */}
                {notice.summary && (
                    <div className="mb-4 rounded-xl border border-border bg-card p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">AI Summary</p>
                        <p className="text-sm text-foreground leading-relaxed">{notice.summary}</p>
                    </div>
                )}

                {/* CTA for approval_pending */}
                {notice.status === "approval_pending" && (
                    <div className="rounded-xl border border-green-500/30 bg-green-50 dark:bg-green-950/20 p-4 text-center">
                        <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-500" />
                        <p className="font-semibold text-foreground mb-1">Response Ready for Your Approval</p>
                        <p className="text-xs text-muted-foreground mb-3">
                            Your CA has drafted a response. Log in to the Client Portal to review and approve.
                        </p>
                        <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => window.location.href = "/portal"}
                        >
                            Open Client Portal →
                        </Button>
                    </div>
                )}

                {/* Link expiry note */}
                {exp && (
                    <p className="mt-6 text-center text-[11px] text-muted-foreground">
                        This link expires on {new Date(exp).toLocaleDateString("en-IN", { dateStyle: "long" })}.
                        Contact your CA for a new link after expiry.
                    </p>
                )}
            </div>
        </div>
    );
}
