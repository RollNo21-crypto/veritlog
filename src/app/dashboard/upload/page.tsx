"use client";

import { useCallback, useState, Suspense } from "react";
import { useDropzone } from "react-dropzone";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Upload, FileText, X, Loader2, CheckCircle, AlertTriangle, Building2, Clock } from "lucide-react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";

interface UploadedFile {
    file: File;
    status: "pending" | "uploading" | "success" | "error";
    noticeId?: string;
    confidence?: string;
    riskLevel?: string;
    error?: string;
}

function UploadPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const replaceNoticeId = searchParams.get("noticeId");

    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>("none");
    // ... (rest of the component logic)

    const uploadMutation = api.notice.upload.useMutation();
    const { data: clientList } = api.clients.list.useQuery();

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
            file,
            status: "pending" as const,
        }));
        setFiles((prev) => [...prev, ...newFiles]);
    }, []);

    const onDropRejected = useCallback((fileRejections: any[]) => {
        const errorMessages = fileRejections.map(rejection => {
            const errors = rejection.errors.map((e: any) => e.message).join(", ");
            return `${rejection.file.name}: ${errors}`;
        });

        errorMessages.forEach(msg => {
            toast.error(msg);
        });

        console.error("Drop Rejected:", fileRejections);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        onDropRejected,
        accept: {
            "application/pdf": [".pdf"],
            "image/jpeg": [".jpg", ".jpeg"],
            "image/png": [".png"],
            "image/webp": [".webp"],
        },
        multiple: true,
    });

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };



    const handleUpload = async () => {
        for (let i = 0; i < files.length; i++) {
            const uploadFile = files[i];
            if (!uploadFile || uploadFile.status !== "pending") continue;

            setFiles((prev) =>
                prev.map((f, idx) => (idx === i ? { ...f, status: "uploading" as const } : f))
            );

            try {
                const base64 = await fileToBase64(uploadFile.file);

                const result = await uploadMutation.mutateAsync({
                    fileName: uploadFile.file.name,
                    fileSize: uploadFile.file.size,
                    fileType: uploadFile.file.type,
                    fileData: base64,
                    clientId: selectedClientId !== "none" ? selectedClientId : undefined,
                    replaceNoticeId: replaceNoticeId ?? undefined,
                });

                setFiles((prev) =>
                    prev.map((f, idx) =>
                        idx === i
                            ? {
                                ...f,
                                status: "success" as const,
                                noticeId: result.noticeId,
                                confidence: result.confidence,
                                riskLevel: result.riskLevel,
                            }
                            : f
                    )
                );

                // If replacing, redirect back after a short delay
                if (replaceNoticeId) {
                    setTimeout(() => router.push(`/dashboard/verify/${replaceNoticeId}`), 1500);
                }
            } catch (err) {
                setFiles((prev) =>
                    prev.map((f, idx) =>
                        idx === i
                            ? {
                                ...f,
                                status: "error" as const,
                                error: err instanceof Error ? err.message : "Upload failed",
                            }
                            : f
                    )
                );
            }
        }
    };

    const pendingCount = files.filter((f) => f.status === "pending").length;
    const uploadingCount = files.filter((f) => f.status === "uploading").length;
    const selectedClient = clientList?.find((c) => c.id === selectedClientId);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Upload Notices</h1>
                <div className="mt-1 flex items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground">
                        Upload tax notice documents for AI-powered extraction and processing
                    </p>
                    {replaceNoticeId && (
                        <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 px-3 py-1 animate-pulse">
                            <Clock className="mr-2 h-3 w-3" />
                            Completing Intimation: {replaceNoticeId}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Client Picker */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Building2 className="h-4 w-4" />
                        Assign to Client
                    </CardTitle>
                    <CardDescription>
                        Which client does this notice belong to?
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {clientList && clientList.length > 0 ? (
                        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                            <SelectTrigger className="w-full max-w-sm">
                                <SelectValue placeholder="Select a client..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">
                                    <span className="text-muted-foreground uppercase font-bold tracking-wider text-[10px]">No client (untagged)</span>
                                </SelectItem>
                                {clientList.map((client: { id: string; businessName: string; gstin: string | null }) => (
                                    <SelectItem key={client.id} value={client.id}>
                                        <div className="flex flex-col">
                                            <span className="font-bold uppercase tracking-tight text-foreground">{client.businessName}</span>
                                            {client.gstin && (
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">GSTIN: {client.gstin}</span>
                                            )}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            No clients yet.{" "}
                            <a href="/dashboard/clients" className="text-primary underline underline-offset-2">
                                Add a client
                            </a>{" "}
                            to tag notices for bifurcation.
                        </div>
                    )}
                    {selectedClient && (
                        <p className="mt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Notices will be tagged to <strong className="text-foreground">{selectedClient.businessName}</strong>
                            {selectedClient.gstin && ` (GSTIN: ${selectedClient.gstin})`}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Drop Zone */}
            <Card>
                <CardContent className="pt-6">
                    <div
                        {...getRootProps()}
                        className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${isDragActive
                            ? "border-primary bg-primary/5"
                            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                            }`}
                    >
                        <input {...getInputProps()} />
                        <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                        {isDragActive ? (
                            <p className="text-lg font-medium text-primary">Drop the files here...</p>
                        ) : (
                            <>
                                <p className="text-lg font-medium text-foreground">
                                    Drag & drop notice documents here
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    or click to browse — PDF, JPG, PNG accepted
                                </p>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* File List */}
            {files.length > 0 && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div>
                            <CardTitle className="text-lg">Files</CardTitle>
                            <CardDescription>
                                {pendingCount > 0 && `${pendingCount} pending · `}
                                {files.filter((f) => f.status === "success").length} processed
                                {selectedClient && (
                                    <span className="ml-2">
                                        · Tagged to <strong>{selectedClient.businessName}</strong>
                                    </span>
                                )}
                            </CardDescription>
                        </div>
                        {pendingCount > 0 && (
                            <Button onClick={handleUpload} disabled={uploadingCount > 0}>
                                {uploadingCount > 0 ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Process {pendingCount} File{pendingCount > 1 ? "s" : ""}
                                    </>
                                )}
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {files.map((uploadedFile, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                                >
                                    <div className="flex items-center gap-3">
                                        {uploadedFile.status === "uploading" ? (
                                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        ) : uploadedFile.status === "success" ? (
                                            <CheckCircle className="h-5 w-5 text-green-500" />
                                        ) : uploadedFile.status === "error" ? (
                                            <AlertTriangle className="h-5 w-5 text-destructive" />
                                        ) : (
                                            <FileText className="h-5 w-5 text-muted-foreground" />
                                        )}

                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                {uploadedFile.file.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {(uploadedFile.file.size / 1024).toFixed(1)} KB
                                                {uploadedFile.confidence && (
                                                    <> · Confidence: <Badge variant={uploadedFile.confidence === "high" ? "default" : uploadedFile.confidence === "medium" ? "secondary" : "destructive"} className="ml-1 text-xs">{uploadedFile.confidence}</Badge></>
                                                )}
                                                {uploadedFile.riskLevel && (
                                                    <> · Risk: <Badge variant={uploadedFile.riskLevel === "high" ? "destructive" : uploadedFile.riskLevel === "medium" ? "secondary" : "outline"} className="ml-1 text-xs">{uploadedFile.riskLevel}</Badge></>
                                                )}
                                            </p>
                                            {uploadedFile.error && (
                                                <p className="text-xs text-destructive">{uploadedFile.error}</p>
                                            )}
                                        </div>
                                    </div>

                                    {uploadedFile.status === "pending" && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeFile(index)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export default function UploadPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading upload interface...</p>
            </div>
        }>
            <UploadPageContent />
        </Suspense>
    );
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
    });
}
