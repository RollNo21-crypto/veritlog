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

function formatPayload(payload?: string | null) {
    if (!payload) return null;
    try {
        const parsed = JSON.parse(payload);
        return JSON.stringify(parsed, null, 2);
    } catch {
        return payload;
    }
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
                    <div key={s.label} className="border-2 border-dashed border-border bg-transparent p-4 flex flex-col gap-1.5">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            {s.label === "Verified" && <CheckCircle className="h-3 w-3" />}
                            {s.label === "Total Events" && <Shield className="h-3 w-3" />}
                            {s.label === "Assigned" && <UserCheck className="h-3 w-3" />}
                            {s.label === "Closed" && <Lock className="h-3 w-3" />}
                            {s.label}
                        </p>
                        {isLoading ? <Skeleton className="h-7 w-12" /> : <p className="text-2xl font-black text-foreground">{s.value}</p>}
                    </div>
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
            <div className="border-2 border-border bg-card">
                <div className="border-b-2 border-border bg-muted/30 p-4">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
                        <Shield className="h-4 w-4" /> SYSTEM EVENT LOG
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1 font-mono uppercase tracking-wide">Sorted newest first · Read-only · NFR13 compliant</p>
                </div>
                <div className="flex flex-col">
                    {isLoading ? (
                        <div className="space-y-4 p-6">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex gap-4">
                                    <Skeleton className="h-10 w-10 shrink-0 rounded-none border-2 border-border" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-1/3" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : !filtered || filtered.length === 0 ? (
                        <div className="py-16 text-center">
                            <Shield className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                            <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">No audit events found</p>
                        </div>
                    ) : (
                        <div className="flex flex-col divide-y-2 divide-border">
                            {filtered.map((event) => {
                                const meta = ACTION_META[event.action] ?? {
                                    label: event.action.replace(/[._]/g, " "),
                                    icon: <Shield className="h-4 w-4" />,
                                    color: "bg-muted text-muted-foreground",
                                };
                                const payloadStr = formatPayload(event.newValue);

                                return (
                                    <div key={event.id} className="group flex flex-col items-start gap-4 p-5 sm:flex-row hover:bg-muted/10 transition-colors">
                                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-none border-2 border-border ${meta.color}`}>
                                            {meta.icon}
                                        </div>
                                        <div className="flex flex-1 flex-col gap-2">
                                            <div className="flex flex-wrap items-center justify-between gap-4">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider ${meta.color.replace('bg-', 'border-').replace('/10', '/30')}`}>
                                                        {meta.label}
                                                    </Badge>
                                                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 border border-border">
                                                        {formatDate(event.createdAt)}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                                                    ID: {event.id}
                                                </div>
                                            </div>

                                            <p className="text-sm font-medium mt-1">
                                                Event <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs">{event.action}</code> triggered by <code className="bg-muted px-1.5 py-0.5 rounded text-xs text-muted-foreground border border-border">{event.userId}</code>
                                            </p>
                                            
                                            <p className="text-xs text-muted-foreground">
                                                Target: <span className="font-mono text-foreground font-semibold uppercase">{event.entityType}</span> <code className="font-mono text-muted-foreground">{event.entityId}</code>
                                            </p>

                                            {payloadStr && (
                                                <div className="mt-3 bg-[#0a0a0a] border-2 border-dashed border-border p-3 w-full overflow-x-auto shadow-inner">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                                        <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Immutable Payload</span>
                                                    </div>
                                                    <pre className="text-[11px] font-mono text-green-400 leading-relaxed">
                                                        {payloadStr}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
