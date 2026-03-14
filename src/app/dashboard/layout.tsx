"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    FileText,
    Mail,
    BarChart3,
    Settings,
    Search,
    Menu,
    X,
    Activity,
    Shield,
    ShieldCheck,
    Building2,
    Users,
} from "lucide-react";
import { NotificationBell } from "~/components/NotificationBell";
import { UserButton, useUser } from "@clerk/nextjs";
import { useState } from "react";
import { DarkModeToggle } from "~/components/dark-mode-toggle";
import { api } from "~/trpc/react";
import { userButtonAppearance } from "~/lib/clerk-appearance";

const otherLinks = [
    { name: "Reports", href: "/dashboard/reports", icon: BarChart3 },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user } = useUser();

    // Fetch dynamic stats for badges
    const { data: stats } = api.notice.stats.useQuery(undefined, { refetchInterval: 30000 });
    const { data: tenant } = api.tenant.getMyTenant.useQuery(undefined, { refetchInterval: 60000 });

    const navigation = [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Upload", href: "/dashboard/upload", icon: FileText },
        { name: "Review Queue", href: "/dashboard/review", icon: FileText, badge: stats?.reviewNeeded ? stats.reviewNeeded.toString() : undefined },
        { name: "Kanban Board", href: "/dashboard/kanban", icon: LayoutDashboard },
        { name: "Clients", href: "/dashboard/clients", icon: Building2 },
        { name: "Audit Trail", href: "/dashboard/audit", icon: Shield },
        { name: "Ops Dashboard", href: "/dashboard/admin/ops", icon: Activity },
        { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    ];

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-border bg-card transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                {/* Logo */}
                <div className="flex h-16 items-center justify-between border-b border-border px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center border border-border bg-background">
                            <LayoutDashboard className="h-5 w-5 text-foreground" strokeWidth={1.5} />
                        </div>
                        <div>
                            <div className="text-sm font-bold uppercase tracking-wider text-card-foreground">VERITLOG</div>
                            <div className="text-xs text-muted-foreground">Tax Notices</div>
                        </div>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden"
                    >
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Navigation */}
                <div className="flex h-[calc(100vh-4rem)] flex-col overflow-y-auto p-4">
                    <div className="mb-6 flex-1">
                        <nav className="space-y-1">
                            {navigation.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={() => setSidebarOpen(false)}
                                        className={`flex items-center justify-between border px-3 py-3 text-sm font-medium transition-colors ${isActive
                                            ? "border-accent bg-accent text-accent-foreground"
                                            : "border-border bg-background text-muted-foreground hover:border-accent hover:text-accent"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Icon className="h-5 w-5" strokeWidth={1.5} />
                                            <span>{item.name}</span>
                                        </div>
                                        {item.badge && (
                                            <span className="border border-current px-2 py-0.5 text-xs font-bold">
                                                {item.badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="mt-6">
                            <nav className="space-y-1">
                                {otherLinks.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            onClick={() => setSidebarOpen(false)}
                                            className={`flex items-center gap-3 border px-3 py-3 text-sm font-medium transition-colors ${isActive
                                                ? "border-accent bg-accent text-accent-foreground"
                                                : "border-border bg-background text-muted-foreground hover:border-accent hover:text-accent"
                                                }`}
                                        >
                                            <Icon className="h-5 w-5" strokeWidth={1.5} />
                                            <span>{item.name}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top Bar */}
                <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden"
                        >
                            <Menu className="h-6 w-6 text-foreground" />
                        </button>
                    </div>

                    <div className="flex flex-1 items-center gap-4 hidden lg:flex">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="search"
                                placeholder="Search"
                                className="w-full border border-border bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex flex-1 items-center gap-4 lg:justify-end lg:flex-none ml-auto">
                        {/* Pine Labs Compliance Score Badge */}
                        {tenant?.complianceScore !== undefined && (
                            <div
                                className={`hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${tenant.complianceScore >= 80
                                    ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                                    : tenant.complianceScore >= 50
                                        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                        : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                                    }`}
                                title="Pine Labs Compliance Health Score"
                            >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                <span>Pine Labs Score: {tenant.complianceScore}/100</span>
                            </div>
                        )}
                        <DarkModeToggle />
                        <NotificationBell />
                        <div className="border-l border-border h-8 mx-2" />
                        <div className="flex flex-col items-end hidden sm:flex mr-2">
                            <span className="text-sm font-medium leading-tight">{user?.fullName || user?.firstName || "User"}</span>
                            <span className="text-[10px] text-muted-foreground leading-tight uppercase tracking-wider">Workspace</span>
                        </div>
                        <UserButton
                            afterSignOutUrl="/"
                            appearance={userButtonAppearance}
                        />
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto bg-background p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
