"use client";

import { Mail, Inbox, Send, Square } from "lucide-react";

export default function EmailPage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Email Integration</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Configure email forwarding for automatic notice ingestion
                </p>
            </div>

            {/* Email Forwarding Setup */}
            <div className="border border-border bg-card p-6">
                <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center border border-border bg-background">
                        <Mail className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold uppercase tracking-tight text-card-foreground">Email Forwarding Address</h2>
                        <p className="text-sm text-muted-foreground">
                            Forward tax notice emails to this address for automatic processing
                        </p>
                    </div>
                </div>

                <div className="border border-border bg-background p-4">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Your Unique Email Address
                    </div>
                    <div className="flex items-center gap-3">
                        <code className="flex-1 border border-border bg-card px-4 py-3 font-mono text-sm text-foreground">
                            notices@veritlog.app
                        </code>
                        <button className="border-2 border-accent bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wider text-accent-foreground hover:bg-transparent hover:text-accent">
                            Copy
                        </button>
                    </div>
                </div>

                <div className="mt-6 border border-border bg-background p-4">
                    <h3 className="mb-3 font-bold uppercase tracking-tight text-foreground">How to use:</h3>
                    <ol className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex gap-2">
                            <span className="font-bold text-foreground">1.</span>
                            <span>Forward tax notice emails to the address above</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="font-bold text-foreground">2.</span>
                            <span>AI will automatically extract key information</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="font-bold text-foreground">3.</span>
                            <span>Notices appear in your review queue for verification</span>
                        </li>
                    </ol>
                </div>
            </div>

            {/* Email Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="border border-border bg-card p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center border border-border bg-background">
                        <Inbox className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Emails Received</p>
                    <p className="mt-2 text-4xl font-bold text-card-foreground">0</p>
                    <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Last 30 days</div>
                </div>

                <div className="border border-border bg-card p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center border border-border bg-background">
                        <Send className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Successfully Processed</p>
                    <p className="mt-2 text-4xl font-bold text-card-foreground">0</p>
                    <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">100% success rate</div>
                </div>

                <div className="border border-border bg-card p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center border border-border bg-background">
                        <Square className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Failed</p>
                    <p className="mt-2 text-4xl font-bold text-card-foreground">0</p>
                    <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">No failures</div>
                </div>
            </div>
        </div>
    );
}
