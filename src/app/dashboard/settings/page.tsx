"use client";

import { User, Bell, Shield, Square } from "lucide-react";

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">Settings</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Manage your account and application preferences
                </p>
            </div>

            {/* Profile Settings */}
            <div className="border border-border bg-card p-6">
                <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center border border-border bg-background">
                        <User className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold uppercase tracking-tight text-card-foreground">Profile Settings</h2>
                        <p className="text-sm text-muted-foreground">
                            Manage your personal information
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-foreground">
                            Display Name
                        </label>
                        <input
                            type="text"
                            placeholder="Your name"
                            className="w-full border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-foreground">
                            Email
                        </label>
                        <input
                            type="email"
                            placeholder="your@email.com"
                            className="w-full border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
                        />
                    </div>

                    <button className="border-2 border-accent bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wider text-accent-foreground hover:bg-transparent hover:text-accent">
                        Save Changes
                    </button>
                </div>
            </div>

            {/* Notification Settings */}
            <div className="border border-border bg-card p-6">
                <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center border border-border bg-background">
                        <Bell className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold uppercase tracking-tight text-card-foreground">Notifications</h2>
                        <p className="text-sm text-muted-foreground">
                            Configure alert preferences
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    {[
                        { label: "Email notifications", description: "Receive email alerts for important updates" },
                        { label: "Deadline reminders", description: "Get notified before notice deadlines" },
                        { label: "Review queue alerts", description: "Alerts when notices need verification" },
                    ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between border border-border bg-background p-4">
                            <div>
                                <p className="font-bold uppercase tracking-tight text-foreground">{item.label}</p>
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input type="checkbox" className="peer sr-only" />
                                <div className="peer h-6 w-11 border border-border bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:border after:border-border after:bg-background after:transition-all peer-checked:border-foreground peer-checked:bg-foreground peer-checked:after:translate-x-full peer-checked:after:border-foreground"></div>
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            {/* Security Settings */}
            <div className="border border-border bg-card p-6">
                <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center border border-border bg-background">
                        <Shield className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold uppercase tracking-tight text-card-foreground">Security</h2>
                        <p className="text-sm text-muted-foreground">
                            Manage authentication and access
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    <button className="w-full border border-border bg-background px-4 py-4 text-left text-sm font-bold uppercase tracking-tight text-foreground hover:border-foreground">
                        Change Password
                    </button>
                    <button className="w-full border border-border bg-background px-4 py-4 text-left text-sm font-bold uppercase tracking-tight text-foreground hover:border-foreground">
                        Two-Factor Authentication
                    </button>
                    <button className="w-full border border-border bg-background px-4 py-4 text-left text-sm font-bold uppercase tracking-tight text-foreground hover:border-foreground">
                        Active Sessions
                    </button>
                </div>
            </div>
        </div>
    );
}
