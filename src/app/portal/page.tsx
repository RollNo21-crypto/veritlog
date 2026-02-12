"use client";

export default function ClientPortalPage() {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Client Portal</h1>
                <p className="mt-2 text-gray-600">
                    Share notice status and updates with your clients
                </p>
            </div>

            <div className="rounded-lg border bg-white p-8 text-center">
                <h2 className="text-xl font-semibold text-gray-900">
                    Epic 4: Client Portal
                </h2>
                <p className="mt-4 text-gray-600">
                    Features: Read-only notice view, status tracking, deadline alerts,
                    secure access links
                </p>
                <div className="mt-6 text-sm text-gray-500">
                    Implementation: Public notice view pages, share links, client
                    notifications
                </div>
            </div>
        </div>
    );
}
