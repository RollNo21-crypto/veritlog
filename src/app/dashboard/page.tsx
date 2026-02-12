"use client";

import Link from "next/link";
import { FileText, Upload, CheckCircle, TrendingUp, ArrowRight, Square } from "lucide-react";

export default function DashboardPage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Dashboard</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Track your tax notices and performance
                </p>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="border border-border bg-card p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center border border-border bg-background">
                        <Square className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Total Notices
                    </p>
                    <p className="mt-2 text-4xl font-bold text-card-foreground">0</p>
                    <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                        No notices uploaded yet
                    </div>
                </div>

                <div className="border border-border bg-card p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center border border-border bg-background">
                        <CheckCircle className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Pending Review
                    </p>
                    <p className="mt-2 text-4xl font-bold text-card-foreground">0</p>
                    <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                        All caught up!
                    </div>
                </div>

                <div className="border border-border bg-card p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center border border-border bg-background">
                        <TrendingUp className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Processing
                    </p>
                    <p className="mt-2 text-4xl font-bold text-card-foreground">0</p>
                    <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                        Ready to process
                    </div>
                </div>
            </div>

            {/* Getting Started */}
            <div className="border border-border bg-card p-12">
                <div className="mx-auto max-w-2xl text-center">
                    <div className="mb-6 inline-flex h-20 w-20 items-center justify-center border border-border bg-background">
                        <Upload className="h-10 w-10 text-foreground" strokeWidth={1.5} />
                    </div>
                    <h2 className="mb-3 text-3xl font-bold uppercase tracking-tight text-card-foreground">
                        Get Started with VERITLOG
                    </h2>
                    <p className="mb-8 text-muted-foreground">
                        Upload your first tax notice to start using AI-powered extraction and verification
                    </p>
                    <Link
                        href="/dashboard/upload"
                        className="inline-flex items-center gap-3 border-2 border-accent bg-accent px-8 py-4 text-sm font-bold uppercase tracking-wider text-accent-foreground hover:bg-transparent hover:text-accent"
                    >
                        Upload Your First Notice
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </div>

            {/* Features Overview */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[
                    {
                        title: "Upload Notices",
                        description: "Drag & drop PDFs or forward emails for automatic processing",
                        icon: FileText,
                        href: "/dashboard/upload",
                    },
                    {
                        title: "Review Queue",
                        description: "Verify AI-extracted data with side-by-side PDF comparison",
                        icon: CheckCircle,
                        href: "/dashboard/review",
                    },
                    {
                        title: "Analytics",
                        description: "Track accuracy, deadlines, and team performance metrics",
                        icon: TrendingUp,
                        href: "/dashboard/analytics",
                    },
                ].map((feature, idx) => {
                    const Icon = feature.icon;
                    return (
                        <Link
                            key={idx}
                            href={feature.href}
                            className="group border border-border bg-card p-6 transition-all hover:border-foreground"
                        >
                            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center border border-border bg-background group-hover:border-foreground">
                                <Icon className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                            </div>
                            <h3 className="mb-2 text-lg font-bold uppercase tracking-tight text-card-foreground">
                                {feature.title}
                            </h3>
                            <p className="text-sm text-muted-foreground">{feature.description}</p>
                            <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs font-bold uppercase tracking-wider text-accent">
                                Learn more
                                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
