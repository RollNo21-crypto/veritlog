import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileText, Zap, Shield, BarChart3 } from "lucide-react";
import { PricingSection } from "~/components/landing/pricing-section";

export default function HomePage() {
  return (
    <>
      <SignedIn>
        {redirect("/dashboard")}
      </SignedIn>

      <SignedOut>
        <div className="flex min-h-screen flex-col bg-background">
          {/* Hero Section - Mobile First */}
          <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20">
            <div className="mx-auto max-w-4xl text-center">
              {/* Badge */}
              <div className="mb-6 inline-block rounded-full bg-primary/10 px-4 py-2 text-xs font-medium text-primary sm:text-sm">
                AI-Powered Tax Notice Management
              </div>

              {/* Title */}
              <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
                VERITLOG
              </h1>

              {/* Subtitle */}
              <p className="mb-8 text-base text-muted-foreground sm:text-lg md:text-xl">
                Zero-entry notice digitization for Chartered Accountants.
                <br className="hidden sm:inline" />
                Upload or forward emails, get instant AI extraction.
              </p>

              {/* CTA Button */}
              <SignInButton mode="modal">
                <button className="group inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 sm:px-8 sm:py-4 sm:text-base">
                  Get Started
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 sm:h-5 sm:w-5" />
                </button>
              </SignInButton>
            </div>

            {/* Features Grid - Mobile First */}
            <div className="mx-auto mt-12 grid max-w-6xl gap-4 sm:mt-16 sm:gap-6 md:mt-20 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {[
                {
                  icon: FileText,
                  title: "Smart Ingestion",
                  description: "Upload PDFs or forward emails. Automatic extraction with AI.",
                  color: "text-blue-500",
                },
                {
                  icon: Zap,
                  title: "Instant Verification",
                  description: "Side-by-side PDF review with confidence scoring.",
                  color: "text-purple-500",
                },
                {
                  icon: Shield,
                  title: "Compliance Ready",
                  description: "Audit logs, data retention, and security validation.",
                  color: "text-green-500",
                },
                {
                  icon: BarChart3,
                  title: "Analytics",
                  description: "Track accuracy, deadlines, and team performance.",
                  color: "text-orange-500",
                },
              ].map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={idx}
                    className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg"
                  >
                    <div className={`mb-4 inline-block rounded-lg bg-muted p-3 ${feature.color}`}>
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <h3 className="mb-2 text-base font-semibold text-card-foreground sm:text-lg">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <PricingSection />

            {/* CTA Section - Mobile First */}
            <div className="mx-auto mt-24 max-w-3xl rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center sm:p-10 md:p-12">
              <h2 className="mb-3 text-2xl font-bold text-foreground sm:text-3xl md:mb-4 md:text-4xl">
                Ready to transform your notice management?
              </h2>
              <p className="mb-6 text-sm text-muted-foreground sm:text-base md:mb-8 md:text-lg">
                Join CAs who've eliminated manual data entry
              </p>
              <SignInButton mode="modal">
                <button className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 sm:px-8 sm:py-4 sm:text-base">
                  Start Free Trial
                </button>
              </SignInButton>
            </div>
          </div>
        </div>
      </SignedOut>
    </>
  );
}
