"use client";

import { api } from "~/trpc/react";
import {
    Shield,
    CheckCircle,
    UserCheck,
    FileText,
    MessageSquare,
    Paperclip,
    AlertTriangle,
    Lock,
    Loader2,
    Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { useState } from "react";

const ACTION_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    "notice.created": {
        label: "Notice Created",
        icon: <FileText className="h-4 w-4" />,
        color: "bg-primary/10 text-primary",
    },
    "notice.updated": {
        label: "Notice Updated",
        icon: <FileText className="h-4 w-4" />,
        color: "bg-muted text-muted-foreground",
    },
    "notice.verified": {
        label: "Notice Verified",
        icon: <CheckCircle className="h-4 w-4" />,
        color: "bg-green-500/10 text-green-600 dark:text-green-400",
    },
    "notice.assigned": {
        label: "Assignee Changed",
        icon: <UserCheck className="h-4 w-4" />,
        color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    "notice.status_updated": {
        label: "Status Changed",
        icon: <Shield className="h-4 w-4" />,
        color: "bg-muted text-muted-foreground",
    },
    "notice.closed": {
        label: "Notice Closed",
        icon: <Lock className="h-4 w-4" />,
        color: "bg-secondary text-secondary-foreground",
    },
    "notice.template_issue_flagged": {
        label: "Template Issue Flagged",
        icon: <AlertTriangle className="h-4 w-4" />,
        color: "bg-destructive/10 text-destructive",
    },
    "comment.added": {
        label: "Comment Added",
        icon: <MessageSquare className="h-4 w-4" />,
        color: "bg-muted text-muted-foreground",
    },
    "attachment.added": {
        label: "File Attached",
        icon: <Paperclip className="h-4 w-4" />,
        color: "bg-muted text-muted-foreground",
    },
};

function formatDate(d: Date | string | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

export default function AuditTrailPage() {
    const [search, setSearch] = useState("");
    const { data: events, isLoading } = api.audit.listRecent.useQuery({ limit: 100 });

    const filtered = events?.filter((e) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            e.action.toLowerCase().includes(q) ||
            e.entityId.toLowerCase().includes(q) ||
            e.userId.toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">
                    Audit Trail
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Immutable, append-only log of all system events — FR25 / NFR13 compliant
                </p>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: "Total Events", value: events?.length ?? 0 },
                    { label: "Verified", value: events?.filter(e => e.action === "notice.verified").length ?? 0 },
                    { label: "Assigned", value: events?.filter(e => e.action === "notice.assigned").length ?? 0 },
                    { label: "Closed", value: events?.filter(e => e.action === "notice.closed").length ?? 0 },
                ].map((s) => (
                    <Card key={s.label} className="p-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                        {isLoading ? <Skeleton className="mt-1 h-7 w-12" /> : <p className="mt-1 text-2xl font-bold text-foreground">{s.value}</p>}
                    </Card>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Search by event, user, or notice ID…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Event list */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Event Log</CardTitle>
                    <CardDescription>Sorted newest first · Read-only · NFR13 compliant</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex gap-3">
                                    <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                                    <div className="flex-1 space-y-1.5">
                                        <Skeleton className="h-4 w-1/3" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : !filtered || filtered.length === 0 ? (
                        <div className="py-12 text-center">
                            <Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                            <p className="text-sm text-muted-foreground">No audit events found</p>
                        </div>
                    ) : (
                        <div className="relative divide-y divide-border">
                            {filtered.map((event) => {
                                const meta = ACTION_META[event.action] ?? {
                                    label: event.action.replace(/[._]/g, " "),
                                    icon: <Shield className="h-4 w-4" />,
                                    color: "bg-muted text-muted-foreground",
                                };

                                return (
                                    <div key={event.id} className="flex items-start gap-3 py-3">
                                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.color}`}>
                                            {meta.icon}
                                        </div>
                                        <div className="flex flex-1 items-start justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    <span className="font-medium text-foreground/70">{event.userId.slice(0, 14)}…</span>
                                                    {" · "}
                                                    Notice: <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{event.entityId.slice(0, 20)}…</code>
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 flex-col items-end gap-1">
                                                <Badge variant="outline" className="text-[10px]">
                                                    {meta.label}
                                                </Badge>
                                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                    {formatDate(event.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
