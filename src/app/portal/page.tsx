"use client";

import { api } from "~/trpc/react";
import { useUser } from "@clerk/nextjs";
import {
    FileText,
    Clock,
    CheckCircle,
    Download,
    ThumbsUp,
    Loader2,
    Lock,
} from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { toast } from "sonner";

function getRiskColor(risk: string | null) {
    if (risk === "high") return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30";
    if (risk === "medium") return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
    return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30";
}

function getStatusLabel(status: string) {
    const map: Record<string, string> = {
        processing: "Processing",
        review_needed: "Under Review",
        verified: "Verified",
        in_progress: "In Progress",
        approval_pending: "Awaiting Your Approval",
        approved: "Approved ✓",
        closed: "Closed",
    };
    return map[status] ?? status;
}

function formatDate(d: string | Date | null | undefined) {
    if (!d) return "—";
    return new Date(d as string).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function formatAmount(paise: number | null) {
    if (!paise) return "—";
    return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default function ClientPortalPage() {
    const { user, isLoaded } = useUser();
    const clientId = user?.publicMetadata?.clientId as string | undefined;

    const { data: notices, isLoading } = api.clients.listNoticesForClient.useQuery(
        { clientId: clientId! },
        { enabled: !!clientId }
    );

    const approveMutation = api.notice.approveResponse.useMutation({
        onSuccess: () => toast.success("Response approved! Your CA has been notified."),
        onError: () => toast.error("Failed to approve response"),
    });

    if (!isLoaded || isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-12 w-48" />
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
            </div>
        );
    }

    if (!clientId) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <Lock className="mb-4 h-12 w-12 text-muted-foreground/30" />
                <p className="text-lg font-semibold text-foreground">Portal Not Configured</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    Your account is not linked to a client entity. Please contact your CA for access.
                </p>
            </div>
        );
    }

    const pending = notices?.filter(n => n.status === "approval_pending") ?? [];
    const active = notices?.filter(n => !["closed", "approved", "approval_pending"].includes(n.status)) ?? [];
    const historical = notices?.filter(n => ["closed", "approved"].includes(n.status)) ?? [];

    return (
        <div className="space-y-8">
            {/* Welcome */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">
                    Welcome, {user?.firstName ?? "Client"} 👋
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Your compliance notices — read-only view managed by your CA
                </p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Total Notices", value: notices?.length ?? 0, highlight: false },
                    { label: "Action Required", value: pending.length, highlight: pending.length > 0 },
                    { label: "Closed", value: historical.length, highlight: false },
                ].map((s) => (
                    <div
                        key={s.label}
                        className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20" : "border-border bg-card"}`}
                    >
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className={`mt-0.5 text-2xl font-bold ${s.highlight ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                            {s.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Approval Pending — Story 4.4 */}
            {pending.length > 0 && (
                <section>
                    <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
                        <ThumbsUp className="h-5 w-5 text-amber-500" />
                        Awaiting Your Approval
                    </h2>
                    <div className="space-y-3">
                        {pending.map((notice) => (
                            <Card key={notice.id} className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/10">
                                <CardContent className="flex items-center justify-between gap-4 p-4">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-foreground">{notice.noticeType ?? notice.fileName ?? "Notice"}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {notice.authority ?? "—"} · Deadline: {formatDate(notice.deadline)} · {formatAmount(notice.amount)}
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="shrink-0 bg-green-600 text-white hover:bg-green-700"
                                        onClick={() => approveMutation.mutate({ id: notice.id })}
                                        disabled={approveMutation.isPending}
                                    >
                                        {approveMutation.isPending
                                            ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                            : <CheckCircle className="mr-1.5 h-4 w-4" />
                                        }
                                        Approve
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>
            )}

            {/* Active Notices — Story 4.3 */}
            <section>
                <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
                    <Clock className="h-5 w-5 text-primary" />
                    Active Notices ({active.length})
                </h2>
                {active.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border py-10 text-center">
                        <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">No active notices</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {active.map((notice) => (
                            <Card key={notice.id} className="border-border">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold text-foreground">{notice.noticeType ?? notice.fileName ?? "Notice"}</p>
                                                <Badge variant="outline" className={`text-[10px] ${getRiskColor(notice.riskLevel)}`}>
                                                    {notice.riskLevel ?? "low"} risk
                                                </Badge>
                                            </div>
                                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                                                <span>Authority: <span className="font-medium text-foreground">{notice.authority ?? "—"}</span></span>
                                                <span>Deadline: <span className="font-medium text-foreground">{formatDate(notice.deadline)}</span></span>
                                                <span>Amount: <span className="font-medium text-foreground">{formatAmount(notice.amount)}</span></span>
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-2">
                                            <Badge variant="secondary" className="text-[10px]">
                                                {getStatusLabel(notice.status)}
                                            </Badge>
                                            {notice.fileUrl && (
                                                <a href={notice.fileUrl} target="_blank" rel="noopener noreferrer">
                                                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                                                        <Download className="h-3.5 w-3.5" /> PDF
                                                    </Button>
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </section>

            {/* Historical */}
            {historical.length > 0 && (
                <section>
                    <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
                        <Lock className="h-5 w-5 text-muted-foreground" />
                        Historical ({historical.length})
                    </h2>
                    <div className="space-y-2">
                        {historical.map((notice) => (
                            <div key={notice.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-2.5">
                                <div>
                                    <p className="text-sm font-medium text-foreground">{notice.noticeType ?? notice.fileName ?? "Notice"}</p>
                                    <p className="text-xs text-muted-foreground">{notice.authority ?? "—"} · {formatDate(notice.createdAt)}</p>
                                </div>
                                <Badge variant="outline" className="text-[10px]">{getStatusLabel(notice.status)}</Badge>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
