"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X } from "lucide-react";

export function UploadZone() {
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        setFiles((prev) => [...prev, ...acceptedFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "application/pdf": [".pdf"],
            "image/*": [".png", ".jpg", ".jpeg"],
        },
        maxSize: 20 * 1024 * 1024, // 20MB
    });

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (files.length === 0) return;

        setUploading(true);
        try {
            // TODO: Implement R2 upload via tRPC
            console.log("Uploading files:", files);
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Mock delay
            alert("Files uploaded successfully!");
            setFiles([]);
        } catch (error) {
            console.error("Upload failed:", error);
            alert("Upload failed. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="mx-auto max-w-2xl space-y-4">
            <div
                {...getRootProps()}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors ${isDragActive
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
            >
                <input {...getInputProps()} />
                <Upload className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                {isDragActive ? (
                    <p className="text-lg text-blue-600">Drop the files here...</p>
                ) : (
                    <div>
                        <p className="mb-2 text-lg font-medium text-gray-700">
                            Drag & drop notice files here
                        </p>
                        <p className="text-sm text-gray-500">
                            or click to select files (PDF, PNG, JPG - Max 20MB)
                        </p>
                    </div>
                )}
            </div>

            {files.length > 0 && (
                <div className="space-y-2">
                    <h3 className="font-medium text-gray-700">
                        Selected Files ({files.length})
                    </h3>
                    <div className="space-y-2">
                        {files.map((file, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between rounded-md border bg-white p-3"
                            >
                                <div className="flex items-center gap-3">
                                    <FileText className="h-5 w-5 text-gray-400" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">
                                            {file.name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeFile(index)}
                                    className="rounded-full p-1 hover:bg-gray-100"
                                >
                                    <X className="h-4 w-4 text-gray-500" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
                    >
                        {uploading ? "Uploading..." : "Upload Files"}
                    </button>
                </div>
            )}
        </div>
    );
}
