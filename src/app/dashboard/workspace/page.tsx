"use client";

import { useState } from "react";
import { FileText, User, Clock, Square } from "lucide-react";

type NoticeStatus = "new" | "review_needed" | "in_progress" | "closed";

interface Notice {
    id: string;
    title: string;
    status: NoticeStatus;
    assignee?: string;
    deadline?: string;
}

const columns: { id: NoticeStatus; title: string }[] = [
    { id: "new", title: "New" },
    { id: "review_needed", title: "Review Needed" },
    { id: "in_progress", title: "In Progress" },
    { id: "closed", title: "Closed" },
];

export default function WorkspacePage() {
    // Mock data - will be replaced with real tRPC query
    const [notices] = useState<Notice[]>([]);

    const getNoticesByStatus = (status: NoticeStatus) => {
        return notices.filter((notice) => notice.status === status);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Workspace</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Manage notices with Kanban board and assignments
                </p>
            </div>

            {/* Kanban Board */}
            <div className="grid gap-4 lg:grid-cols-4">
                {columns.map((column) => {
                    const columnNotices = getNoticesByStatus(column.id);
                    return (
                        <div key={column.id} className="flex flex-col">
                            {/* Column Header */}
                            <div className="mb-4 border border-border bg-card p-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold uppercase tracking-tight text-card-foreground">{column.title}</h3>
                                    <span className="border border-border bg-background px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        {columnNotices.length}
                                    </span>
                                </div>
                            </div>

                            {/* Column Content */}
                            <div className="flex-1 space-y-3">
                                {columnNotices.length === 0 ? (
                                    <div className="border-2 border-dashed border-border bg-card p-8 text-center">
                                        <p className="text-sm font-medium text-muted-foreground">NO NOTICES</p>
                                    </div>
                                ) : (
                                    columnNotices.map((notice) => (
                                        <div
                                            key={notice.id}
                                            className="cursor-move border border-border bg-card p-4 transition-all hover:border-foreground"
                                        >
                                            <div className="mb-3 flex items-start gap-2">
                                                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center border border-border bg-background">
                                                    <FileText className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                                                </div>
                                                <h4 className="flex-1 text-sm font-bold uppercase tracking-tight text-card-foreground">
                                                    {notice.title}
                                                </h4>
                                            </div>
                                            {notice.assignee && (
                                                <div className="mb-2 flex items-center gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
                                                    <User className="h-3 w-3" />
                                                    <span>{notice.assignee}</span>
                                                </div>
                                            )}
                                            {notice.deadline && (
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    <span>{notice.deadline}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Empty State */}
            {notices.length === 0 && (
                <div className="border-2 border-dashed border-border bg-card p-16 text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center border border-border bg-background">
                        <Square className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <p className="text-xl font-bold uppercase tracking-tight text-foreground">No notices to manage</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Upload notices to start organizing your workflow
                    </p>
                </div>
            )}
        </div>
    );
}
