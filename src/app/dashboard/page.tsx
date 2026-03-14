"use client";

import { api } from "~/trpc/react";
import Link from "next/link";
import {
    Upload,
    FileSearch,
    BarChart3,
    AlertTriangle,
    Clock,
    CheckCircle,
    ArrowRight,
    Loader2,
    TrendingUp,
    ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Separator } from "~/components/ui/separator";

export default function DashboardPage() {
    const { data: stats, isLoading: statsLoading } = api.notice.stats.useQuery();
    const { data: recentNotices, isLoading: noticesLoading, refetch } = api.notice.list.useQuery();
    const { data: exposure, isLoading: exposureLoading } = api.stats.financialExposure.useQuery();

    const fmt = (n: number) => n >= 100000
        ? `₹${(n / 100000).toFixed(1)}L`
        : `₹${n.toLocaleString("en-IN")}`;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">
                    Dashboard
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Track your tax notices and performance
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Notices"
                    value={stats?.total}
                    icon={<FileSearch className="h-5 w-5 text-primary" />}
                    loading={statsLoading}
                />
                <StatCard
                    title="Pending Review"
                    value={stats?.reviewNeeded}
                    icon={<Clock className="h-5 w-5 text-yellow-500" />}
                    loading={statsLoading}
                    highlight={!!stats?.reviewNeeded && stats.reviewNeeded > 0}
                />
                <StatCard
                    title="HIGH RISK"
                    value={stats?.highRisk}
                    icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
                    loading={statsLoading}
                    highlight={!!stats?.highRisk && stats.highRisk > 0}
                    variant="destructive"
                />
                <StatCard
                    title="Verified"
                    value={stats?.verified}
                    icon={<CheckCircle className="h-5 w-5 text-green-500" />}
                    loading={statsLoading}
                />
            </div>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-3">
                <Link href="/dashboard/upload">
                    <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                            <div className="rounded-lg bg-primary/10 p-3">
                                <Upload className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Upload Notices</CardTitle>
                                <CardDescription>Drag & drop PDFs for AI processing</CardDescription>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>

                <Link href="/dashboard/review">
                    <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                            <div className="rounded-lg bg-yellow-500/10 p-3">
                                <FileSearch className="h-6 w-6 text-yellow-500" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Review Queue</CardTitle>
                                <CardDescription>
                                    {stats?.reviewNeeded ?? 0} notices need verification
                                </CardDescription>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>

                <Link href="/dashboard/analytics">
                    <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                            <div className="rounded-lg bg-green-500/10 p-3">
                                <BarChart3 className="h-6 w-6 text-green-500" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Analytics</CardTitle>
                                <CardDescription>AI accuracy & processing metrics</CardDescription>
                            </div>
                        </CardHeader>
                    </Card>
                </Link>
            </div>

            {/* Financial Exposure Radar */}
            <Card className="border-2 border-destructive/20 bg-destructive/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-destructive/10 p-2">
                            <TrendingUp className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Financial Exposure Radar</CardTitle>
                            <CardDescription>Total money at risk across active notices</CardDescription>
                        </div>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                        CFO View
                    </Badge>
                </CardHeader>
                <CardContent>
                    {exposureLoading ? (
                        <div className="grid grid-cols-3 gap-4">
                            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                        </div>
                    ) : exposure ? (
                        <div>
                            <div className="grid grid-cols-4 gap-4 mb-4">
                                <div className="col-span-1 rounded-lg border border-border bg-card p-4 text-center">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Exposure</p>
                                    <p className="text-2xl font-black text-foreground">{fmt(exposure.totalExposureRupees)}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{exposure.activeNoticeCount} active notices</p>
                                </div>
                                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-center">
                                    <p className="text-xs text-destructive uppercase tracking-wide mb-1 font-bold">HIGH RISK</p>
                                    <p className="text-xl font-bold text-destructive">{fmt(exposure.highRiskRupees)}</p>
                                </div>
                                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-center">
                                    <p className="text-xs text-yellow-600 uppercase tracking-wide mb-1 font-bold">Medium Risk</p>
                                    <p className="text-xl font-bold text-yellow-600">{fmt(exposure.mediumRiskRupees)}</p>
                                </div>
                                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center">
                                    <p className="text-xs text-green-600 uppercase tracking-wide mb-1 font-bold">Low Risk</p>
                                    <p className="text-xl font-bold text-green-600">{fmt(exposure.lowRiskRupees)}</p>
                                </div>
                            </div>
                            {exposure.topAuthorities.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Top Authorities by Exposure</p>
                                    <div className="space-y-1.5">
                                        {exposure.topAuthorities.map((a, i) => (
                                            <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                                                <p className="text-sm text-foreground">{a.name}</p>
                                                <p className="text-sm font-bold text-foreground">{fmt(a.amountRupees)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No active notices to analyse.</p>
                    )}
                </CardContent>
            </Card>

            {/* Recent Notices */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle>Recent Notices</CardTitle>
                        <CardDescription>Latest uploaded and processed notices</CardDescription>
                    </div>
                    <Link href="/dashboard/review">
                        <Button variant="outline" size="sm">
                            View All <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                    </Link>
                </CardHeader>
                <CardContent>
                    {noticesLoading ? (
                        <div className="space-y-3">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <Skeleton className="h-10 w-10 rounded" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-1/3" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : !recentNotices || recentNotices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <FileSearch className="mb-4 h-12 w-12 text-muted-foreground/50" />
                            <p className="text-lg font-medium text-foreground">No notices yet</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Upload your first tax notice to get started
                            </p>
                            <Link href="/dashboard/upload">
                                <Button className="mt-4">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Upload Notice
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recentNotices.slice(0, 5).map((notice) => (
                                <Link
                                    key={notice.id}
                                    href={`/dashboard/verify/${notice.id}`}
                                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                                >
                                    <div className="flex items-center gap-3">
                                        <FileSearch className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                {notice.fileName ?? "Untitled"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {notice.authority ?? "Unknown Authority"}
                                                {notice.deadline && ` · Due: ${notice.deadline}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {notice.riskLevel && (
                                            <Badge
                                                variant={
                                                    notice.riskLevel === "high"
                                                        ? "destructive"
                                                        : notice.riskLevel === "medium"
                                                            ? "secondary"
                                                            : "outline"
                                                }
                                            >
                                                {notice.riskLevel}
                                            </Badge>
                                        )}
                                        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                                            <Badge variant="outline" className="uppercase text-[10px] tracking-wider font-bold">
                                                {notice.status ? notice.status.replace(/_/g, ' ') : "UNKNOWN"}
                                            </Badge>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function StatCard({
    title,
    value,
    icon,
    loading,
    highlight,
    variant,
}: {
    title: string;
    value?: number;
    icon: React.ReactNode;
    loading: boolean;
    highlight?: boolean;
    variant?: "destructive";
}) {
    return (
        <Card className={highlight ? (variant === "destructive" ? "border-destructive/50" : "border-yellow-500/50") : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                {loading ? (
                    <Skeleton className="h-8 w-16" />
                ) : (
                    <p className="text-3xl font-bold text-foreground">{value ?? 0}</p>
                )}
            </CardContent>
        </Card>
    );
}
