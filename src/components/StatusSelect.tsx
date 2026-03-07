"use client";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const STATUS_OPTIONS = [
    { value: "processing", label: "PROCESSING" },
    { value: "review_needed", label: "REVIEW NEEDED" },
    { value: "verified", label: "VERIFIED" },
    { value: "in_progress", label: "IN PROGRESS" },
    { value: "closed", label: "CLOSED" },
] as const;

export function StatusSelect({
    noticeId,
    currentStatus,
    onStatusChange,
}: {
    noticeId: string;
    currentStatus: string;
    onStatusChange?: () => void;
}) {
    const updateStatus = api.notice.updateStatus.useMutation({
        onSuccess: () => {
            toast.success("Status updated successfully");
            if (onStatusChange) onStatusChange();
        },
        onError: (err) => {
            toast.error("Failed to update status", {
                description: err.message,
            });
        },
    });

    return (
        <div
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <Select
                value={currentStatus}
                onValueChange={(value) => {
                    if (value !== currentStatus) {
                        updateStatus.mutate({
                            id: noticeId,
                            status: value as typeof STATUS_OPTIONS[number]["value"]
                        });
                    }
                }}
                disabled={updateStatus.isPending}
            >
                <SelectTrigger className="h-8 max-w-[200px] border-2 bg-transparent text-xs font-bold tracking-wider uppercase disabled:opacity-50">
                    {updateStatus.isPending ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            UPDATING...
                        </div>
                    ) : (
                        <SelectValue placeholder="SELECT STATUS" />
                    )}
                </SelectTrigger>
                <SelectContent className="bg-background">
                    {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs font-bold tracking-wider">
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
