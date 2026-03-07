"use client";

import { Mail, Inbox, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { api } from "~/trpc/react";

const INBOX_ADDRESS = "support@reznico.tech";

export default function EmailPage() {
    const { data: notices } = api.notice.list.useQuery();
    const emailNotices = notices?.filter((n) => n.source === "email") ?? [];

    function handleCopy() {
        void navigator.clipboard.writeText(INBOX_ADDRESS).then(() => {
            toast.success("Email address copied!");
        });
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Email Ingestion</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Forward tax notice emails here — AI extracts and queues them automatically
                </p>
            </div>

            {/* Inbox address */}
            <div className="border border-border bg-card p-6 space-y-4">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center border border-border bg-background">
                        <Mail className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold uppercase tracking-tight text-card-foreground">Notice Inbox</h2>
                        <p className="text-sm text-muted-foreground">
                            Forward or send notice emails with PDF attachments to this address
                        </p>
                    </div>
                </div>

                <div className="border border-border bg-background p-4">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Inbox Address
                    </div>
                    <div className="flex items-center gap-3">
                        <code className="flex-1 border border-border bg-card px-4 py-3 font-mono text-sm text-foreground">
                            {INBOX_ADDRESS}
                        </code>
                        <button
                            onClick={handleCopy}
                            className="border-2 border-accent bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wider text-accent-foreground hover:bg-transparent hover:text-accent transition-colors"
                        >
                            Copy
                        </button>
                    </div>
                </div>

                {/* How to use */}
                <div className="border border-border bg-background p-4">
                    <h3 className="mb-3 font-bold uppercase tracking-tight text-foreground">How it works:</h3>
                    <ol className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex gap-2">
                            <span className="font-bold text-foreground">1.</span>
                            <span>Send or forward any tax notice email <strong className="text-foreground">with a PDF attachment</strong> to the address above</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="font-bold text-foreground">2.</span>
                            <span>VERITLOG checks this inbox every <strong className="text-foreground">15 minutes</strong> automatically</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="font-bold text-foreground">3.</span>
                            <span>AI extracts notice details — authority, amount, deadline, risk level</span>
                        </li>
                        <li className="flex gap-2">
                            <span className="font-bold text-foreground">4.</span>
                            <span>Notice appears in <a href="/dashboard/review" className="text-primary underline underline-offset-2">Review Queue</a> for verification</span>
                        </li>
                    </ol>
                </div>
            </div>

            {/* Stats from real DB */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="border border-border bg-card p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center border border-border bg-background">
                        <Inbox className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Via Email</p>
                    <p className="mt-2 text-4xl font-bold text-card-foreground">{emailNotices.length}</p>
                    <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Notices created from email</div>
                </div>

                <div className="border border-border bg-card p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center border border-border bg-background">
                        <CheckCircle className="h-6 w-6 text-green-500" strokeWidth={1.5} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Verified</p>
                    <p className="mt-2 text-4xl font-bold text-card-foreground">
                        {emailNotices.filter((n) => ["verified", "closed", "approved"].includes(n.status)).length}
                    </p>
                    <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">From email ingestion</div>
                </div>

                <div className="border border-border bg-card p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center border border-border bg-background">
                        <Clock className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Poll Interval</p>
                    <p className="mt-2 text-4xl font-bold text-card-foreground">15m</p>
                    <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Checked automatically on Vercel</div>
                </div>
            </div>
        </div>
    );
}
