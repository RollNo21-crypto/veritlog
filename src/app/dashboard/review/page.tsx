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
            return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
        case "processing":
            return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
        case "verified":
            return <CheckCircle className="h-4 w-4 text-green-500" />;
        case "in_progress":
            return <Clock className="h-4 w-4 text-primary" />;
        default:
            return <FileSearch className="h-4 w-4 text-muted-foreground" />;
    }
};

export default function ReviewQueuePage() {
    const [statusFilter, setStatusFilter] = useState<NoticeStatus | "all">("all");
    const [searchQuery, setSearchQuery] = useState("");

    const { data: notices, isLoading } = api.notice.list.useQuery(
        statusFilter === "all" ? undefined : { status: statusFilter }
    );

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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((opt) => (
                        <Button
                            key={opt.value}
                            variant={statusFilter === opt.value ? "default" : "outline"}
                            size="sm"
                            onClick={() => setStatusFilter(opt.value)}
                        >
                            {opt.label}
                        </Button>
                    ))}
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search notices..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
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
                                                {notice.confidence}
                                            </Badge>
                                        )}
                                        {notice.riskLevel && notice.riskLevel !== "low" && (
                                            <Badge
                                                variant={notice.riskLevel === "high" ? "destructive" : "secondary"}
                                                className="text-xs"
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
