"use client";

import { api } from "~/trpc/react";
import {
    BarChart3,
    CheckCircle,
    AlertTriangle,
    FileSearch,
    TrendingUp,
    Clock,
    Users,
    Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Separator } from "~/components/ui/separator";

function MetricCard({
    title,
    value,
    sub,
    icon,
    loading,
    highlight,
}: {
    title: string;
    value: string | number;
    sub?: string;
    icon: React.ReactNode;
    loading: boolean;
    highlight?: "green" | "yellow" | "red";
}) {
    const borderColor =
        highlight === "green"
            ? "border-green-500/40"
            : highlight === "yellow"
                ? "border-yellow-500/40"
                : highlight === "red"
                    ? "border-destructive/40"
                    : "";
    return (
        <Card className={borderColor}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                {loading ? (
                    <Skeleton className="h-8 w-20" />
                ) : (
                    <>
                        <p className="text-3xl font-bold text-foreground">{value}</p>
                        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default function AnalyticsPage() {
    const { data: stats, isLoading } = api.notice.stats.useQuery();
    const { data: notices, isLoading: noticesLoading } = api.notice.list.useQuery();

    // Derived metrics
    const total = stats?.total ?? 0;
    const verified = stats?.verified ?? 0;
    const highRisk = stats?.highRisk ?? 0;
    const reviewNeeded = stats?.reviewNeeded ?? 0;
    const closed = stats?.closed ?? 0;
    const inProgress = stats?.inProgress ?? 0;

    const verifiedRate = total > 0 ? Math.round((verified / total) * 100) : 0;
    const highRiskRate = total > 0 ? Math.round((highRisk / total) * 100) : 0;

    // Confidence breakdown
    const highConf = notices?.filter((n) => n.confidence === "high").length ?? 0;
    const medConf = notices?.filter((n) => n.confidence === "medium").length ?? 0;
    const lowConf = notices?.filter((n) => n.confidence === "low").length ?? 0;
    const aiAccuracy = total > 0 ? Math.round(((highConf + medConf * 0.7) / Math.max(total, 1)) * 100) : 0;

    // Risk breakdown
    const mediumRisk = notices?.filter((n) => n.riskLevel === "medium").length ?? 0;
    const lowRisk = notices?.filter((n) => n.riskLevel === "low" || !n.riskLevel).length ?? 0;

    // Notice type breakdown
    const typeMap: Record<string, number> = {};
    notices?.forEach((n) => {
        const t = n.noticeType ?? "Unknown";
        typeMap[t] = (typeMap[t] ?? 0) + 1;
    });
    const topTypes = Object.entries(typeMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">
                    Analytics
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    AI accuracy, notice volume, and risk breakdown
                </p>
            </div>

            {/* Primary KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title="Total Notices"
                    value={total}
                    icon={<FileSearch className="h-5 w-5 text-primary" />}
                    loading={isLoading}
                />
                <MetricCard
                    title="Verification Rate"
                    value={`${verifiedRate}%`}
                    sub={`${verified} of ${total} verified`}
                    icon={<CheckCircle className="h-5 w-5 text-green-500" />}
                    loading={isLoading}
                    highlight="green"
                />
                <MetricCard
                    title="High Risk"
                    value={highRisk}
                    sub={`${highRiskRate}% of total`}
                    icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
                    loading={isLoading}
                    highlight={highRisk > 0 ? "red" : undefined}
                />
                <MetricCard
                    title="AI Accuracy Score"
                    value={`${aiAccuracy}%`}
                    sub="Weighted by confidence level"
                    icon={<TrendingUp className="h-5 w-5 text-primary" />}
                    loading={noticesLoading}
                    highlight={aiAccuracy >= 80 ? "green" : aiAccuracy >= 50 ? "yellow" : "red"}
                />
            </div>

            {/* Secondary KPIs */}
            <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                    title="Pending Review"
                    value={reviewNeeded}
                    icon={<Clock className="h-5 w-5 text-yellow-500" />}
                    loading={isLoading}
                    highlight={reviewNeeded > 0 ? "yellow" : undefined}
                />
                <MetricCard
                    title="In Progress"
                    value={inProgress}
                    icon={<Activity className="h-5 w-5 text-primary" />}
                    loading={isLoading}
                />
                <MetricCard
                    title="Closed"
                    value={closed}
                    icon={<Users className="h-5 w-5 text-muted-foreground" />}
                    loading={isLoading}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* AI Confidence Breakdown */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">AI Confidence Breakdown</CardTitle>
                        <CardDescription>Distribution of extraction confidence levels</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {noticesLoading ? (
                            <div className="space-y-3">
                                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
                            </div>
                        ) : total === 0 ? (
                            <p className="text-sm text-muted-foreground">No data yet</p>
                        ) : (
                            <>
                                {[
                                    { label: "High", count: highConf, color: "bg-green-500" },
                                    { label: "Medium", count: medConf, color: "bg-yellow-500" },
                                    { label: "Low", count: lowConf, color: "bg-destructive" },
                                ].map(({ label, count, color }) => {
                                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                    return (
                                        <div key={label} className="space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-foreground">{label}</span>
                                                <span className="text-muted-foreground">{count} ({pct}%)</span>
                                            </div>
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className={`h-full rounded-full ${color}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Risk Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Risk Distribution</CardTitle>
                        <CardDescription>Breakdown of notices by risk level</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isLoading || noticesLoading ? (
                            <div className="space-y-3">
                                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
                            </div>
                        ) : total === 0 ? (
                            <p className="text-sm text-muted-foreground">No data yet</p>
                        ) : (
                            <>
                                {[
                                    { label: "High Risk", count: highRisk, color: "bg-destructive" },
                                    { label: "Medium Risk", count: mediumRisk, color: "bg-yellow-500" },
                                    { label: "Low Risk", count: lowRisk, color: "bg-green-500" },
                                ].map(({ label, count, color }) => {
                                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                    return (
                                        <div key={label} className="space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-foreground">{label}</span>
                                                <span className="text-muted-foreground">{count} ({pct}%)</span>
                                            </div>
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className={`h-full rounded-full ${color}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Notice Status Pipeline */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Workflow Pipeline</CardTitle>
                        <CardDescription>Current notices across all workflow stages</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-3">
                                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {[
                                    { label: "Processing", value: stats?.processing ?? 0, badge: "outline" as const },
                                    { label: "Review Needed", value: reviewNeeded, badge: "secondary" as const },
                                    { label: "In Progress", value: inProgress, badge: "secondary" as const },
                                    { label: "Verified", value: verified, badge: "default" as const },
                                    { label: "Closed", value: closed, badge: "outline" as const },
                                ].map(({ label, value, badge }) => (
                                    <div key={label} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                                        <span className="text-sm text-foreground">{label}</span>
                                        <Badge variant={badge}>{value}</Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Top Notice Types */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Top Notice Types</CardTitle>
                        <CardDescription>Most common AI-extracted notice categories</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {noticesLoading ? (
                            <div className="space-y-3">
                                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                            </div>
                        ) : topTypes.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No notices yet</p>
                        ) : (
                            <div className="space-y-2">
                                {topTypes.map(([type, count]) => (
                                    <div key={type} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                                        <span className="line-clamp-1 text-sm text-foreground">{type}</span>
                                        <Badge variant="outline">{count}</Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
