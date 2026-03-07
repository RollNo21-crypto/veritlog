"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";
import {
    FileSearch,
    Search,
    Filter,
    AlertTriangle,
    Clock,
    CheckCircle,
    Loader2,
    Calendar,
    Building2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";

type NoticeStatus = "processing" | "review_needed" | "verified" | "in_progress" | "closed";

const STATUS_OPTIONS: { value: NoticeStatus | "all"; label: string }[] = [
    { value: "all", label: "All" },
    { value: "review_needed", label: "Review Needed" },
    { value: "processing", label: "Processing" },
    { value: "verified", label: "Verified" },
    { value: "in_progress", label: "In Progress" },
    { value: "closed", label: "Closed" },
];

const statusIcon = (status: string) => {
    switch (status) {
        case "review_needed":
            return <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
        case "processing":
            return <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />;
        case "verified":
            return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
        case "in_progress":
            return <Clock className="h-4 w-4 text-primary" />;
        default:
            return <FileSearch className="h-4 w-4 text-muted-foreground" />;
    }
};

export default function ReviewQueuePage() {
    const [statusFilter, setStatusFilter] = useState<NoticeStatus | "all">("review_needed");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"createdAt" | "riskLevel">("riskLevel");
    const [authorityFilter, setAuthorityFilter] = useState<string>("all");

    const { data: notices, isLoading } = api.notice.list.useQuery(
        {
            status: statusFilter === "all" ? undefined : statusFilter,
            sortBy: sortBy,
            authority: authorityFilter === "all" ? undefined : authorityFilter,
        }
    );

    // Get unique authorities for the filter dropdown
    const uniqueAuthorities = Array.from(new Set(notices?.map(n => n.authority).filter(Boolean))) as string[];

    // Client-side search filter
    const filteredNotices = notices?.filter((notice) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            notice.fileName?.toLowerCase().includes(q) ||
            notice.authority?.toLowerCase().includes(q) ||
            notice.noticeType?.toLowerCase().includes(q) ||
            notice.section?.toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">
                    Review Queue
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Verify AI-extracted data and approve notices
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3">
                {/* Row 1: Status pills — horizontally scrollable, no wrap */}
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {STATUS_OPTIONS.map((opt) => (
                        <Button
                            key={opt.value}
                            variant={statusFilter === opt.value ? "default" : "outline"}
                            size="sm"
                            className="shrink-0"
                            onClick={() => setStatusFilter(opt.value)}
                        >
                            {opt.label}
                        </Button>
                    ))}
                </div>

                {/* Row 2: dropdowns on the left, search anchored right */}
                <div className="flex items-center gap-2">
                    <select
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        value={authorityFilter}
                        onChange={(e) => setAuthorityFilter(e.target.value)}
                    >
                        <option value="all">All Authorities</option>
                        {uniqueAuthorities.map(auth => (
                            <option key={auth} value={auth}>{auth}</option>
                        ))}
                    </select>

                    <select
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as "createdAt" | "riskLevel")}
                    >
                        <option value="riskLevel">Sort by Risk &amp; Urgency</option>
                        <option value="createdAt">Sort by Newest</option>
                    </select>

                    <div className="relative ml-auto">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search notices..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 w-56"
                        />
                    </div>
                </div>
            </div>
            {/* Notice List */}
            {isLoading ? (
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <Card key={i}>
                            <CardContent className="flex items-center gap-4 py-4">
                                <Skeleton className="h-10 w-10 rounded" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-1/3" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                                <Skeleton className="h-6 w-20 rounded-full" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : !filteredNotices || filteredNotices.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <FileSearch className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <p className="text-lg font-medium text-foreground">No notices found</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {statusFilter !== "all"
                                ? "Try changing the filter or search query"
                                : "Upload your first notice to get started"}
                        </p>
                        {statusFilter === "all" && (
                            <Link href="/dashboard/upload">
                                <Button className="mt-4">Upload Notices</Button>
                            </Link>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filteredNotices.map((notice) => (
                        <Link key={notice.id} href={`/dashboard/verify/${notice.id}`}>
                            <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                                <CardContent className="flex items-center justify-between py-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                            {statusIcon(notice.status)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                {notice.fileName ?? "Untitled"}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>{notice.authority ?? "Unknown Authority"}</span>
                                                {notice.noticeType && (
                                                    <>
                                                        <span>·</span>
                                                        <span>{notice.noticeType}</span>
                                                    </>
                                                )}
                                                {notice.deadline && (
                                                    <>
                                                        <span>·</span>
                                                        <span>Due: {notice.deadline}</span>
                                                    </>
                                                )}
                                                {notice.amount && (
                                                    <>
                                                        <span>·</span>
                                                        <span>₹{(notice.amount / 100).toLocaleString("en-IN")}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {notice.confidence && (
                                            <Badge
                                                variant={
                                                    notice.confidence === "high"
                                                        ? "default"
                                                        : notice.confidence === "medium"
                                                            ? "secondary"
                                                            : "destructive"
                                                }
                                                className="text-xs"
                                            >
                                                {notice.confidence} Match
                                            </Badge>
                                        )}
                                        {notice.riskLevel && (
                                            <Badge
                                                variant={notice.riskLevel === "high" ? "destructive" : notice.riskLevel === "medium" ? "secondary" : "outline"}
                                                className={`text-xs ${sortBy === "riskLevel" && notice.riskLevel === "high" ? "animate-pulse shadow-md" : ""}`}
                                            >
                                                {notice.riskLevel} risk
                                            </Badge>
                                        )}
                                        <Badge variant="outline" className="text-xs">
                                            {notice.status.replace("_", " ")}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
