"use client";

import { api } from "~/trpc/react";
import {
    Activity,
    CheckCircle,
    Percent,
    AlertTriangle,
    Clock,
    Shield,
    TrendingUp,
    FileText,
    Lock,
    UserCheck,
    ThumbsUp,
    Loader2,
    Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Progress } from "~/components/ui/progress";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: Date | string | null | undefined) {
    if (!d) return "—";
    return new Date(d as string).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    "notice.created": { label: "Notice Created", color: "bg-primary/15 text-primary" },
    "notice.verified": { label: "Verified", color: "bg-green-500/15 text-green-600 dark:text-green-400" },
    "notice.assigned": { label: "Assigned", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
    "notice.closed": { label: "Closed", color: "bg-muted text-muted-foreground" },
    "notice.updated": { label: "Fields Updated", color: "bg-muted text-muted-foreground" },
    "notice.approved": { label: "Approved", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    "notice.template_issue_flagged": { label: "Issue Flagged", color: "bg-destructive/15 text-destructive" },
};

const STATUS_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    processing: { label: "Processing", icon: Loader2, color: "text-muted-foreground" },
    review_needed: { label: "Review Needed", icon: AlertTriangle, color: "text-amber-500" },
    in_progress: { label: "In Progress", icon: Clock, color: "text-primary" },
    verified: { label: "Verified", icon: CheckCircle, color: "text-green-500" },
    approval_pending: { label: "Pending Approval", icon: ThumbsUp, color: "text-blue-500" },
    approved: { label: "Approved", icon: ThumbsUp, color: "text-emerald-500" },
    closed: { label: "Closed", icon: Lock, color: "text-muted-foreground" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, iconColor }: {
    label: string; value: string | number; sub?: string;
    icon: React.ElementType; iconColor: string;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className={`h-4 w-4 ${iconColor}`} />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
                {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
            </CardContent>
        </Card>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OpsDashboardPage() {
    const { data: stats, isLoading } = api.stats.opsDashboard.useQuery(undefined, {
        refetchInterval: 30_000,
    });

    if (isLoading) {
        return (
            <div className="space-y-6 p-1">
                <div className="grid gap-4 md:grid-cols-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-64 rounded-xl" />
                    <Skeleton className="h-64 rounded-xl" />
                </div>
                <Skeleton className="h-72 rounded-xl" />
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
                Failed to load statistics.
            </div>
        );
    }

    const total = stats.totalProcessed;
    const statusEntries = Object.entries(stats.statusBreakdown ?? {});
    const { high, medium, low, none } = stats.riskBreakdown ?? { high: 0, medium: 0, low: 0, none: 0 };
    const riskTotal = high + medium + low + none || 1;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Ops Dashboard</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Live AI extraction accuracy, pipeline health and operational throughput — auto-refreshes every 30s
                </p>
            </div>

            {/* KPI Row */}
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                <KpiCard
                    label="Total Notices"
                    value={total}
                    sub="Active in system"
                    icon={FileText}
                    iconColor="text-primary"
                />
                <KpiCard
                    label="AI Trust Score"
                    value={`${stats.globalAccuracy}%`}
                    sub="High-confidence extractions"
                    icon={Percent}
                    iconColor={stats.globalAccuracy >= 80 ? "text-green-500" : stats.globalAccuracy >= 50 ? "text-amber-500" : "text-destructive"}
                />
                <KpiCard
                    label="HIGH RISK Notices"
                    value={high}
                    sub={`${Math.round((high / riskTotal) * 100)}% of total`}
                    icon={AlertTriangle}
                    iconColor="text-destructive"
                />
                <KpiCard
                    label="Top Authority"
                    value={stats.authorities[0]?.name ?? "—"}
                    sub={stats.authorities[0] ? `${stats.authorities[0].accuracyPercent}% accuracy` : "No data"}
                    icon={TrendingUp}
                    iconColor="text-primary"
                />
            </div>

            {/* Mid row: Pipeline + Risk */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Pipeline Status Funnel */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Pipeline Status</CardTitle>
                        <CardDescription>How notices are distributed across workflow stages</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {statusEntries.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground py-8">No notices in system</p>
                        ) : (
                            statusEntries
                                .sort(([, a], [, b]) => b - a)
                                .map(([status, count]) => {
                                    const meta = STATUS_META[status] ?? { label: status, icon: Activity, color: "text-muted-foreground" };
                                    const Icon = meta.icon;
                                    const pct = Math.round((count / total) * 100);
                                    return (
                                        <div key={status}>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                                                    <span className="text-sm font-medium text-foreground">{meta.label}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground">{pct}%</span>
                                                    <span className="text-sm font-bold text-foreground w-6 text-right">{count}</span>
                                                </div>
                                            </div>
                                            <Progress value={pct} className="h-1.5" />
                                        </div>
                                    );
                                })
                        )}
                    </CardContent>
                </Card>

                {/* Risk Distribution */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Risk Distribution</CardTitle>
                        <CardDescription>Notices by calculated risk level (deadline + amount)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-3 mb-4">
                            {[
                                { label: "High", val: high, color: "bg-red-500", text: "text-red-600 dark:text-red-400" },
                                { label: "Medium", val: medium, color: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
                                { label: "Low", val: low, color: "bg-green-500", text: "text-green-600 dark:text-green-400" },
                                { label: "None", val: none, color: "bg-muted-foreground/40", text: "text-muted-foreground" },
                            ].map((r) => (
                                <div key={r.label} className="flex-1 text-center rounded-xl border border-border py-3">
                                    <p className={`text-2xl font-bold ${r.text}`}>{r.val}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{r.label}</p>
                                </div>
                            ))}
                        </div>
                        {/* Stacked bar */}
                        <div className="flex h-3 w-full overflow-hidden rounded-full">
                            {[
                                { val: high, color: "bg-red-500" },
                                { val: medium, color: "bg-amber-400" },
                                { val: low, color: "bg-green-500" },
                                { val: none, color: "bg-muted" },
                            ].map((r, i) =>
                                r.val > 0 ? (
                                    <div
                                        key={i}
                                        className={`${r.color} transition-all`}
                                        style={{ width: `${Math.round((r.val / riskTotal) * 100)}%` }}
                                    />
                                ) : null
                            )}
                        </div>

                        {/* Recent Activity feed */}
                        <div className="mt-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Recent Activity</p>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                {stats.recentEvents.length === 0 ? (
                                    <p className="text-xs text-muted-foreground py-2 text-center">No events yet</p>
                                ) : stats.recentEvents.map((ev) => {
                                    const meta = ACTION_LABELS[ev.action] ?? { label: ev.action.replace(/[._]/g, " "), color: "bg-muted text-muted-foreground" };
                                    return (
                                        <div key={ev.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted/40 transition-colors">
                                            <Badge className={`${meta.color} shrink-0 border-0 text-[10px] font-medium`}>
                                                {meta.label}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDate(ev.createdAt)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Accuracy by Authority table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        <CardTitle className="text-base">AI Accuracy by Issuing Authority</CardTitle>
                    </div>
                    <CardDescription>
                        High-confidence extraction rate per authority. Below 50% signals an unrecognised template — flag for retraining.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">Issuing Authority</TableHead>
                                <TableHead className="text-right">Notices</TableHead>
                                <TableHead className="w-[35%] text-right">AI Accuracy</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.authorities.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                        No authority data yet. Upload notices to populate this table.
                                    </TableCell>
                                </TableRow>
                            ) : stats.authorities.map((auth) => {
                                const pct = auth.accuracyPercent;
                                const barColor = pct < 50
                                    ? "bg-red-100 dark:bg-red-950/30 [&>div]:bg-red-500"
                                    : pct < 80
                                        ? "bg-amber-100 dark:bg-amber-950/30 [&>div]:bg-amber-500"
                                        : "bg-green-100 dark:bg-green-950/30 [&>div]:bg-emerald-500";

                                return (
                                    <TableRow key={auth.name}>
                                        <TableCell className="font-medium">{auth.name}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">{auth.totalNotices}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-end gap-3">
                                                <div className="flex-1 max-w-[120px]">
                                                    <Progress value={pct} className={`h-2 ${barColor}`} />
                                                </div>
                                                <span className={`w-9 font-mono text-xs font-semibold ${pct < 50 ? "text-red-600 dark:text-red-400" : pct < 80 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                                    {pct}%
                                                </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
