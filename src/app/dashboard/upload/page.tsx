"use client";

import { useState, useCallback } from "react";
import { Upload, FileText, X } from "lucide-react";
import { useDropzone } from "react-dropzone";

export default function UploadPage() {
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        setFiles((prev) => [...prev, ...acceptedFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "application/pdf": [".pdf"],
        },
        multiple: true,
    });

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (files.length === 0) return;

        setUploading(true);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setUploading(false);
        setFiles([]);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Upload Notices</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Upload tax notice PDFs for AI-powered extraction
                </p>
            </div>

            {/* Upload Area */}
            <div className="border border-border bg-card p-6">
                <div
                    {...getRootProps()}
                    className={`cursor-pointer border-2 border-dashed p-16 text-center transition-colors ${isDragActive
                        ? "border-foreground bg-muted"
                        : "border-border hover:border-foreground"
                        }`}
                >
                    <input {...getInputProps()} />
                    <div className="mx-auto flex max-w-md flex-col items-center gap-6">
                        <div className="flex h-20 w-20 items-center justify-center border border-border bg-background">
                            <Upload className="h-10 w-10 text-foreground" strokeWidth={1.5} />
                        </div>
                        <div>
                            <p className="text-xl font-bold uppercase tracking-tight text-card-foreground">
                                {isDragActive ? "Drop files here" : "Drag & drop PDF files"}
                            </p>
                            <p className="mt-2 text-sm text-muted-foreground">
                                or click to browse your files
                            </p>
                        </div>
                        <div className="border border-border bg-background px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            PDF Only
                        </div>
                    </div>
                </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="border border-border bg-card p-6">
                    <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
                        <h3 className="text-lg font-bold uppercase tracking-tight text-card-foreground">
                            Selected Files ({files.length})
                        </h3>
                        <button
                            onClick={handleUpload}
                            disabled={uploading}
                            className="flex items-center gap-2 border-2 border-accent bg-accent px-6 py-2 text-sm font-bold uppercase tracking-wider text-accent-foreground hover:bg-transparent hover:text-accent disabled:opacity-50"
                        >
                            {uploading ? (
                                <>
                                    <div className="h-4 w-4 animate-spin border-2 border-current border-t-transparent" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4" />
                                    Upload All
                                </>
                            )}
                        </button>
                    </div>
                    <div className="space-y-2">
                        {files.map((file, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between border border-border bg-background p-4"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center border border-border bg-card">
                                        <FileText className="h-5 w-5 text-foreground" strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">
                                            {file.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeFile(index)}
                                    className="border border-border bg-background p-2 text-muted-foreground hover:border-foreground hover:text-foreground"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Email Forwarding Info */}
            <div className="border border-border bg-card p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center border border-border bg-background">
                        <FileText className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                        <h3 className="mb-3 text-lg font-bold uppercase tracking-tight text-card-foreground">
                            Email Forwarding
                        </h3>
                        <p className="mb-4 text-sm text-muted-foreground">
                            You can also forward tax notice emails directly to:
                        </p>
                        <div className="border border-border bg-background px-4 py-3 font-mono text-sm text-foreground">
                            notices@veritlog.app
                        </div>
                        <p className="mt-4 text-xs text-muted-foreground">
                            Emails will be automatically processed and added to your review queue
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
