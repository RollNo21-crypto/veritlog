"use client";

import { Download, FileText, Shield, Calendar, Square } from "lucide-react";

export default function ReportsPage() {
    const handleExport = (format: "csv" | "pdf") => {
        console.log(`Exporting as ${format}`);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Reports & Compliance</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Export audit logs and manage data retention policies
                </p>
            </div>

            {/* Export Section */}
            <div className="border border-border bg-card p-6">
                <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center border border-border bg-background">
                        <Download className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold uppercase tracking-tight text-card-foreground">Export Audit Logs</h2>
                        <p className="text-sm text-muted-foreground">
                            Download complete audit trail of all notice activities
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => handleExport("csv")}
                        className="flex items-center gap-2 border border-border bg-background px-6 py-3 text-sm font-bold uppercase tracking-wider text-foreground hover:border-foreground"
                    >
                        <FileText className="h-4 w-4" />
                        Export CSV
                    </button>
                    <button
                        onClick={() => handleExport("pdf")}
                        className="flex items-center gap-2 border border-border bg-background px-6 py-3 text-sm font-bold uppercase tracking-wider text-foreground hover:border-foreground"
                    >
                        <FileText className="h-4 w-4" />
                        Export PDF
                    </button>
                </div>
            </div>

            {/* Data Retention Policy */}
            <div className="border border-border bg-card p-6">
                <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center border border-border bg-background">
                        <Calendar className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold uppercase tracking-tight text-card-foreground">Data Retention Policy</h2>
                        <p className="text-sm text-muted-foreground">
                            Automatic data lifecycle management
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="border border-border bg-background p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold uppercase tracking-tight text-foreground">Notice Documents</p>
                                <p className="text-sm text-muted-foreground">PDF files and extracted data</p>
                            </div>
                            <span className="border border-border bg-card px-4 py-2 text-sm font-bold uppercase tracking-wider text-foreground">
                                7 Years
                            </span>
                        </div>
                    </div>

                    <div className="border border-border bg-background p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold uppercase tracking-tight text-foreground">Audit Logs</p>
                                <p className="text-sm text-muted-foreground">User actions and system events</p>
                            </div>
                            <span className="border border-border bg-card px-4 py-2 text-sm font-bold uppercase tracking-wider text-foreground">
                                3 Years
                            </span>
                        </div>
                    </div>

                    <div className="border border-border bg-background p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold uppercase tracking-tight text-foreground">User Sessions</p>
                                <p className="text-sm text-muted-foreground">Authentication and access logs</p>
                            </div>
                            <span className="border border-border bg-card px-4 py-2 text-sm font-bold uppercase tracking-wider text-foreground">
                                90 Days
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Security Compliance */}
            <div className="border border-border bg-card p-6">
                <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center border border-border bg-background">
                        <Shield className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold uppercase tracking-tight text-card-foreground">Security Compliance</h2>
                        <p className="text-sm text-muted-foreground">
                            System security validation status
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    {[
                        { label: "HTTPS Encryption", status: "Active" },
                        { label: "Multi-tenant Isolation", status: "Enabled" },
                        { label: "Database Encryption", status: "Active" },
                        { label: "Access Control (Clerk)", status: "Configured" },
                    ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between border border-border bg-background p-4">
                            <span className="text-sm font-medium text-foreground">{item.label}</span>
                            <span className="border border-foreground bg-foreground px-3 py-1 text-xs font-bold uppercase tracking-wider text-background">
                                {item.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
