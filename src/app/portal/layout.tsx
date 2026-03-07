"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DarkModeToggle } from "~/components/dark-mode-toggle";
import { UserButton } from "@clerk/nextjs";
import { Shield } from "lucide-react";
import { userButtonAppearance } from "~/lib/clerk-appearance";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    const { isLoaded, isSignedIn } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            void router.push("/sign-in");
        }
    }, [isLoaded, isSignedIn, router]);

    if (!isLoaded) return null;

    return (
        <div className="min-h-screen bg-background">
            {/* Portal Header */}
            <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
                            <Shield className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-bold uppercase tracking-wider text-foreground">VERITLOG</p>
                            <p className="text-[10px] text-muted-foreground">Client Portal</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <DarkModeToggle />
                        <UserButton afterSignOutUrl="/sign-in" appearance={userButtonAppearance} />
                    </div>
                </div>
            </header>

            {/* Portal Content */}
            <main className="mx-auto max-w-5xl px-6 py-8">
                {children}
            </main>
        </div>
    );
}
