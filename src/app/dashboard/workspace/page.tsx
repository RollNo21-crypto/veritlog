"use client";

import { useState, useCallback } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";
import {
    DndContext,
    DragOverlay,
    closestCorners,
    PointerSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    AlertTriangle,
    Clock,
    CheckCircle,
    FileSearch,
    Plus,
    GripVertical,
    X,
    Loader2,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { toast } from "sonner";

type NoticeStatus = "processing" | "review_needed" | "in_progress" | "verified" | "closed";

type NoticeItem = {
    id: string;
    fileName: string | null;
    authority: string | null;
    deadline: string | null;
    amount: number | null;
    riskLevel: string | null;
    status: string;
    confidence: string | null;
};

const COLUMNS: {
    id: NoticeStatus;
    label: string;
    icon: React.ReactNode;
    headerClass: string;
    bodyClass: string;
}[] = [
        {
            id: "review_needed",
            label: "Review Needed",
            icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
            headerClass: "border-yellow-500/40",
            bodyClass: "border-yellow-500/20 bg-yellow-500/5",
        },
        {
            id: "in_progress",
            label: "In Progress",
            icon: <Clock className="h-4 w-4 text-primary" />,
            headerClass: "border-primary/40",
            bodyClass: "border-primary/20 bg-primary/5",
        },
        {
            id: "verified",
            label: "Verified",
            icon: <CheckCircle className="h-4 w-4 text-green-500" />,
            headerClass: "border-green-500/40",
            bodyClass: "border-green-500/20 bg-green-500/5",
        },
        {
            id: "closed",
            label: "Closed",
            icon: <FileSearch className="h-4 w-4 text-muted-foreground" />,
            headerClass: "border-border",
            bodyClass: "border-border bg-muted/30",
        },
    ];

/** Returns days until deadline. Negative = overdue. */
function daysUntil(deadline: string | null): number | null {
    if (!deadline) return null;
    const diff = new Date(deadline).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
}

function DeadlineBadge({ deadline }: { deadline: string | null }) {
    const days = daysUntil(deadline);
    if (days === null) return null;
    if (days < 0) return <Badge variant="destructive" className="text-xs">Overdue {Math.abs(days)}d</Badge>;
    if (days <= 3) return <Badge variant="destructive" className="text-xs">Due in {days}d</Badge>;
    if (days <= 7) return <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-300">Due in {days}d</Badge>;
    return <Badge variant="outline" className="text-xs">Due {deadline}</Badge>;
}

// ─── Sortable Notice Card ────────────────────────────────────────────────────

function SortableCard({
    notice,
    onClose,
}: {
    notice: NoticeItem;
    onClose: (notice: NoticeItem) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: notice.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="group relative rounded-lg border border-border bg-card p-3 shadow-sm">
            {/* Drag handle */}
            <div
                className="absolute left-1 top-3 cursor-grab touch-none text-muted-foreground/30 hover:text-muted-foreground active:cursor-grabbing"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-4 w-4" />
            </div>

            <div className="pl-4">
                <Link href={`/dashboard/verify/${notice.id}`} className="block">
                    <p className="line-clamp-1 text-sm font-medium text-foreground hover:text-primary hover:underline">
                        {notice.fileName ?? "Untitled"}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {notice.authority ?? "Unknown Authority"}
                    </p>
                </Link>

                <div className="mt-2 flex flex-wrap items-center gap-1">
                    {notice.riskLevel === "high" && (
                        <Badge variant="destructive" className="text-xs">High Risk</Badge>
                    )}
                    {notice.riskLevel === "medium" && (
                        <Badge variant="secondary" className="text-xs">Med Risk</Badge>
                    )}
                    <DeadlineBadge deadline={notice.deadline} />
                    {notice.amount && (
                        <Badge variant="outline" className="text-xs font-mono">
                            ₹{(notice.amount / 100).toLocaleString("en-IN")}
                        </Badge>
                    )}
                </div>

                {/* Close button (only for non-closed) */}
                {notice.status !== "closed" && (
                    <div className="mt-2 flex justify-end">
                        <button
                            className="flex items-center gap-1 rounded text-xs text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); onClose(notice); }}
                        >
                            <X className="h-3 w-3" /> Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

/** Ghost card shown under the cursor during drag */
function DragCard({ notice }: { notice: NoticeItem }) {
    return (
        <div className="rotate-2 rounded-lg border border-border bg-card p-3 shadow-xl opacity-90">
            <p className="line-clamp-1 pl-4 text-sm font-medium text-foreground">{notice.fileName ?? "Untitled"}</p>
        </div>
    );
}

// ─── Kanban Column ───────────────────────────────────────────────────────────

function KanbanColumn({
    column,
    notices,
    onClose,
}: {
    column: (typeof COLUMNS)[0];
    notices: NoticeItem[];
    onClose: (notice: NoticeItem) => void;
}) {
    return (
        <div className="flex flex-col gap-2">
            {/* Header */}
            <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${column.headerClass} bg-card`}>
                <div className="flex items-center gap-2">
                    {column.icon}
                    <span className="text-sm font-semibold text-foreground">{column.label}</span>
                </div>
                <Badge variant="secondary" className="text-xs">{notices.length}</Badge>
            </div>

            {/* Drop zone */}
            <div className={`min-h-[180px] rounded-lg border-2 border-dashed p-2 ${column.bodyClass}`}>
                <SortableContext items={notices.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                    {notices.length === 0 ? (
                        <div className="flex h-full items-center justify-center py-10">
                            <p className="text-xs text-muted-foreground">Drop notices here</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {notices.map((n) => (
                                <SortableCard key={n.id} notice={n} onClose={onClose} />
                            ))}
                        </div>
                    )}
                </SortableContext>
            </div>
        </div>
    );
}

// ─── Close Notice Dialog ─────────────────────────────────────────────────────

const CLOSE_REASONS = [
    "Resolved — Payment made",
    "Resolved — Penalty waived",
    "Resolved — Response accepted",
    "No action required",
    "Duplicate notice",
    "Outside jurisdiction",
    "Other",
];

function CloseDialog({
    notice,
    onConfirm,
    onCancel,
    isPending,
}: {
    notice: NoticeItem | null;
    onConfirm: (reason: string) => void;
    onCancel: () => void;
    isPending: boolean;
}) {
    const [reason, setReason] = useState(CLOSE_REASONS[0]!);
    return (
        <Dialog open={!!notice} onOpenChange={(open) => { if (!open) onCancel(); }}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Close Notice</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                        {notice?.fileName ?? "Notice"}
                    </p>
                    <div className="space-y-1.5">
                        <Label>Close Reason</Label>
                        <Select value={reason} onValueChange={setReason}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CLOSE_REASONS.map((r) => (
                                    <SelectItem key={r} value={r}>{r}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button
                        variant="destructive"
                        onClick={() => onConfirm(reason)}
                        disabled={isPending}
                    >
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Close Notice
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Workspace Page ─────────────────────────────────────────────────────

export default function WorkspacePage() {
    const { data: allNotices, isLoading, refetch } = api.notice.list.useQuery();
    const updateStatusMutation = api.notice.updateStatus.useMutation({
        onSuccess: () => void refetch(),
        onError: () => toast.error("Failed to move notice"),
    });
    const closeMutation = api.notice.close.useMutation({
        onSuccess: () => {
            toast.success("Notice closed");
            setClosingNotice(null);
            void refetch();
        },
        onError: () => toast.error("Failed to close notice"),
    });

    const [activeId, setActiveId] = useState<string | null>(null);
    const [closingNotice, setClosingNotice] = useState<NoticeItem | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const getColumn = useCallback(
        (status: NoticeStatus) =>
            (allNotices ?? []).filter((n) => n.status === status) as NoticeItem[],
        [allNotices]
    );

    const activeNotice = allNotices?.find((n) => n.id === activeId) as NoticeItem | undefined;

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        // `over.id` can be a column id or a card id — find the column
        const destColumnId = COLUMNS.find((c) => c.id === over.id)?.id
            ?? (allNotices?.find((n) => n.id === over.id)?.status as NoticeStatus | undefined);

        if (!destColumnId) return;

        const notice = allNotices?.find((n) => n.id === active.id);
        if (!notice || notice.status === destColumnId) return;

        // Intercept "closed" moves to show dialog
        if (destColumnId === "closed") {
            setClosingNotice(notice as NoticeItem);
            return;
        }

        updateStatusMutation.mutate({ id: notice.id, status: destColumnId });
    };

    const notices = allNotices ?? [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                    <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Workspace</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Drag notices between stages to update their status</p>
                </div>
                <Link href="/dashboard/upload">
                    <Button variant="outline" size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Upload Notice
                    </Button>
                </Link>
            </div>

            {/* Board */}
            {isLoading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    {COLUMNS.map((col) => (
                        <div key={col.id} className="space-y-3">
                            <Skeleton className="h-9 w-full rounded-lg" />
                            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
                        </div>
                    ))}
                </div>
            ) : notices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FileSearch className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-lg font-medium text-foreground">No notices in workspace</p>
                    <p className="mt-1 text-sm text-muted-foreground">Upload notices to start managing them here</p>
                    <Link href="/dashboard/upload">
                        <Button className="mt-4"><Plus className="mr-2 h-4 w-4" /> Upload Notices</Button>
                    </Link>
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        {COLUMNS.map((col) => (
                            <KanbanColumn
                                key={col.id}
                                column={col}
                                notices={getColumn(col.id)}
                                onClose={setClosingNotice}
                            />
                        ))}
                    </div>

                    {/* Drag ghost overlay */}
                    <DragOverlay>
                        {activeNotice ? <DragCard notice={activeNotice} /> : null}
                    </DragOverlay>
                </DndContext>
            )}

            {/* Closing workflow dialog */}
            <CloseDialog
                notice={closingNotice}
                onConfirm={(reason) => {
                    if (closingNotice) closeMutation.mutate({ id: closingNotice.id, closeReason: reason });
                }}
                onCancel={() => setClosingNotice(null)}
                isPending={closeMutation.isPending}
            />
        </div>
    );
}
