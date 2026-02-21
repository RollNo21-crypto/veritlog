"use client";

import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    Save,
    CheckCircle,
    Flag,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Loader2,
    MessageSquare,
    Clock,
    Send,
    Trash2,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { toast } from "sonner";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";

// Use the CDN worker — required for react-pdf v9
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Confidence = "high" | "medium" | "low" | null | undefined;

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
    if (!confidence) return null;
    return (
        <Badge
            variant={confidence === "high" ? "default" : confidence === "medium" ? "secondary" : "destructive"}
            className="ml-2 text-xs"
        >
            {confidence}
        </Badge>
    );
}

function FieldRow({
    label,
    value,
    onChange,
    type = "text",
    placeholder,
    confidence,
    required,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
    confidence?: Confidence;
    required?: boolean;
}) {
    const needsReview = confidence === "low";
    return (
        <div className="space-y-1">
            <div className="flex items-center">
                <Label className="text-sm font-medium text-foreground">
                    {label}
                    {required && <span className="ml-1 text-destructive">*</span>}
                </Label>
                <ConfidenceBadge confidence={confidence} />
                {needsReview && <AlertTriangle className="ml-1 h-3 w-3 text-yellow-500" />}
            </div>
            <Input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={
                    needsReview
                        ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 focus-visible:ring-yellow-500"
                        : confidence === "high"
                            ? "border-green-400 focus-visible:ring-green-500"
                            : ""
                }
            />
        </div>
    );
}

