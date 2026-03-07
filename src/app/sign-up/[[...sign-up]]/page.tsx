import { SignUp } from "@clerk/nextjs";
import { clerkAppearance } from "~/lib/clerk-appearance";
import { Shield } from "lucide-react";

export default function SignUpPage() {
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
                        Your firm&apos;s<br />
                        <span className="text-[#BEFF00]">command</span><br />
                        centre
                    </h1>
                    <p className="text-[hsl(0_0%_55%)] text-lg leading-relaxed max-w-sm">
                        Set up in minutes. Upload your first notice. Let AI do the heavy lifting while you focus on the CA work that matters.
                    </p>

                    {/* Steps */}
                    <div className="space-y-3 pt-4 border-t border-[hsl(0_0%_14%)]">
                        {[
                            "Upload notice PDFs — AI extracts everything",
                            "Verify in one click, assign to team",
                            "Client approves on WhatsApp — no login needed",
                        ].map((step, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#BEFF00] text-[10px] font-black text-black mt-0.5">
                                    {i + 1}
                                </div>
                                <p className="text-sm text-[hsl(0_0%_65%)]">{step}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <p className="text-xs text-[hsl(0_0%_35%)]">
                    © {new Date().getFullYear()} VERITLOG — Built for Indian CAs
                </p>
            </div>

            {/* Right — Clerk SignUp */}
            <div className="flex flex-1 items-center justify-center p-6">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="flex items-center gap-2 mb-8 lg:hidden">
                        <Shield className="h-5 w-5 text-white" strokeWidth={1.5} />
                        <span className="text-sm font-bold uppercase tracking-widest text-white">VERITLOG</span>
                    </div>

                    <SignUp
                        appearance={clerkAppearance}
                        forceRedirectUrl="/dashboard"
                    />
                </div>
            </div>
        </div>
    );
}
