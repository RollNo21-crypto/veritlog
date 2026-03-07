"use client";

import { useOrganization, useOrganizationList, useUser, OrganizationProfile, CreateOrganization } from "@clerk/nextjs";
import { useState } from "react";
import {
    Users,
    Building2,
    Plus,
    ChevronDown,
    CheckCircle,
    ArrowRight,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { clerkAppearance } from "~/lib/clerk-appearance";

export default function TeamPage() {
    const { user } = useUser();
    const { organization, isLoaded: orgLoaded } = useOrganization();
    const { userMemberships, isLoaded: listLoaded } = useOrganizationList({ userMemberships: true });

    const [view, setView] = useState<"overview" | "manage" | "create">("overview");

    const isLoaded = orgLoaded && listLoaded;

    if (!isLoaded) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-12 w-64 rounded-lg bg-muted" />
                <div className="h-64 rounded-xl bg-muted" />
            </div>
        );
    }

    // ── Create org view ────────────────────────────────────────────────────────
    if (view === "create") {
        return (
            <div className="space-y-4">
                <div className="border-b border-border pb-4">
                    <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Set Up Your Firm</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Create a workspace so your partners can join and share notices.
                    </p>
                </div>
                <div className="flex justify-start">
                    <CreateOrganization
                        afterCreateOrganizationUrl="/dashboard/team"
                        appearance={clerkAppearance}
                    />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setView("overview")}>
                    ← Back
                </Button>
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
                        ← Back to overview
                    </Button>
                </div>
                <OrganizationProfile
                    appearance={clerkAppearance}
                />
            </div>
        );
    }

    // ── Overview (no org — prompt to create or join) ───────────────────────────
    if (!organization) {
        return (
            <div className="space-y-6">
                <div className="border-b border-border pb-4">
                    <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Team & Firm</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Add partners, assign roles, and manage your CA firm as a team.
                    </p>
                </div>

                {/* Solo mode banner */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-5">
                    <p className="font-semibold text-foreground mb-1">You&apos;re currently working solo</p>
                    <p className="text-sm text-muted-foreground">
                        To add partners, create a <strong>Firm Workspace</strong>. All your notices, clients, and audit trail will be shared with everyone in the workspace.
                    </p>
                </div>

                {/* How it works */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">How Multi-Partner Mode Works</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {[
                            { step: "1", text: "You create a Firm Workspace (e.g. \"Shah & Associates\")" },
                            { step: "2", text: "Invite partners and junior staff by email — they sign in with their own Clerk accounts" },
                            { step: "3", text: "Assign roles: Admin (full access) or Member (can view and edit)" },
                            { step: "4", text: "Notices assigned to partners via the Kanban board — everyone sees the shared audit trail" },
                            { step: "5", text: "When a senior partner verifies a response, the audit log records exactly who approved it" },
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

                {/* Existing memberships */}
                {userMemberships?.data && userMemberships.data.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Existing Workspaces</CardTitle>
                            <CardDescription>You&apos;re already a member of these workspaces</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {userMemberships.data.map((mem) => (
                                <div key={mem.organization.id} className="flex items-center justify-between rounded-lg border p-3">
                                    <div className="flex items-center gap-3">
                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium text-sm">{mem.organization.name}</span>
                                        <Badge variant="outline" className="text-xs">{mem.role}</Badge>
                                    </div>
                                    <Button size="sm" variant="outline">Switch to this Workspace</Button>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                <Button
                    className="gap-2"
                    onClick={() => setView("create")}
                >
                    <Plus className="h-4 w-4" />
                    Create Firm Workspace
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </div>
        );
    }

    // ── Overview (has org) ─────────────────────────────────────────────────────
    const memberCount = organization.membersCount ?? 0;

    return (
        <div className="space-y-6">
            <div className="border-b border-border pb-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Team & Firm</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Manage your firm workspace and team members</p>
                </div>
                <Button onClick={() => setView("manage")} className="gap-2">
                    <Users className="h-4 w-4" />
                    Manage Team
                </Button>
            </div>

            {/* Org card */}
            <Card className="border-primary/20">
                <CardContent className="pt-5">
                    <div className="flex items-center gap-4">
                        {organization.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={organization.imageUrl} alt="Firm" className="h-14 w-14 rounded-xl border border-border object-cover" />
                        ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-2xl font-black text-primary">
                                {organization.name?.[0]}
                            </div>
                        )}
                        <div>
                            <p className="text-xl font-bold text-foreground">{organization.name}</p>
                            <div className="flex items-center gap-3 mt-1">
                                <Badge variant="secondary">{memberCount} member{memberCount !== 1 ? "s" : ""}</Badge>
                                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                    <CheckCircle className="h-3 w-3" />
                                    Active
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* What org mode enables */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">What&apos;s Active in Firm Mode</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {[
                        "All notices are shared across the firm — every partner can see and act on them",
                        "Kanban board lets you assign notices to specific team members",
                        "Audit trail records each person's actions individually (who verified, who approved)",
                        "Clients are shared — any team member can update a client profile",
                        "WhatsApp alerts go to the CA phone number set in Settings",
                    ].map((item, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="h-4 w-4 shrink-0 text-green-500 mt-0.5" />
                            {item}
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Invite quick info */}
            <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold text-foreground mb-1">How to invite a partner or staff member</p>
                <p className="text-sm text-muted-foreground">
                    Click <strong>Manage Team</strong> above → <strong>Members</strong> → <strong>Invite</strong> → enter their email address. They&apos;ll receive a link to join the workspace. You can set them as <em>Admin</em> (full access) or <em>Member</em> (limited access).
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setView("manage")}>
                    Open Member Management →
                </Button>
            </div>
        </div>
    );
}
