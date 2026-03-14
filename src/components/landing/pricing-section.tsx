"use client";

import { useState } from "react";
import { Check, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";

const TIERS = [
    {
        name: "Starter",
        price: "₹1,999",
        description: "For small businesses tracking basic compliance.",
        features: ["Up to 10 notices/month", "Email ingestion", "Basic AI summaries", "Standard support"],
    },
    {
        name: "Pro CA Firm",
        price: "₹4,999",
        description: "For CAs managing multiple clients.",
        features: ["Unlimited notices", "WhatsApp Alerts (Twilio)", "Pine Labs Integration", "Priority support"],
        featured: true,
    },
    {
        name: "Enterprise",
        price: "Custom",
        description: "For large audit firms with complex workflows.",
        features: ["Custom API integrations", "Dedicated account manager", "White-labeling", "On-premise deployment"],
    },
];

export function PricingSection() {
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

    const handleSubscribe = (planName: string) => {
        setSelectedPlan(planName);
        setIsCheckoutOpen(true);
    };

    return (
        <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    Simple, transparent pricing
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                    Choose the right plan for your compliance needs. Powered securely by Pine Labs.
                </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {TIERS.map((tier) => (
                    <div
                        key={tier.name}
                        className={`flex flex-col rounded-2xl border ${tier.featured
                                ? "border-primary bg-primary/5 shadow-xl shadow-primary/10"
                                : "border-border bg-card"
                            } p-8`}
                    >
                        <div className="mb-6">
                            <h3 className="text-xl font-semibold text-foreground">{tier.name}</h3>
                            <div className="mt-4 flex items-baseline text-4xl font-extrabold text-foreground">
                                {tier.price}
                                {tier.price !== "Custom" && <span className="ml-1 text-xl font-medium text-muted-foreground">/mo</span>}
                            </div>
                            <p className="mt-4 text-sm text-muted-foreground">{tier.description}</p>
                        </div>

                        <ul className="mb-8 flex-1 space-y-4">
                            {tier.features.map((feature) => (
                                <li key={feature} className="flex items-start">
                                    <Check className="mr-3 h-5 w-5 shrink-0 text-primary" />
                                    <span className="text-sm text-muted-foreground">{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <Button
                            variant={tier.featured ? "default" : "outline"}
                            className={`w-full ${tier.featured ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                            onClick={() => handleSubscribe(tier.name)}
                        >
                            Get Started
                        </Button>

                        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                            <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                            <span>Payments by <span className="font-semibold text-foreground">Pine Labs</span></span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Mocked Pine Labs Checkout Dialog */}
            <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
                <DialogContent className="max-w-md border-border bg-card p-0 sm:max-w-md">
                    <div className="flex flex-col items-center justify-center border-b border-border bg-muted p-6 text-center">
                        {/* Mock Pine Labs Logo Area */}
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
                            <div className="text-2xl font-black italic tracking-tighter text-emerald-600">pine<span className="text-slate-800">labs</span></div>
                        </div>
                        <DialogTitle className="text-xl">Secure Checkout</DialogTitle>
                        <DialogDescription className="mt-2 text-foreground">
                            Subscribe to <span className="font-semibold text-primary">{selectedPlan} Plan</span>
                        </DialogDescription>
                    </div>

                    <div className="p-6">
                        <div className="mb-6 rounded-lg border border-border bg-background p-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Plan</span>
                                <span className="font-medium text-foreground">{selectedPlan}</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Billing Cycle</span>
                                <span className="font-medium text-foreground">Monthly</span>
                            </div>
                            <div className="my-3 border-t border-border"></div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-foreground">Total Due Today</span>
                                <span className="text-lg font-bold text-foreground">
                                    {TIERS.find(t => t.name === selectedPlan)?.price === "Custom" ? "Contact Sales" : TIERS.find(t => t.name === selectedPlan)?.price}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-lg border border-primary/50 bg-primary/5 p-4 ring-1 ring-primary">
                                <div className="flex items-center gap-3">
                                    <CreditCard className="h-5 w-5 text-primary" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-foreground">Credit / Debit Card</p>
                                        <p className="text-xs text-muted-foreground">Visa, Mastercard, RuPay</p>
                                    </div>
                                    <div className="h-4 w-4 rounded-full border-[5px] border-primary"></div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-border p-4 opacity-50 transition-opacity hover:opacity-100">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold bg-muted-foreground text-background">UPI</div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-foreground">UPI ID / QR Code</p>
                                        <p className="text-xs text-muted-foreground">GPay, PhonePe, Paytm</p>
                                    </div>
                                    <div className="h-4 w-4 rounded-full border border-muted-foreground"></div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col gap-3">
                            <Button
                                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                                onClick={() => {
                                    alert("Simulated: Subscription successful via Pine Labs Recurring Billing API.");
                                    setIsCheckoutOpen(false);
                                }}
                            >
                                Pay Securely
                            </Button>
                            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                <span>PCI-DSS Certified Gateway by Pine Labs</span>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    );
}
