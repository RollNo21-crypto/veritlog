"use client";

import { api } from "~/trpc/react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Save, Flag } from "lucide-react";
import Link from "next/link";

export default function VerifyNoticePage() {
    const params = useParams();
    const router = useRouter();
    const noticeId = params.id as string;

    const { data: notice, isLoading } = api.notice.getById.useQuery({ id: noticeId });
    const updateMutation = api.notice.update.useMutation();
    const verifyMutation = api.notice.verify.useMutation();

    const [formData, setFormData] = useState({
        authority: "",
        noticeType: "",
        amount: "",
        deadline: "",
        section: "",
        financialYear: "",
    });

    // Update form when notice loads
    useState(() => {
        if (notice) {
            setFormData({
                authority: notice.authority || "",
                noticeType: notice.noticeType || "",
                amount: notice.amount ? (notice.amount / 100).toString() : "",
                deadline: notice.deadline || "",
                section: notice.section || "",
                financialYear: notice.financialYear || "",
            });
        }
    });

    const handleSave = async () => {
        await updateMutation.mutateAsync({
            id: noticeId,
            ...formData,
            amount: formData.amount ? parseFloat(formData.amount) * 100 : null,
        });
        alert("Changes saved!");
    };

    const handleVerify = async () => {
        await verifyMutation.mutateAsync({ id: noticeId });
        alert("Notice marked as verified!");
        router.push("/dashboard/review");
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                    <p className="mt-4 text-gray-600">Loading notice...</p>
                </div>
            </div>
        );
    }

    if (!notice) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-center">
                    <p className="text-lg font-medium text-gray-700">Notice not found</p>
                    <Link href="/dashboard/review" className="mt-4 inline-block text-blue-600 hover:underline">
                        Back to Review Queue
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen flex-col">
            {/* Header */}
            <div className="border-b bg-white px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard/review"
                            className="rounded-md p-2 hover:bg-gray-100"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold">Verify Notice</h1>
                            <p className="text-sm text-gray-600">{notice.fileName}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={updateMutation.isPending}
                            className="flex items-center gap-2 rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-400"
                        >
                            <Save className="h-4 w-4" />
                            Save Changes
                        </button>
                        <button
                            onClick={handleVerify}
                            disabled={verifyMutation.isPending}
                            className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-green-400"
                        >
                            Mark as Verified
                        </button>
                    </div>
                </div>
            </div>

            {/* Split View */}
            <div className="flex flex-1 overflow-hidden">
                {/* PDF Viewer (Left) */}
                <div className="w-1/2 border-r bg-gray-50 p-4">
                    <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white">
                        <div className="text-center">
                            <p className="text-gray-600">PDF Viewer</p>
                            <p className="mt-2 text-sm text-gray-500">
                                {notice.fileUrl || "No file URL available"}
                            </p>
                            <p className="mt-4 text-xs text-gray-400">
                                TODO: Integrate react-pdf viewer
                            </p>
                        </div>
                    </div>
                </div>

                {/* Edit Form (Right) */}
                <div className="w-1/2 overflow-y-auto bg-white p-6">
                    <h2 className="mb-6 text-lg font-semibold">Extracted Data</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Authority *
                            </label>
                            <input
                                type="text"
                                value={formData.authority}
                                onChange={(e) => setFormData({ ...formData, authority: e.target.value })}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                                placeholder="e.g., GST Department, Maharashtra"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Notice Type *
                            </label>
                            <input
                                type="text"
                                value={formData.noticeType}
                                onChange={(e) => setFormData({ ...formData, noticeType: e.target.value })}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                                placeholder="e.g., Show Cause Notice"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Amount (₹)
                            </label>
                            <input
                                type="number"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                                placeholder="250000"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Deadline *
                            </label>
                            <input
                                type="date"
                                value={formData.deadline}
                                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Section/Act
                            </label>
                            <input
                                type="text"
                                value={formData.section}
                                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                                placeholder="e.g., Section 74 of CGST Act, 2017"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Financial Year
                            </label>
                            <input
                                type="text"
                                value={formData.financialYear}
                                onChange={(e) => setFormData({ ...formData, financialYear: e.target.value })}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                                placeholder="e.g., 2023-24"
                            />
                        </div>

                        <div className="pt-4">
                            <button
                                className="flex w-full items-center justify-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                            >
                                <Flag className="h-4 w-4" />
                                Report Template Issue
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
