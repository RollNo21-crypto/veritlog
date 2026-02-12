"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, AlertCircle, CheckCircle, Clock, Filter, Search, Square } from "lucide-react";

type NoticeStatus = "processing" | "review_needed" | "verified" | "in_progress" | "closed";

export default function ReviewQueuePage() {
    const [statusFilter, setStatusFilter] = useState<NoticeStatus | "all">("all");
    const [searchQuery, setSearchQuery] = useState("");

    // Mock data - will be replaced with real tRPC query
    const notices: any[] = [];

    const getStatusBadge = (status: string) => {
        const badges = {
            review_needed: { label: "Review Needed" },
            processing: { label: "Processing" },
            verified: { label: "Verified" },
            in_progress: { label: "In Progress" },
            closed: { label: "Closed" },
        };

        const badge = badges[status as keyof typeof badges] || badges.processing;

        return (
            <span className="border border-foreground bg-foreground px-3 py-1 text-xs font-bold uppercase tracking-wider text-background">
                {badge.label}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Review Queue</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Verify AI-extracted notice data and correct any errors
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center border border-border bg-background">
                        <Filter className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    {["all", "review_needed", "processing", "verified"].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status as NoticeStatus | "all")}
                            className={`border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${statusFilter === status
                                ? "border-accent bg-accent text-accent-foreground"
                                : "border-border bg-background text-muted-foreground hover:border-accent hover:text-accent"
                                }`}
                        >
                            {status.replace("_", " ")}
                        </button>
                    ))}
                </div>

                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="search"
                        placeholder="Search notices..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full border border-border bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
                    />
                </div>
            </div>

            {/* Notice List */}
            {notices.length === 0 ? (
                <div className="border-2 border-dashed border-border bg-card p-16 text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center border border-border bg-background">
                        <FileText className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <p className="text-xl font-bold uppercase tracking-tight text-foreground">No notices found</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Upload some notices to get started
                    </p>
                    <Link
                        href="/dashboard/upload"
                        className="mt-6 inline-block border-2 border-accent bg-accent px-8 py-3 font-bold uppercase tracking-wider text-accent-foreground hover:bg-transparent hover:text-accent"
                    >
                        Upload Notices
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {notices.map((notice) => (
                        <Link
                            key={notice.id}
                            href={`/dashboard/verify/${notice.id}`}
                            className="block border border-border bg-card transition-all hover:border-foreground"
                        >
                            <div className="h-1 bg-foreground" />
                            <div className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="mb-4 flex items-center gap-3">
                                            <h3 className="text-xl font-bold uppercase tracking-tight text-card-foreground">
                                                {notice.noticeType || "Tax Notice"}
                                            </h3>
                                            {getStatusBadge(notice.status)}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
                                            <div className="border border-border bg-background p-3">
                                                <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Authority</span>
                                                <span className="mt-1 block text-foreground">N/A</span>
                                            </div>
                                            <div className="border border-border bg-background p-3">
                                                <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount</span>
                                                <span className="mt-1 block font-bold text-foreground">N/A</span>
                                            </div>
                                            <div className="border border-border bg-background p-3">
                                                <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Deadline</span>
                                                <span className="mt-1 block text-foreground">N/A</span>
                                            </div>
                                            <div className="border border-border bg-background p-3">
                                                <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Created</span>
                                                <span className="mt-1 block text-foreground">
                                                    {new Date(notice.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
