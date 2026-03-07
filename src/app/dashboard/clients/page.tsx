"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import {
    Building2,
    Plus,
    Search,
    Mail,
    Phone,
    FileText,
    Pencil,
    Trash2,
    Loader2,
    X,
    Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import { toast } from "sonner";

type Client = {
    id: string;
    businessName: string;
    gstin: string | null;
    pan: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    createdAt: Date | null;
};

const EMPTY_FORM = {
    businessName: "",
    gstin: "",
    pan: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
};

export default function ClientsPage() {
    const [search, setSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editClient, setEditClient] = useState<Client | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const { data: clients, isLoading, refetch } = api.clients.list.useQuery();

    const createMutation = api.clients.create.useMutation({
        onSuccess: () => {
            toast.success("Client created");
            setShowModal(false);
            setForm(EMPTY_FORM);
            void refetch();
        },
        onError: () => toast.error("Failed to create client"),
    });

    const updateMutation = api.clients.update.useMutation({
        onSuccess: () => {
            toast.success("Client updated");
            setEditClient(null);
            setShowModal(false);
            setForm(EMPTY_FORM);
            void refetch();
        },
        onError: () => toast.error("Failed to update client"),
    });

    const deleteMutation = api.clients.delete.useMutation({
        onSuccess: () => {
            toast.success("Client deleted");
            setDeleteConfirm(null);
            void refetch();
        },
        onError: () => toast.error("Failed to delete client"),
    });

    const inviteMutation = api.clients.sendPortalInvite.useMutation({
        onSuccess: (data) => {
            if (data.alreadyInvited) {
                toast.info("Client was already invited — resend not needed");
            } else {
                toast.success("Portal invite sent successfully!");
            }
        },
        onError: (e) => toast.error(e.message || "Failed to send invite"),
    });

    const handleOpenCreate = () => {
        setEditClient(null);
        setForm(EMPTY_FORM);
        setShowModal(true);
    };

    const handleOpenEdit = (client: Client) => {
        setEditClient(client);
        setForm({
            businessName: client.businessName,
            gstin: client.gstin ?? "",
            pan: client.pan ?? "",
            contactName: client.contactName ?? "",
            contactEmail: client.contactEmail ?? "",
            contactPhone: client.contactPhone ?? "",
        });
        setShowModal(true);
    };

    const handleSubmit = async () => {
        const payload = {
            businessName: form.businessName,
            gstin: form.gstin || undefined,
            pan: form.pan || undefined,
            contactName: form.contactName || undefined,
            contactEmail: form.contactEmail || undefined,
            contactPhone: form.contactPhone || undefined,
        };

        if (editClient) {
            await updateMutation.mutateAsync({ id: editClient.id, ...payload });
        } else {
            await createMutation.mutateAsync(payload);
        }
    };

    const filtered = clients?.filter((c) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            c.businessName.toLowerCase().includes(q) ||
            c.pan?.toLowerCase().includes(q) ||
            c.gstin?.toLowerCase().includes(q) ||
            c.contactEmail?.toLowerCase().includes(q)
        );
    });

    const isMutating = createMutation.isPending || updateMutation.isPending;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                    <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">
                        Clients
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Manage your client profiles and tax identifiers
                    </p>
                </div>
                <Button onClick={handleOpenCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Client
                </Button>
            </div>

            {/* Search */}
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Search by name, PAN, GSTIN…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Client Grid */}
            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-48 rounded-lg" />
                    ))}
                </div>
            ) : !filtered?.length ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <Building2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
                        <p className="text-lg font-medium text-foreground">
                            {search ? "No clients match your search" : "No clients yet"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {!search && "Add your first client to link notices to them"}
                        </p>
                        {!search && (
                            <Button className="mt-4" onClick={handleOpenCreate}>
                                <Plus className="mr-2 h-4 w-4" /> Add Client
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((client) => (
                        <Card key={client.id} className="group relative overflow-hidden">
                            <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-primary"
                                    title="Invite to Portal"
                                    onClick={() => inviteMutation.mutate({ clientId: client.id })}
                                    disabled={inviteMutation.isPending || !client.contactEmail}
                                >
                                    {inviteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => handleOpenEdit(client)}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => setDeleteConfirm(client.id)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>

                            <CardHeader className="pb-2">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                        <Building2 className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <CardTitle className="truncate text-base">
                                            {client.businessName}
                                        </CardTitle>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {client.pan && (
                                                <Badge variant="outline" className="text-xs font-mono">
                                                    PAN: {client.pan}
                                                </Badge>
                                            )}
                                            {client.gstin && (
                                                <Badge variant="outline" className="text-xs font-mono">
                                                    GSTIN: {client.gstin.slice(0, 8)}…
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-1.5 pt-0 text-sm text-muted-foreground">
                                {client.contactName && (
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{client.contactName}</span>
                                    </div>
                                )}
                                {client.contactEmail && (
                                    <div className="flex items-center gap-2">
                                        <Mail className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{client.contactEmail}</span>
                                    </div>
                                )}
                                {client.contactPhone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-3.5 w-3.5 shrink-0" />
                                        <span>{client.contactPhone}</span>
                                    </div>
                                )}
                                {!client.contactName && !client.contactEmail && !client.contactPhone && (
                                    <p className="italic">No contact info</p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create / Edit Modal */}
            <Dialog open={showModal} onOpenChange={(open) => { if (!open) { setShowModal(false); setForm(EMPTY_FORM); setEditClient(null); } }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editClient ? "Edit Client" : "Add New Client"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Business Name <span className="text-destructive">*</span></Label>
                            <Input
                                value={form.businessName}
                                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                                placeholder="Acme Pvt Ltd"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>PAN</Label>
                                <Input
                                    value={form.pan}
                                    onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                                    placeholder="AAAAA0000A"
                                    className="font-mono uppercase"
                                    maxLength={10}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>GSTIN</Label>
                                <Input
                                    value={form.gstin}
                                    onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                                    placeholder="22AAAAA0000A1Z5"
                                    className="font-mono uppercase"
                                    maxLength={15}
                                />
                            </div>
                        </div>
                        <Separator />
                        <div className="space-y-1.5">
                            <Label>Contact Name</Label>
                            <Input
                                value={form.contactName}
                                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                                placeholder="Rajesh Kumar"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    value={form.contactEmail}
                                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                                    placeholder="contact@acme.com"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Phone</Label>
                                <Input
                                    type="tel"
                                    value={form.contactPhone}
                                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                                    placeholder="+91 98765 43210"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isMutating || !form.businessName.trim()}
                        >
                            {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editClient ? "Save Changes" : "Create Client"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm Dialog */}
            <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Client?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This will permanently delete the client profile. Notices linked to this client will remain but lose the client association.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteConfirm && deleteMutation.mutate({ id: deleteConfirm })}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
