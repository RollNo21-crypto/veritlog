"use client";

import { useUser, useOrganization } from "@clerk/nextjs";
import { User, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

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
        <Card>
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
            <CardContent className="pt-5">{children}</CardContent>
        </Card>
    );
}

export default function SettingsPage() {
    const { user, isLoaded } = useUser();
    const { organization } = useOrganization();

    if (!isLoaded) {
        return (
            <div className="grid gap-4 md:grid-cols-2 animate-pulse">
                {[...Array(2)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-muted" />)}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Settings</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Manage your account and firm workspace
                </p>
            </div>

            {/* Profile + Organization */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Profile */}
                <Section icon={User} title="Profile" description="Your Clerk account details">
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
                            <Badge variant="outline" className="mt-1 text-xs">
                                {(user?.publicMetadata?.role as string) ?? "member"}
                            </Badge>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => window.open("https://accounts.clerk.com/user", "_blank")}>
                        Edit Profile on Clerk ↗
                    </Button>
                </Section>

                {/* Organization */}
                <Section icon={Building2} title="Organization" description="Your firm workspace">
                    {organization ? (
                        <>
                            <div className="flex items-center gap-3 mb-4">
                                {organization.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={organization.imageUrl} alt="Org" className="h-12 w-12 rounded-lg border border-border object-cover" />
                                ) : (
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-xl font-black text-primary">
                                        {organization.name?.[0]}
                                    </div>
                                )}
                                <div>
                                    <p className="font-semibold text-foreground">{organization.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {organization.membersCount} member{organization.membersCount !== 1 ? "s" : ""}
                                    </p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => window.location.href = "/dashboard/team"}>
                                Manage Team →
                            </Button>
                        </>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-sm text-muted-foreground mb-3">
                                No firm workspace yet. Create one to add partners.
                            </p>
                            <Button size="sm" onClick={() => window.location.href = "/dashboard/team"}>
                                Set Up Firm Workspace →
                            </Button>
                        </div>
                    )}
                </Section>
            </div>
        </div>
    );
}
