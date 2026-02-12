"use client";

import { Moon, Sun } from "lucide-react";

export function DarkModeToggle() {
    const handleToggle = () => {
        const html = document.documentElement;
        const isDark = html.classList.contains("dark");

        if (isDark) {
            html.classList.remove("dark");
            localStorage.setItem("theme", "light");
        } else {
            html.classList.add("dark");
            localStorage.setItem("theme", "dark");
        }
    };

    return (
        <button
            onClick={handleToggle}
            className="border border-border bg-background p-2 hover:border-foreground transition-colors"
            aria-label="Toggle dark mode"
        >
            <Moon className="h-5 w-5 text-foreground dark:hidden" strokeWidth={1.5} />
            <Sun className="hidden h-5 w-5 text-foreground dark:block" strokeWidth={1.5} />
        </button>
    );
}
