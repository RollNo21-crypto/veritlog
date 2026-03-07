"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, X, AlertTriangle, CheckCircle, Mail, Upload, Users, FileSearch, ExternalLink } from "lucide-react";
import Link from "next/link";
import { api } from "~/trpc/react";

// ─── Action → display mapping ────────────────────────────────────────────────

type NotifMeta = {
    icon: React.ReactNode;
    label: string;
    color: string;
};

function getNotifMeta(action: string, riskLevel?: string | null): NotifMeta {
    if (action === "notice.created_via_email") {
        return { icon: <Mail className="h-4 w-4" />, label: "Email notice ingested", color: "text-blue-500" };
    }
    if (action === "notice.uploaded" || action.includes("upload")) {
        return { icon: <Upload className="h-4 w-4" />, label: "Notice uploaded", color: "text-primary" };
    }
    if (action === "notice.verified") {
        return { icon: <CheckCircle className="h-4 w-4" />, label: "Notice verified", color: "text-green-500" };
    }
    if (action === "notice.closed") {
        return { icon: <FileSearch className="h-4 w-4" />, label: "Notice closed", color: "text-muted-foreground" };
    }
    if (action === "notice.assigned") {
        return { icon: <Users className="h-4 w-4" />, label: "Notice assigned", color: "text-purple-500" };
    }
    if (action === "notice.unassigned") {
        return { icon: <Users className="h-4 w-4" />, label: "Notice unassigned", color: "text-muted-foreground" };
    }
    if (riskLevel === "high") {
        return { icon: <AlertTriangle className="h-4 w-4" />, label: "High-risk notice", color: "text-destructive" };
    }
    return { icon: <Bell className="h-4 w-4" />, label: action.replace(/\./g, " "), color: "text-muted-foreground" };
}

function timeAgo(date: Date): string {
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (secs < 60) return "just now";
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const LS_KEY = "notif_last_read";

// ─── Component ───────────────────────────────────────────────────────────────

export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [lastRead, setLastRead] = useState<Date>(() => {
        if (typeof window === "undefined") return new Date(0);
        const stored = localStorage.getItem(LS_KEY);
        return stored ? new Date(stored) : new Date(0);
    });
    const ref = useRef<HTMLDivElement>(null);

    const { data: notifications = [], refetch } = api.audit.notifications.useQuery(
        { limit: 20 },
        { refetchInterval: 60_000 } // poll every 60s
    );

    // Count events since last read
    const unreadCount = notifications.filter(
        (n) => new Date(n.createdAt) > lastRead
    ).length;

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const handleOpen = () => {
        setOpen((prev) => !prev);
        if (!open) {
            // Mark all as read when opening
            const now = new Date();
            setLastRead(now);
            localStorage.setItem(LS_KEY, now.toISOString());
            void refetch();
        }
    };

    return (
        <div className="relative" ref={ref}>
            {/* Bell button */}
            <button
                onClick={handleOpen}
                className="relative border border-border bg-background p-2 hover:border-foreground transition-colors"
                aria-label="Notifications"
            >
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-card shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                        <button onClick={() => setOpen(false)}>
                            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </button>
                    </div>

                    {/* List */}
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <Bell className="mb-2 h-8 w-8 text-muted-foreground/30" />
                                <p className="text-sm text-muted-foreground">No notifications yet</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-border">
                                {notifications.map((n) => {
                                    const meta = getNotifMeta(n.action, n.riskLevel);
                                    const isUnread = new Date(n.createdAt) > lastRead;
                                    const noticeLabel = n.noticeFileName
                                        ? n.noticeFileName.replace(/\.pdf$/i, "")
                                        : n.noticeAuthority ?? `Notice ${n.entityId.slice(0, 8)}`;

                                    return (
                                        <li
                                            key={n.id}
                                            className={`relative px-4 py-3 transition-colors hover:bg-muted/50 ${isUnread ? "bg-primary/5" : ""}`}
                                        >
                                            {isUnread && (
                                                <span className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary" />
                                            )}
                                            <div className="flex items-start gap-3 pl-2">
                                                <span className={`mt-0.5 shrink-0 ${meta.color}`}>{meta.icon}</span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-foreground">{meta.label}</p>
                                                    <p className="truncate text-xs text-muted-foreground">{noticeLabel}</p>
                                                    <p className="mt-0.5 text-xs text-muted-foreground/70">{timeAgo(n.createdAt)}</p>
                                                </div>
                                                <Link
                                                    href={`/dashboard/verify/${n.entityId}`}
                                                    onClick={() => setOpen(false)}
                                                    className="shrink-0 text-muted-foreground hover:text-primary"
                                                    title="Open notice"
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </Link>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-border px-4 py-2">
                        <Link
                            href="/dashboard/audit"
                            onClick={() => setOpen(false)}
                            className="text-xs text-primary hover:underline"
                        >
                            View full audit trail →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
