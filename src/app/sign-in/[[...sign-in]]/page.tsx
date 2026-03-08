import { SignIn } from "@clerk/nextjs";
import { clerkAppearance } from "~/lib/clerk-appearance";
import { Shield } from "lucide-react";

export default function SignInPage() {
    return (
        <div className="flex min-h-screen bg-[hsl(0_0%_6%)]">
            {/* Left — Brand panel */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-[hsl(0_0%_14%)]">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center border border-[hsl(0_0%_20%)]">
                        <Shield className="h-5 w-5 text-white" strokeWidth={1.5} />
                    </div>
                    <div>
                        <div className="text-sm font-bold uppercase tracking-widest text-white">VERITLOG</div>
                        <div className="text-[10px] text-[hsl(0_0%_45%)] tracking-wider">TAX NOTICE INTELLIGENCE</div>
                    </div>
                </div>

                {/* Hero copy */}
                <div className="space-y-6">
                    <h1 className="text-5xl font-black uppercase tracking-tight text-white leading-none">
                        Zero-entry<br />
                        <span className="text-[#BEFF00]">notice</span><br />
                        digitisation
                    </h1>
                    <p className="text-[hsl(0_0%_55%)] text-lg leading-relaxed max-w-sm">
                        AI reads your tax notices. You verify in one click. Clients approve on WhatsApp.
                    </p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[hsl(0_0%_14%)]">
                        {[
                            { value: "2 min", label: "Avg processing time" },
                            { value: "94%", label: "AI accuracy" },
                            { value: "7 yr", label: "Retention policy" },
                        ].map((s) => (
                            <div key={s.label}>
                                <div className="text-2xl font-black text-white">{s.value}</div>
                                <div className="text-xs text-[hsl(0_0%_45%)] mt-0.5">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <p className="text-xs text-[hsl(0_0%_35%)]">
                    © {new Date().getFullYear()} VERITLOG — Built for Indian CAs
                </p>
            </div>

            {/* Right — Clerk SignIn */}
            <div className="flex flex-1 items-center justify-center p-6">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="flex items-center gap-2 mb-8 lg:hidden">
                        <Shield className="h-5 w-5 text-white" strokeWidth={1.5} />
                        <span className="text-sm font-bold uppercase tracking-widest text-white">VERITLOG</span>
                    </div>

                    <SignIn
                        appearance={clerkAppearance}
                        forceRedirectUrl="/dashboard"
                    />
                </div>
            </div>
        </div>
    );
}
