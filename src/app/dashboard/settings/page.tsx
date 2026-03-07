"use client";

import { useUser, useOrganization, useOrganizationList, OrganizationProfile, CreateOrganization } from "@clerk/nextjs";
import { User, Building2, Plus, ArrowRight, CheckCircle, Users, Mail, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useState } from "react";
import { clerkAppearance } from "~/lib/clerk-appearance";
import { toast } from "sonner";

function Section({
    icon: Icon,
    title,
    description,
    children,
}: {
    icon: React.ElementType;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="border-b border-border pb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-base">{title}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-5 flex-1">{children}</CardContent>
        </Card>
    );
}

export default function SettingsPage() {
    const { user, isLoaded: userLoaded } = useUser();
    const { organization, membership, isLoaded: orgLoaded } = useOrganization();
    const { userMemberships, isLoaded: listLoaded } = useOrganizationList({ userMemberships: true });

    const [view, setView] = useState<"overview" | "manage" | "create">("overview");

    const isLoaded = userLoaded && orgLoaded && listLoaded;

    if (!isLoaded) {
        return (
            <div className="grid gap-4 md:grid-cols-2 animate-pulse">
                {[...Array(2)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-muted" />)}
            </div>
        );
    }

    // ── Create org view ────────────────────────────────────────────────────────
    if (view === "create") {
        return (
            <div className="space-y-4">
                <div className="border-b border-border pb-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Set Up Your Firm</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Create a workspace so your partners can join and share notices.
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setView("overview")}>
                        ← Back to Settings
                    </Button>
                </div>
                <div className="flex justify-start">
                    <CreateOrganization
                        afterCreateOrganizationUrl="/dashboard/settings"
                        appearance={clerkAppearance}
                    />
                </div>
            </div>
        );
    }

    // ── Manage org view (Clerk's full UI) ─────────────────────────────────────
    if (view === "manage" && organization) {
        return (
            <div className="space-y-4">
                <div className="border-b border-border pb-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Manage Team</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{organization.name}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setView("overview")}>
                        ← Back to Settings
                    </Button>
                </div>
                <OrganizationProfile
                    appearance={clerkAppearance}
                />
            </div>
        );
    }

    // ── Overview ────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Settings & Team</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Manage your personal account, firm workspace, and team members.
                </p>
            </div>

            {/* Profile + Organization Cards */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Profile */}
                <Section icon={User} title="Personal Profile" description="Your Clerk account details">
                    <div className="flex items-center gap-4 mb-5">
                        {user?.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={user.imageUrl} alt="Avatar" className="h-14 w-14 rounded-full border-2 border-border object-cover" />
                        ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-border bg-muted text-lg font-bold text-muted-foreground">
                                {user?.firstName?.[0] ?? "?"}
                            </div>
                        )}
                        <div>
                            <p className="font-semibold text-foreground">{user?.fullName ?? "—"}</p>
                            <p className="text-sm text-muted-foreground">{user?.primaryEmailAddress?.emailAddress ?? "—"}</p>
                            <Badge variant="outline" className="mt-1 text-xs capitalize">
                                {membership?.role?.replace("org:", "") ?? (user?.publicMetadata?.role as string) ?? "member"}
                            </Badge>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => window.open("https://accounts.clerk.com/user", "_blank")}>
                        Edit Profile on Clerk ↗
                    </Button>
                </Section>

                {/* Organization */}
                <Section icon={Building2} title="Firm Workspace" description={organization ? "Your active CA firm workspace" : "Create a firm to collaborate"}>
                    {organization ? (
                        <>
                            <div className="flex items-center gap-4 mb-5">
                                {organization.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={organization.imageUrl} alt="Org" className="h-14 w-14 rounded-lg border border-border object-cover" />
                                ) : (
                                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-xl font-black text-primary">
                                        {organization.name?.[0]}
                                    </div>
                                )}
                                <div>
                                    <p className="font-semibold text-foreground">{organization.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="secondary" className="text-xs">
                                            {organization.membersCount} member{organization.membersCount !== 1 ? "s" : ""}
                                        </Badge>
                                        <div className="flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400">
                                            <CheckCircle className="h-3 w-3" /> Active
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <Button className="w-full gap-2" size="sm" onClick={() => setView("manage")}>
                                <Users className="h-4 w-4" />
                                Manage Team & Workspace
                            </Button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[calc(100%-20px)] py-4 text-center">
                            <p className="text-sm text-muted-foreground mb-4">
                                You're currently working solo. Create a firm workspace to invite partners.
                            </p>
                            <Button size="sm" onClick={() => setView("create")} className="gap-2">
                                <Plus className="h-4 w-4" /> Create Firm Workspace
                            </Button>
                        </div>
                    )}
                </Section>
            </div>

            {/* Application Settings (Email Ingestion, WhatsApp, etc) */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Email Ingestion */}
                <Section icon={Mail} title="Email Ingestion" description="Forward tax notices to auto-read them">
                    <div className="flex flex-col h-[calc(100%-20px)] justify-center">
                        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Inbox Address
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                            <code className="flex-1 border border-border bg-background px-3 py-2 font-mono text-sm text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                                support@reznico.tech
                            </code>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    void navigator.clipboard.writeText("support@reznico.tech");
                                    toast.success("Inbox address copied!");
                                }}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="text-sm text-muted-foreground flex-1">
                            <p className="mb-2 font-semibold text-foreground">How it works:</p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li>Forward any email with a PDF notice</li>
                                <li>AI auto-extracts it every 15 mins</li>
                                <li>Appears in your Review Queue instantly</li>
                            </ul>
                        </div>
                    </div>
                </Section>
            </div>

            {/* How Multi-Partner Mode Works (Only show if no org) */}
            {!organization && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Why Create a Firm Workspace?</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {[
                            { step: "1", text: "You create a Firm Workspace (e.g. \"Shah & Associates\")" },
                            { step: "2", text: "Invite partners and junior staff by email — they sign in with their own Clerk accounts" },
                            { step: "3", text: "Assign roles: Admin (full access) or Member (can view and edit)" },
                            { step: "4", text: "Notices assigned to partners via the Kanban board — everyone sees the shared audit trail" },
                        ].map((item) => (
                            <div key={item.step} className="flex items-start gap-3">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                    {item.step}
                                </div>
                                <p className="text-sm text-muted-foreground">{item.text}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Existing Memberships Card (Only if they're in multiple orgs or to switch orgs) */}
            {userMemberships?.data && userMemberships.data.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Your Workspaces</CardTitle>
                        <CardDescription>You are a member of these firm workspaces</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {userMemberships.data.map((mem) => (
                            <div key={mem.organization.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                                <div className="flex items-center gap-3">
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium text-sm">{mem.organization.name}</span>
                                    {mem.organization.id === organization?.id && (
                                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 text-[10px]">Active</Badge>
                                    )}
                                    <Badge variant="outline" className="text-[10px] capitalize">{mem.role.replace("org:", "")}</Badge>
                                </div>
                                {/* Currently Clerk automatically sets active, so mostly informative */}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