export default function VerifyNoticePage() {
    const params = useParams();
    const router = useRouter();
    const noticeId = params.id as string;

    const { data: notice, isLoading, refetch } = api.notice.getById.useQuery({ id: noticeId });
    const { data: noticeComments, refetch: refetchComments } = api.comment.list.useQuery({ noticeId });
    const { data: auditTrail } = api.audit.listForNotice.useQuery({ noticeId });

    const assignMutation = api.notice.assign.useMutation({
        onSuccess: () => { toast.success("Notice assigned"); void refetch(); },
        onError: () => toast.error("Failed to assign notice"),
    });

    const updateMutation = api.notice.update.useMutation({
        onSuccess: () => toast.success("Changes saved"),
        onError: () => toast.error("Failed to save changes"),
    });
    const verifyMutation = api.notice.verify.useMutation({
        onSuccess: () => {
            toast.success("Notice verified!");
            router.push("/dashboard/review");
        },
        onError: () => toast.error("Failed to verify notice"),
    });
    const createCommentMutation = api.comment.create.useMutation({
        onSuccess: () => {
            setCommentText("");
            void refetchComments();
        },
        onError: () => toast.error("Failed to add comment"),
    });
    const deleteCommentMutation = api.comment.delete.useMutation({
        onSuccess: () => void refetchComments(),
        onError: () => toast.error("Failed to delete comment"),
    });

    const [formData, setFormData] = useState({
        authority: "",
        noticeType: "",
        amount: "",
        deadline: "",
        section: "",
        financialYear: "",
    });
    const [commentText, setCommentText] = useState("");

    // PDF viewer state
    const [numPages, setNumPages] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [pdfError, setPdfError] = useState(false);

    // Populate form once notice loads
    useEffect(() => {
        if (notice) {
            setFormData({
                authority: notice.authority ?? "",
                noticeType: notice.noticeType ?? "",
                amount: notice.amount ? (notice.amount / 100).toString() : "",
                deadline: notice.deadline ?? "",
                section: notice.section ?? "",
                financialYear: notice.financialYear ?? "",
            });
        }
    }, [notice]);

    const handleSave = async () => {
        await updateMutation.mutateAsync({
            id: noticeId,
            ...formData,
            amount: formData.amount ? parseFloat(formData.amount) * 100 : null,
        });
        await refetch();
    };

    const handleVerify = async () => {
        await handleSave();
        await verifyMutation.mutateAsync({ id: noticeId });
    };

    const handleAddComment = async () => {
        if (!commentText.trim()) return;
        await createCommentMutation.mutateAsync({ noticeId, content: commentText });
    };

    const formatDate = (d: Date | null | undefined) => {
        if (!d) return "";
        return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    };

    if (isLoading) {
        return (
            <div className="flex h-full flex-col gap-4 p-6">
                <Skeleton className="h-12 w-64" />
                <div className="flex flex-1 gap-4">
                    <Skeleton className="flex-1 rounded-lg" />
                    <Skeleton className="w-96 rounded-lg" />
                </div>
            </div>
        );
    }

    if (!notice) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <p className="text-lg font-medium text-foreground">Notice not found</p>
                    <Link href="/dashboard/review">
                        <Button variant="link" className="mt-2">← Back to Review Queue</Button>
                    </Link>
                </div>
            </div>
        );
    }

    const isPdf = notice.fileName?.toLowerCase().endsWith(".pdf");
    const isImage =
        notice.fileName?.toLowerCase().endsWith(".jpg") ||
        notice.fileName?.toLowerCase().endsWith(".jpeg") ||
        notice.fileName?.toLowerCase().endsWith(".png");

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/review">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold text-foreground">Verify Notice</h1>
                        <p className="text-xs text-muted-foreground">{notice.fileName}</p>
                    </div>
                    {notice.riskLevel && notice.riskLevel !== "low" && (
                        <Badge variant={notice.riskLevel === "high" ? "destructive" : "secondary"}>
                            {notice.riskLevel} risk
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleVerify}
                        disabled={verifyMutation.isPending || notice.status === "verified"}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {verifyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        {notice.status === "verified" ? "Verified" : "Mark as Verified"}
                    </Button>
                </div>
            </div>

            {/* Split View */}
            <div className="flex flex-1 overflow-hidden">
                {/* ── Left: PDF / Image Viewer ── */}
                <div className="flex w-1/2 flex-col border-r border-border bg-muted/30">
                    {isPdf && !pdfError && (
                        <div className="flex items-center justify-between border-b border-border px-4 py-2">
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-xs text-muted-foreground">{currentPage} / {numPages ?? "—"}</span>
                                <Button variant="ghost" size="icon" onClick={() => setCurrentPage((p) => Math.min(numPages ?? 1, p + 1))} disabled={currentPage >= (numPages ?? 1)}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}><ZoomOut className="h-4 w-4" /></Button>
                                <span className="min-w-12 text-center text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
                                <Button variant="ghost" size="icon" onClick={() => setScale((s) => Math.min(3, s + 0.2))}><ZoomIn className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => { setScale(1.0); setCurrentPage(1); }}><RotateCcw className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    )}
                    <div className="flex-1 overflow-auto p-4">
                        {isPdf && notice.fileUrl && !pdfError ? (
                            <Document
                                file={notice.fileUrl}
                                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                                onLoadError={() => setPdfError(true)}
                                loading={<div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
                            >
                                <Page pageNumber={currentPage} scale={scale} className="mx-auto shadow-lg" />
                            </Document>
                        ) : isImage && notice.fileUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={notice.fileUrl} alt={notice.fileName ?? "Notice"} className="mx-auto max-w-full rounded-lg shadow-md" />
                        ) : (
                            <div className="flex h-full items-center justify-center text-center">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">{pdfError ? "Failed to load PDF" : "No preview available"}</p>
                                    {notice.fileUrl && (
                                        <a href={notice.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-primary underline">Open file directly</a>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right: Tabbed Editor ── */}
                <div className="flex w-1/2 flex-col overflow-hidden bg-card">
                    <Tabs defaultValue="fields" className="flex flex-1 flex-col overflow-hidden">
                        <TabsList className="mx-4 mt-4 grid w-auto grid-cols-3 self-start">
                            <TabsTrigger value="fields">Fields</TabsTrigger>
                            <TabsTrigger value="comments">
                                Comments
                                {(noticeComments?.length ?? 0) > 0 && (
                                    <Badge variant="secondary" className="ml-1 text-xs">{noticeComments!.length}</Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="timeline">Timeline</TabsTrigger>
                        </TabsList>

                        {/* ── Fields Tab ── */}
                        <TabsContent value="fields" className="flex-1 overflow-y-auto p-6 pt-4">
                            {notice.confidence === "low" && (
                                <div className="mb-4 flex items-center gap-2 rounded-lg border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-200">
                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                    <span><strong>Low confidence</strong> — please review all highlighted fields.</span>
                                </div>
                            )}
                            <div className="space-y-4">
                                <FieldRow label="Issuing Authority" value={formData.authority} onChange={(v) => setFormData({ ...formData, authority: v })} placeholder="e.g., GST Department, Maharashtra" confidence={notice.confidence as Confidence} required />
                                <FieldRow label="Notice Type" value={formData.noticeType} onChange={(v) => setFormData({ ...formData, noticeType: v })} placeholder="e.g., Show Cause Notice" confidence={notice.confidence as Confidence} required />
                                <FieldRow label="Amount Demanded (₹)" value={formData.amount} onChange={(v) => setFormData({ ...formData, amount: v })} type="number" placeholder="250000" confidence={notice.confidence as Confidence} />
                                <FieldRow label="Response Deadline" value={formData.deadline} onChange={(v) => setFormData({ ...formData, deadline: v })} type="date" confidence={notice.confidence as Confidence} required />
                                <FieldRow label="Section / Act" value={formData.section} onChange={(v) => setFormData({ ...formData, section: v })} placeholder="e.g., Section 74 of CGST Act" confidence={notice.confidence as Confidence} />
                                <FieldRow label="Financial Year" value={formData.financialYear} onChange={(v) => setFormData({ ...formData, financialYear: v })} placeholder="e.g., 2023-24" confidence={notice.confidence as Confidence} />
                            </div>

                            {notice.summary && (
                                <>
                                    <Separator className="my-4" />
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Summary</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-foreground leading-relaxed">{notice.summary}</p>
                                        </CardContent>
                                    </Card>
                                </>
                            )}

                            <Separator className="my-4" />
                            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                                <div><p className="font-medium">Status</p><p className="capitalize">{notice.status.replace("_", " ")}</p></div>
                                <div><p className="font-medium">Source</p><p className="capitalize">{notice.source}</p></div>
                                {notice.verifiedBy && <div><p className="font-medium">Verified By</p><p>{notice.verifiedBy}</p></div>}
                            </div>
                            {/* Assignment */}
                            <div className="mt-3 space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assign To</Label>
                                <Select
                                    value={notice.assignedTo ?? "unassigned"}
                                    onValueChange={(v) => {
                                        const assignTo = v === "unassigned" ? "" : v;
                                        assignMutation.mutate({ id: noticeId, assignedTo: assignTo });
                                    }}
                                >
                                    <SelectTrigger className="text-sm">
                                        <SelectValue placeholder="Unassigned" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">— Unassigned —</SelectItem>
                                        <SelectItem value="me">Me (current user)</SelectItem>
                                        <SelectItem value="team">Team</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Separator className="my-4" />
                            <Button variant="outline" className="w-full text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => toast.info("Issue reported — feature coming soon")}>
                                <Flag className="mr-2 h-4 w-4" /> Report Extraction Issue
                            </Button>
                        </TabsContent>

                        {/* ── Comments Tab ── */}
                        <TabsContent value="comments" className="flex h-full flex-col overflow-hidden p-0">
                            {/* Comment thread */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {!noticeComments ? (
                                    <div className="space-y-2">
                                        {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                                    </div>
                                ) : noticeComments.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <MessageSquare className="mb-3 h-8 w-8 text-muted-foreground/50" />
                                        <p className="text-sm text-muted-foreground">No comments yet</p>
                                    </div>
                                ) : (
                                    noticeComments.map((c) => (
                                        <div key={c.id} className="group relative rounded-lg border border-border bg-muted/30 p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1">
                                                    <p className="text-xs font-medium text-muted-foreground">
                                                        {c.userId ?? "Staff"} · {formatDate(c.createdAt)}
                                                    </p>
                                                    <p className="mt-1 text-sm text-foreground">{c.content}</p>
                                                </div>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                                    onClick={() => deleteCommentMutation.mutate({ id: c.id })}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            {/* Comment input */}
                            <div className="border-t border-border p-4">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Add a comment…"
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleAddComment(); } }}
                                        className="flex-1"
                                    />
                                    <Button
                                        size="icon"
                                        onClick={handleAddComment}
                                        disabled={!commentText.trim() || createCommentMutation.isPending}
                                    >
                                        {createCommentMutation.isPending
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : <Send className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>

                        {/* ── Timeline Tab ── */}
                        <TabsContent value="timeline" className="flex-1 overflow-y-auto p-4">
                            {!auditTrail ? (
                                <div className="space-y-3">
                                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                                </div>
                            ) : auditTrail.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Clock className="mb-3 h-8 w-8 text-muted-foreground/50" />
                                    <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                                </div>
                            ) : (
                                <div className="relative space-y-0 pl-4">
                                    {auditTrail.map((entry, i) => (
                                        <div key={entry.id} className="relative pb-4">
                                            {/* Vertical line */}
                                            {i < auditTrail.length - 1 && (
                                                <div className="absolute left-[-9px] top-6 h-full w-px bg-border" />
                                            )}
                                            {/* Dot */}
                                            <div className="absolute left-[-13px] top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
                                            <p className="text-sm font-medium text-foreground capitalize">
                                                {entry.action.replace(/_/g, " ")}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {entry.userId} · {formatDate(entry.createdAt)}
                                            </p>
                                            {entry.newValue && (
                                                <p className="mt-0.5 text-xs text-muted-foreground">→ {entry.newValue}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
