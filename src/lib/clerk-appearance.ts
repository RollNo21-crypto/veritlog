/**
 * Shared Clerk Appearance Configuration — VERITLOG Design System
 *
 * Defines the dark aesthetic matching the app's CSS variables.
 * Does NOT require @clerk/themes — uses Clerk's variables API directly.
 */

import type { Appearance } from "@clerk/nextjs/dist/types/types";

/**
 * Full branded appearance for embedded Clerk components:
 * OrganizationProfile, CreateOrganization, SignIn, SignUp
 */
export const clerkAppearance: Appearance = {
    variables: {
        // Dark palette — mirrors globals.css CSS vars in dark mode
        colorBackground: "hsl(0 0% 6%)",
        colorNeutral: "hsl(0 0% 96%)",
        colorText: "hsl(0 0% 96%)",
        colorTextSecondary: "hsl(0 0% 55%)",
        colorInputBackground: "hsl(0 0% 10%)",
        colorInputText: "hsl(0 0% 96%)",
        colorPrimary: "hsl(0 0% 96%)",
        colorDanger: "hsl(0 62% 50%)",
        colorSuccess: "hsl(142 71% 45%)",
        colorShimmer: "hsl(0 0% 15%)",

        // Shape & typography
        borderRadius: "0.375rem",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        fontSize: "0.875rem",
    },
    elements: {
        // ── Containers ───────────────────────────────────────────────────────
        card: "bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] shadow-none rounded-xl",
        rootBox: "w-full",
        pageScrollBox: "p-5",

        // ── Typography ───────────────────────────────────────────────────────
        headerTitle: "text-white font-bold tracking-tight",
        headerSubtitle: "text-[hsl(0_0%_55%)] text-sm",
        formFieldLabel: "text-[11px] font-semibold uppercase tracking-wide text-[hsl(0_0%_55%)]",
        formFieldHintText: "text-[hsl(0_0%_45%)] text-xs",
        identityPreviewText: "text-white",
        userPreviewMainIdentifier: "text-white font-semibold",
        userPreviewSecondaryIdentifier: "text-[hsl(0_0%_55%)] text-xs",

        // ── Inputs ───────────────────────────────────────────────────────────
        formFieldInput: "bg-[hsl(0_0%_8%)] border border-[hsl(0_0%_20%)] text-white rounded-md focus:border-white focus:ring-0 placeholder:text-[hsl(0_0%_35%)]",

        // ── Buttons ───────────────────────────────────────────────────────────
        formButtonPrimary: "bg-white text-black hover:bg-white/80 rounded-md font-semibold text-sm transition-colors shadow-none",
        formButtonReset: "border border-[hsl(0_0%_20%)] text-white bg-transparent hover:bg-[hsl(0_0%_12%)] rounded-md text-sm",
        footerActionLink: "text-white hover:underline",

        // ── Social / OAuth buttons ────────────────────────────────────────────
        socialButtonsBlockButton: "border border-[hsl(0_0%_20%)] bg-[hsl(0_0%_10%)] text-white hover:border-white hover:bg-[hsl(0_0%_14%)] rounded-md transition-colors",
        socialButtonsBlockButtonText: "text-white text-sm font-medium",

        // ── Divider ──────────────────────────────────────────────────────────
        dividerLine: "bg-[hsl(0_0%_18%)]",
        dividerText: "text-[hsl(0_0%_45%)] text-xs",

        // ── Org / member management ───────────────────────────────────────────
        navbar: "border-r border-[hsl(0_0%_18%)] bg-[hsl(0_0%_8%)]",
        navbarButton: "text-[hsl(0_0%_55%)] hover:text-white hover:bg-[hsl(0_0%_12%)] rounded-md",
        tableHead: "text-[11px] uppercase tracking-wide text-[hsl(0_0%_45%)]",
        memberListTableRow: "border-b border-[hsl(0_0%_14%)]",
        badge: "bg-[hsl(0_0%_14%)] text-white text-xs border border-[hsl(0_0%_20%)]",

        // ── Avatar ───────────────────────────────────────────────────────────
        avatarBox: "rounded-md border border-[hsl(0_0%_20%)]",

        // ── Alert / error ─────────────────────────────────────────────────────
        alert: "border border-red-500/40 bg-red-950/30 text-red-400 rounded-md",
        alertText: "text-red-400 text-sm",

        // ── Footer ───────────────────────────────────────────────────────────
        footerActionText: "text-[hsl(0_0%_45%)] text-xs",
        footer: "border-t border-[hsl(0_0%_18%)]",
    },
};

/**
 * Minimal appearance for UserButton avatar + popover
 * (sidebar bottom-left in dashboard/portal)
 */
export const userButtonAppearance: Appearance = {
    variables: {
        colorBackground: "hsl(0 0% 6%)",
        colorPrimary: "hsl(0 0% 96%)",
        colorText: "hsl(0 0% 96%)",
        colorNeutral: "hsl(0 0% 96%)",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        borderRadius: "0.375rem",
    },
    elements: {
        avatarBox: "h-9 w-9 rounded-md border border-[hsl(0_0%_20%)]",
        userButtonPopoverCard: "bg-[hsl(0_0%_8%)] border border-[hsl(0_0%_18%)] rounded-xl shadow-xl",
        userButtonPopoverActions: "p-1",
        userButtonPopoverActionButton: "text-white hover:bg-[hsl(0_0%_12%)] rounded-md",
        userButtonPopoverActionButtonText: "text-sm text-white",
        userButtonPopoverActionButtonIcon: "text-[hsl(0_0%_55%)]",
        userButtonPopoverFooter: "border-t border-[hsl(0_0%_18%)]",
        userPreviewMainIdentifier: "text-white font-semibold",
        userPreviewSecondaryIdentifier: "text-[hsl(0_0%_55%)] text-xs",
    },
};
