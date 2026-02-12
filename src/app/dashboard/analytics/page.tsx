"use client";

import { BarChart3, TrendingUp, FileText, Users, Square } from "lucide-react";

export default function AnalyticsPage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Analytics</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Track AI accuracy, processing metrics, and team performance
                </p>
            </div>

            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[
                    { label: "AI Accuracy", value: "0%", change: "N/A", icon: BarChart3 },
                    { label: "Avg Processing Time", value: "0s", change: "N/A", icon: TrendingUp },
                    { label: "Total Processed", value: "0", change: "N/A", icon: FileText },
                    { label: "Active Users", value: "0", change: "N/A", icon: Users },
                ].map((metric, idx) => {
                    const Icon = metric.icon;
                    return (
                        <div key={idx} className="border border-border bg-card p-6">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center border border-border bg-background">
                                <Icon className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                            </div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{metric.label}</p>
                            <p className="mt-2 text-4xl font-bold text-card-foreground">{metric.value}</p>
                            <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">{metric.change}</div>
                        </div>
                    );
                })}
            </div>

            {/* Charts */}
            <div className="grid gap-4 lg:grid-cols-2">
                <div className="border border-border bg-card p-6">
                    <h3 className="mb-4 text-lg font-bold uppercase tracking-tight text-card-foreground">
                        AI Accuracy by Authority
                    </h3>
                    <div className="flex h-64 items-center justify-center border border-border bg-background">
                        <p className="text-sm font-medium text-muted-foreground">NO DATA AVAILABLE</p>
                    </div>
                </div>

                <div className="border border-border bg-card p-6">
                    <h3 className="mb-4 text-lg font-bold uppercase tracking-tight text-card-foreground">
                        Processing Volume
                    </h3>
                    <div className="flex h-64 items-center justify-center border border-border bg-background">
                        <p className="text-sm font-medium text-muted-foreground">NO DATA AVAILABLE</p>
                    </div>
                </div>
            </div>

            {/* Most Corrected Fields */}
            <div className="border border-border bg-card p-6">
                <h3 className="mb-4 text-lg font-bold uppercase tracking-tight text-card-foreground">
                    Most Corrected Fields
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                <th className="pb-3">Field</th>
                                <th className="pb-3">Corrections</th>
                                <th className="pb-3">Accuracy</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colSpan={3} className="py-8 text-center text-sm font-medium text-muted-foreground">
                                    NO DATA AVAILABLE
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
