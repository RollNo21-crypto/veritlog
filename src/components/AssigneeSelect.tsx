"use client";

import { api } from "~/trpc/react";
import { toast } from "sonner";
import { User, UserCheck, Loader2, X } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";

interface AssigneeSelectProps {
    noticeId: string;
    currentAssignee: string | null;
    size?: "sm" | "default";
    onAssigned?: () => void;
}

export function AssigneeSelect({
    noticeId,
    currentAssignee,
    size = "default",
    onAssigned,
}: AssigneeSelectProps) {
    const { data: members = [], isLoading } = api.members.list.useQuery();

    const assignMutation = api.notice.assign.useMutation({
        onSuccess: () => {
            toast.success("Notice assigned successfully");
            onAssigned?.();
        },
        onError: () => toast.error("Failed to assign notice"),
    });

    const currentMember = members.find((m) => m.id === currentAssignee);

    const handleChange = (value: string) => {
        const assignedTo = value === "__unassign__" ? null : value;
        assignMutation.mutate({ id: noticeId, assignedTo });
    };

    if (isLoading) {
        return (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading members…
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <Select
                value={currentAssignee ?? ""}
                onValueChange={handleChange}
                disabled={assignMutation.isPending}
            >
                <SelectTrigger
                    className={`w-auto gap-1.5 border-dashed ${size === "sm" ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm"
                        }`}
                >
                    {currentMember ? (
                        <span className="flex items-center gap-1.5">
                            <UserCheck className="h-3.5 w-3.5 text-primary" />
                            {currentMember.name}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            Assign to…
                        </span>
                    )}
                </SelectTrigger>
                <SelectContent>
                    {currentAssignee && (
                        <SelectItem value="__unassign__">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                <X className="h-3.5 w-3.5" /> Unassign
                            </span>
                        </SelectItem>
                    )}
                    {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                            <span className="flex items-center gap-1.5">
                                {m.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={m.imageUrl}
                                        alt={m.name}
                                        className="h-5 w-5 rounded-full object-cover"
                                    />
                                ) : (
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                        {m.name.charAt(0).toUpperCase()}
                                    </span>
                                )}
                                {m.name}
                                {m.email && (
                                    <Badge variant="outline" className="ml-1 text-[10px]">
                                        {m.email.split("@")[0]}
                                    </Badge>
                                )}
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {assignMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
    );
}
