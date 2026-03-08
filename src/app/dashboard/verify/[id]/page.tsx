"use client";

import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    Save,
    CheckCircle,
    FileText,
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
    FileDown,
    UploadCloud,
    Lock,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import ReactMarkdown from "react-markdown";
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
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "~/components/ui/resizable";
import { AssigneeSelect } from "~/components/AssigneeSelect";
import { StatusSelect } from "~/components/StatusSelect";

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

function calculateRiskLevel(deadline: string | null, amount: string | null): "high" | "medium" | "low" {
    const amountRupees = amount ? parseFloat(amount) : 0;

    // Check amount thresholds
    if (amountRupees > 1000000) return "high"; // > ₹10 Lakhs

    if (deadline) {
        const deadlineDate = new Date(deadline);
        const now = new Date();
        const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntil < 7) return "high";
        if (daysUntil < 14) return "medium";
    }

    if (amountRupees > 100000) return "medium";
    return "low";
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
                {needsReview && <AlertTriangle className="ml-1 h-4 w-4 text-amber-500 animate-pulse" />}
            </div>
            <Input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={
                    needsReview
                        ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 focus-visible:ring-amber-500 ring-1 ring-amber-500/20"
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
    const { data: attachments, refetch: refetchAttachments } = api.notice.getAttachments.useQuery({ noticeId });

    const [isUploading, setIsUploading] = useState(false);

    const addAttachmentMutation = api.notice.addAttachment.useMutation({
        onSuccess: () => {
            toast.success("Response Document securely logged to immutable ledger");
            void refetchAttachments();
            void refetch();
        },
        onError: () => toast.error("Failed to log document"),
    });

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const toastId = toast.loading("Uploading securely...");
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("noticeId", noticeId);

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error("Upload failed");

            const data = await res.json() as { fileName: string; fileUrl: string; fileSize?: number; fileHash?: string };

            await addAttachmentMutation.mutateAsync({
                noticeId,
                fileName: data.fileName,
                fileUrl: data.fileUrl,
                fileSize: data.fileSize,
                fileHash: data.fileHash,
            });
            toast.dismiss(toastId);

        } catch (error) {
            console.error(error);
            toast.error("Failed to upload response document", { id: toastId });
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = "";
        }
    };

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

    const summarizeMutation = api.notice.summarizeWithAI.useMutation({
        onSuccess: () => {
            toast.success("AI Summarization complete");
            void refetch();
        },
        onError: (err) => toast.error("AI Summarization failed: " + err.message),
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

    const flagTemplateMutation = api.notice.flagTemplateIssue.useMutation({
        onSuccess: () => {
            toast.success("Template issue flagged. Dev team notified.");
            void refetch();
        },
        onError: () => toast.error("Failed to flag template issue"),
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

    const [draftResult, setDraftResult] = useState<{ actionPlan: string; draftLetter: string } | null>(null);
    const draftReplyMutation = api.notice.generateDraftReply.useMutation({
        onSuccess: (data) => {
            setDraftResult({ actionPlan: data.actionPlan, draftLetter: data.draftLetter });
            toast.success("Draft response generated successfully");
        },
        onError: () => toast.error("Failed to generate draft response"),
    });

    const handleGenerateDraft = () => draftReplyMutation.mutate({ id: noticeId });

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

    const currentRiskLevel = calculateRiskLevel(formData.deadline, formData.amount);

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
                    {currentRiskLevel && currentRiskLevel !== "low" && (
                        <Badge variant={currentRiskLevel === "high" ? "destructive" : "secondary"}>
                            {currentRiskLevel} risk
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {notice.authority === "Pending Extraction" && (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => summarizeMutation.mutate({ id: noticeId })}
                            disabled={summarizeMutation.isPending}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md animate-in fade-in"
                        >
                            {summarizeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            {summarizeMutation.isPending ? "Summarizing..." : "Summarize with AI"}
                        </Button>
                    )}

                    {/* Download Audit Report — Story 6.1 */}
                    {["verified", "closed", "approved"].includes(notice.status) && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/api/notice/${noticeId}/audit-report`, "_blank")}
                        >
                            <FileDown className="mr-2 h-4 w-4" />
                            Audit Report
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleSave} disabled={updateMutation.isPending || summarizeMutation.isPending}>
                        {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleVerify}
                        disabled={verifyMutation.isPending || notice.status === "verified" || summarizeMutation.isPending || notice.authority === "Pending Extraction"}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {verifyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        {notice.status === "verified" ? "Verified" : "Mark as Verified"}
                    </Button>
                </div>
            </div>

            {/* Split View */}
            <div className="flex flex-1 overflow-hidden">
                <ResizablePanelGroup direction="horizontal" className="h-full w-full rounded-none">
                    {/* ── Left: PDF / Image Viewer ── */}
                    <ResizablePanel defaultSize={50} minSize={30} className="flex flex-col border-r border-border bg-muted/30">
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
                        <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
                            {isPdf && notice.fileUrl && notice.fileUrl !== "#" && !pdfError ? (
                                <Document
                                    file={notice.fileUrl}
                                    onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                                    onLoadError={() => setPdfError(true)}
                                    loading={<div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}
                                >
                                    <Page pageNumber={currentPage} scale={scale} className="shadow-lg border border-border/50" renderAnnotationLayer={false} renderTextLayer={false} />
                                </Document>
                            ) : isImage && notice.fileUrl && notice.fileUrl !== "#" ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={notice.fileUrl} alt={notice.fileName ?? "Notice"} className="max-w-full rounded-lg shadow-md border border-border/50" />
                            ) : notice.fileHash === 'intimation' ? (
                                <div className="flex h-full items-center justify-center text-center p-8">
                                    <div className="max-w-md space-y-4">
                                        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                                            <UploadCloud className="h-8 w-8 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-foreground">Manual Action Required</h3>
                                            <p className="text-sm text-muted-foreground mt-2">
                                                This is an **Email Intimation**. The GST portal has notified you of a notice, but did not attach the document.
                                            </p>
                                        </div>
                                        <div className="bg-card border border-border rounded-lg p-4 text-left text-sm space-y-2">
                                            <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Next Steps:</p>
                                            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                                                <li>Log in to the <a href="https://services.gst.gov.in/services/login" target="_blank" className="text-primary underline">GST Portal</a></li>
                                                <li>Navigate to Services &gt; User Services &gt; View Notices</li>
                                                <li>Download the PDF and upload it here to complete the record</li>
                                            </ol>
                                        </div>
                                        <Button className="w-full" asChild>
                                            <Link href={`/dashboard/upload?noticeId=${notice.id}`}>
                                                <UploadCloud className="mr-2 h-4 w-4" />
                                                Upload PDF Document
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex h-full items-center justify-center text-center">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">{pdfError ? "Failed to load PDF" : "No preview available"}</p>
                                        {notice.fileUrl && notice.fileUrl !== "#" && (
                                            <a href={notice.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs text-primary underline">Open file directly</a>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    {/* ── Right: Tabbed Editor ── */}
                    <ResizablePanel defaultSize={50} minSize={30} className="flex flex-col bg-card">
                        <Tabs defaultValue="fields" className="flex flex-1 flex-col overflow-hidden">
                            <TabsList className="mx-4 mt-4 grid w-auto max-w-[600px] grid-cols-5 self-start">
                                <TabsTrigger value="fields">Fields</TabsTrigger>
                                <TabsTrigger value="comments">
                                    Comments
                                    {(noticeComments?.length ?? 0) > 0 && (
                                        <Badge variant="secondary" className="ml-1 text-xs">{noticeComments!.length}</Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="ledger" className="flex items-center gap-1.5">
                                    <Lock className="h-3 w-3" />
                                    Ledger
                                    {(attachments?.length ?? 0) > 0 && (
                                        <Badge variant="secondary" className="ml-1 text-xs">{attachments!.length}</Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                                <TabsTrigger value="draft-reply" className="flex items-center gap-1.5">
                                    <MessageSquare className="h-3 w-3" />
                                    Draft Reply
                                </TabsTrigger>
                            </TabsList>

                            {/* ── Draft Reply Tab (Epic 7) ── */}
                            <TabsContent value="draft-reply" className="flex flex-1 flex-col overflow-y-auto p-6 pt-4">
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Draft Generator</p>
                                        <Button
                                            size="sm"
                                            onClick={handleGenerateDraft}
                                            disabled={draftReplyMutation.isPending}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-[10px] uppercase font-bold tracking-wider"
                                        >
                                            {draftReplyMutation.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
                                            {draftResult ? "Regenerate Draft" : "Process Notice for Draft"}
                                        </Button>
                                    </div>

                                    <Separator />

                                    {draftResult ? (
                                        <div className="space-y-6">
                                            <div className="bg-transparent border-2 border-dashed border-border p-5">
                                                <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                                                    <CheckCircle className="h-3 w-3" /> RECOMMENDED ACTION PLAN
                                                </h4>
                                                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground font-medium">
                                                    <ReactMarkdown>{draftResult.actionPlan}</ReactMarkdown>
                                                </div>
                                            </div>

                                            <div className="bg-transparent border-2 border-dashed border-border p-5">
                                                <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                                                    <FileText className="h-3 w-3" /> AI GENERATED DRAFT RESPONSE
                                                </h4>
                                                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground font-medium">
                                                    <ReactMarkdown>{draftResult.draftLetter}</ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex h-40 flex-col items-center justify-center text-center border-2 border-dashed border-border rounded-lg bg-muted/5">
                                            <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/30" />
                                            <p className="text-sm font-bold text-muted-foreground/60 uppercase tracking-widest">No draft generated</p>
                                            <p className="text-xs text-muted-foreground/50 mt-1 max-w-[200px]">Analyze the notice to generate a defense strategy & draft reply.</p>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            {/* ── Fields Tab ── */}
                            <TabsContent value="fields" className="flex-1 overflow-y-auto p-6 pt-4">
                                {notice.mismatchWarning && (
                                    <div className="mb-4 flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-sm">
                                        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                                        <div className="flex flex-col">
                                            <span className="font-semibold">Entity Mismatch Detected</span>
                                            <span className="text-xs opacity-90">{notice.mismatchWarning}</span>
                                        </div>
                                    </div>
                                )}
                                {notice.confidence === "low" && (
                                    <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-500/50 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:bg-amber-950/30 dark:text-amber-200">
                                        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                                        <div className="flex flex-col">
                                            <span className="font-semibold">Review Alert: Low Extraction Confidence</span>
                                            <span className="text-xs opacity-90">Please manually verify all highlighted fields against the source document.</span>
                                        </div>
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

                                {(notice.summary || notice.nextSteps || notice.requiredDocuments) && (
                                    <>
                                        <Separator className="my-4" />
                                        <div className="space-y-4">
                                            {notice.summary && (
                                                <div className="bg-transparent border-2 border-dashed border-border p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                                            <span>✨</span> AI EXTRACTED SUMMARY
                                                        </h4>
                                                        {notice.isTranslated && (
                                                            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                                                Translated from {notice.originalLanguage ?? 'Unknown Language'}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-foreground leading-relaxed font-medium">{notice.summary}</p>
                                                </div>
                                            )}

                                            {notice.nextSteps && (
                                                <div className="bg-transparent border-2 border-dashed border-border p-4">
                                                    <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                                        <CheckCircle className="h-3 w-3" /> RECOMMENDED NEXT STEPS
                                                    </h4>
                                                    <ul className="space-y-1.5 text-sm font-medium text-foreground">
                                                        {notice.nextSteps.split('\n').filter(Boolean).map((step: string, i: number) => (
                                                            <li key={i} className="flex items-start gap-2">
                                                                <span className="text-muted-foreground mt-0.5">—</span>
                                                                <span className="leading-relaxed">{step.replace(/^[•\-\*]\s*/, '')}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {notice.requiredDocuments && (
                                                <div className="bg-transparent border-2 border-dashed border-border p-4">
                                                    <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                                                        <FileDown className="h-3 w-3" /> DOCUMENTS TO COLLECT
                                                    </h4>
                                                    <ul className="space-y-1.5 text-sm font-medium text-foreground">
                                                        {notice.requiredDocuments.split('\n').filter(Boolean).map((doc: string, i: number) => (
                                                            <li key={i} className="flex items-start gap-2">
                                                                <span className="text-muted-foreground mt-0.5">—</span>
                                                                <span className="leading-relaxed">{doc.replace(/^[•\-\*]\s*/, '')}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                <Separator className="my-4" />
                                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-4 text-xs">
                                    <div className="flex flex-col gap-1.5">
                                        <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Status</p>
                                        <StatusSelect
                                            noticeId={noticeId}
                                            currentStatus={notice.status}
                                            onStatusChange={() => void refetch()}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Source</p>
                                        <p className="uppercase font-bold tracking-wider mt-1">{notice.source}</p>
                                    </div>
                                    {notice.verifiedBy &&
                                        <div className="col-span-2 pt-2 border-t border-border/50">
                                            <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px] mb-1">Verified By</p>
                                            <p className="font-semibold">{notice.verifiedBy}</p>
                                        </div>
                                    }
                                </div>

                                <Separator className="my-4" />
                                <Button
                                    variant="outline"
                                    className="w-full text-destructive border-destructive/50 hover:bg-destructive/10 disabled:opacity-50"
                                    onClick={() => flagTemplateMutation.mutate({ id: noticeId })}
                                    disabled={flagTemplateMutation.isPending || notice.hasTemplateIssue === true}
                                >
                                    {flagTemplateMutation.isPending ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Flag className="mr-2 h-4 w-4" />
                                    )}
                                    {notice.hasTemplateIssue ? "Template Issue Reported" : "Report Extraction Issue"}
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
                                                        {c.summary && (
                                                            <div className="mt-2 mb-1 flex items-start gap-2 rounded border border-blue-500/20 bg-blue-500/10 p-2 text-xs text-blue-600 dark:text-blue-400">
                                                                <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
                                                                <span className="font-semibold leading-relaxed">AI Summary: <span className="font-normal">{c.summary}</span></span>
                                                            </div>
                                                        )}
                                                        <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{c.content}</p>
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
                                <div className="border-t border-border p-4 bg-muted/10">
                                    <div className="flex gap-2 relative">
                                        <Input
                                            placeholder="Add an internal comment…"
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleAddComment(); } }}
                                            className="flex-1 pr-10"
                                        />
                                        <Button
                                            size="sm"
                                            className="absolute right-1 top-1 h-8 w-8 p-0"
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
                                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                                    </div>
                                ) : auditTrail.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <Clock className="mb-3 h-8 w-8 text-muted-foreground/50" />
                                        <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                                    </div>
                                ) : (
                                    <div className="relative pl-5 mt-2">
                                        {auditTrail.map((entry, i) => {
                                            const label = ({
                                                "notice.created": "Notice Created",
                                                "notice.updated": "Fields Updated",
                                                "notice.verified": "Marked as Verified",
                                                "notice.assigned": "Assignee Changed",
                                                "notice.status_updated": "Status Changed",
                                                "notice.closed": "Notice Closed",
                                                "notice.template_issue_flagged": "Template Issue Flagged",
                                                "comment.added": "Comment Added",
                                                "attachment.added": "File Attached",
                                            } as Record<string, string>)[entry.action] ?? entry.action.replace(/[._]/g, " ");

                                            const dotColor = entry.action.includes("verified") ? "bg-green-500" :
                                                entry.action.includes("closed") ? "bg-muted-foreground" :
                                                    entry.action.includes("assigned") ? "bg-primary" :
                                                        entry.action.includes("issue") ? "bg-destructive" :
                                                            "bg-border";

                                            return (
                                                <div key={entry.id} className="relative pb-5 last:pb-0">
                                                    {/* Connecting line */}
                                                    {i < auditTrail.length - 1 && (
                                                        <div className="absolute left-[-13px] top-5 h-full w-px bg-border" />
                                                    )}
                                                    {/* Dot */}
                                                    <div className={`absolute left-[-17px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-card ${dotColor}`} />
                                                    <p className="text-sm font-semibold text-foreground leading-snug">{label}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        <span className="font-medium text-foreground/80">{entry.userId.slice(0, 12)}…</span> · {formatDate(entry.createdAt)}
                                                    </p>
                                                    {entry.newValue && entry.action !== "attachment.added" && (() => {
                                                        try {
                                                            const parsed = JSON.parse(entry.newValue) as Record<string, unknown>;
                                                            return (
                                                                <div className="mt-1.5 rounded bg-muted/60 border border-border/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                                                                    {Object.entries(parsed).map(([k, v]) => (
                                                                        <span key={k}><span className="font-medium text-foreground/80 capitalize">{k.replace(/([A-Z])/g, " $1")}:</span> {String(v)}</span>
                                                                    ))}
                                                                </div>
                                                            );
                                                        } catch { return null; }
                                                    })()}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </TabsContent>

                            {/* ── Response Ledger Tab ── */}
                            <TabsContent value="ledger" className="flex-1 overflow-y-auto p-0 flex flex-col">
                                <div className="p-6 border-b border-border bg-muted/10">
                                    <div className="flex flex-col gap-2 mb-4">
                                        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
                                            <Lock className="h-4 w-4 text-amber-500" />
                                            Immutable Response Ledger
                                        </h3>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Documents uploaded here are securely logged to the audit trail as proof of compliance.
                                            Once logged, they cannot be modified or deleted, satisfying NFR13 & FR25 requirements.
                                        </p>
                                    </div>

                                    <div className="relative border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center bg-card hover:bg-muted/30 transition-colors">
                                        <input
                                            type="file"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                            onChange={(e) => void handleFileUpload(e)}
                                            disabled={isUploading}
                                            accept="application/pdf,image/*"
                                        />
                                        <div className="flex flex-col items-center gap-2 text-center pointer-events-none">
                                            {isUploading ? (
                                                <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                                            ) : (
                                                <UploadCloud className="h-8 w-8 text-muted-foreground" />
                                            )}
                                            <p className="text-sm font-medium">
                                                {isUploading ? "Uploading Securely..." : "Drag & Drop Response Document"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">PDF or Images up to 10MB</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 p-6">
                                    {!attachments ? (
                                        <div className="space-y-3">
                                            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                                        </div>
                                    ) : attachments.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <FileDown className="mb-3 h-8 w-8 text-muted-foreground/50" />
                                            <p className="text-sm font-medium text-foreground">No recorded responses</p>
                                            <p className="text-xs text-muted-foreground mt-1">Upload the finalized response and acknowledgment receipt here.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {attachments.map((doc) => (
                                                <div key={doc.id} className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:shadow-sm transition-shadow">
                                                    <div className="flex items-start gap-4 flex-1 overflow-hidden">
                                                        <div className="mt-1 h-8 w-8 shrink-0 rounded bg-amber-500/10 flex items-center justify-center text-amber-500">
                                                            <Lock className="h-4 w-4" />
                                                        </div>
                                                        <div className="flex flex-col overflow-hidden">
                                                            <p className="truncate text-sm font-medium text-foreground" title={doc.fileName}>
                                                                {doc.fileName}
                                                            </p>
                                                            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                                                <span>{formatDate(doc.createdAt)}</span>
                                                                <span className="h-1 w-1 rounded-full bg-border" />
                                                                <span className="uppercase tracking-wider">Logged by {doc.userId.slice(0, 10)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="ml-4 flex items-center shrink-0">
                                                        <Button variant="outline" size="sm" className="h-8 px-3" asChild>
                                                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                                                View Record
                                                            </a>
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    );
}
