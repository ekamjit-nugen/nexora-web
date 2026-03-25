"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { clientApi, Client, ClientContactPerson } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// ── Industry Colors ──

const industryColors: Record<string, string> = {
  technology: "bg-blue-50 text-blue-700 border-blue-200",
  finance: "bg-emerald-50 text-emerald-700 border-emerald-200",
  healthcare: "bg-rose-50 text-rose-700 border-rose-200",
  education: "bg-violet-50 text-violet-700 border-violet-200",
  retail: "bg-orange-50 text-orange-700 border-orange-200",
  manufacturing: "bg-slate-50 text-slate-700 border-slate-200",
  media: "bg-pink-50 text-pink-700 border-pink-200",
  consulting: "bg-cyan-50 text-cyan-700 border-cyan-200",
  other: "bg-gray-50 text-gray-600 border-gray-200",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-50 text-gray-600 border-gray-200",
  prospect: "bg-amber-50 text-amber-700 border-amber-200",
};

const industries = [
  "technology", "finance", "healthcare", "education",
  "retail", "manufacturing", "media", "consulting", "other",
];

// ── Contact Person Form ──

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  designation: string;
  isPrimary: boolean;
}

const emptyContact: ContactFormData = {
  name: "",
  email: "",
  phone: "",
  designation: "",
  isPrimary: false,
};

// ── Client Form Modal ──

interface ClientFormData {
  companyName: string;
  displayName: string;
  industry: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactDesignation: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  website: string;
  taxId: string;
  currency: string;
  paymentTerms: string;
  status: string;
  tags: string;
  notes: string;
  contactPersons: ContactFormData[];
}

const emptyForm: ClientFormData = {
  companyName: "",
  displayName: "",
  industry: "technology",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  contactDesignation: "",
  street: "",
  city: "",
  state: "",
  country: "",
  zip: "",
  website: "",
  taxId: "",
  currency: "INR",
  paymentTerms: "30",
  status: "active",
  tags: "",
  notes: "",
  contactPersons: [],
};

function ClientFormModal({
  open,
  onClose,
  onSaved,
  client,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  client: Client | null;
}) {
  const isEdit = !!client;
  const [form, setForm] = useState<ClientFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client) {
      setForm({
        companyName: client.companyName || "",
        displayName: client.displayName || "",
        industry: client.industry || "technology",
        contactName: client.contactPerson?.name || "",
        contactEmail: client.contactPerson?.email || "",
        contactPhone: client.contactPerson?.phone || "",
        contactDesignation: client.contactPerson?.designation || "",
        street: client.billingAddress?.street || "",
        city: client.billingAddress?.city || "",
        state: client.billingAddress?.state || "",
        country: client.billingAddress?.country || "",
        zip: client.billingAddress?.zip || "",
        website: client.website || "",
        taxId: client.taxId || "",
        currency: client.currency || "INR",
        paymentTerms: String(client.paymentTerms || 30),
        status: client.status || "active",
        tags: (client.tags || []).join(", "),
        notes: client.notes || "",
        contactPersons: (client.contactPersons || []).map(cp => ({
          name: cp.name,
          email: cp.email,
          phone: cp.phone || "",
          designation: cp.designation || "",
          isPrimary: cp.isPrimary,
        })),
      });
    } else {
      setForm(emptyForm);
    }
  }, [client, open]);

  if (!open) return null;

  const handleChange = (field: keyof ClientFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addContactPerson = () => {
    setForm(prev => ({
      ...prev,
      contactPersons: [...prev.contactPersons, { ...emptyContact }],
    }));
  };

  const removeContactPerson = (idx: number) => {
    setForm(prev => ({
      ...prev,
      contactPersons: prev.contactPersons.filter((_, i) => i !== idx),
    }));
  };

  const updateContactPerson = (idx: number, field: keyof ContactFormData, value: string | boolean) => {
    setForm(prev => {
      const updated = [...prev.contactPersons];
      updated[idx] = { ...updated[idx], [field]: value };
      // If setting primary, unset others
      if (field === "isPrimary" && value === true) {
        updated.forEach((cp, i) => {
          if (i !== idx) cp.isPrimary = false;
        });
      }
      return { ...prev, contactPersons: updated };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }

    setSaving(true);
    try {
      const tags = form.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload: Record<string, unknown> = {
        companyName: form.companyName.trim(),
        industry: form.industry,
        currency: form.currency,
        paymentTerms: parseInt(form.paymentTerms) || 30,
        status: form.status,
        tags,
      };

      if (form.displayName.trim()) payload.displayName = form.displayName.trim();
      if (form.website.trim()) payload.website = form.website.trim();
      if (form.taxId.trim()) payload.taxId = form.taxId.trim();
      if (form.notes.trim()) payload.notes = form.notes.trim();

      if (form.contactName || form.contactEmail || form.contactPhone || form.contactDesignation) {
        payload.contactPerson = {
          name: form.contactName.trim(),
          email: form.contactEmail.trim(),
          phone: form.contactPhone.trim(),
          designation: form.contactDesignation.trim(),
        };
      }

      if (form.street || form.city || form.state || form.country || form.zip) {
        payload.billingAddress = {
          street: form.street.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          country: form.country.trim(),
          zip: form.zip.trim(),
        };
      }

      if (isEdit) {
        await clientApi.updateClient(client._id, payload as Partial<Client>);

        // Sync contact persons: remove all existing, then add new ones
        if (client.contactPersons && client.contactPersons.length > 0) {
          for (let i = client.contactPersons.length - 1; i >= 0; i--) {
            await clientApi.removeContact(client._id, i).catch(() => {});
          }
        }
        for (const cp of form.contactPersons) {
          if (cp.name && cp.email) {
            await clientApi.addContact(client._id, {
              name: cp.name.trim(),
              email: cp.email.trim(),
              phone: cp.phone.trim() || undefined,
              designation: cp.designation.trim() || undefined,
              isPrimary: cp.isPrimary,
            }).catch(() => {});
          }
        }

        toast.success("Client updated successfully");
      } else {
        const res = await clientApi.createClient(payload as Partial<Client>);
        // Add contact persons to newly created client
        const newId = (res.data as Client)?._id;
        if (newId && form.contactPersons.length > 0) {
          for (const cp of form.contactPersons) {
            if (cp.name && cp.email) {
              await clientApi.addContact(newId, {
                name: cp.name.trim(),
                email: cp.email.trim(),
                phone: cp.phone.trim() || undefined,
                designation: cp.designation.trim() || undefined,
                isPrimary: cp.isPrimary,
              }).catch(() => {});
            }
          }
        }
        toast.success("Client created successfully");
      }

      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save client";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-[720px] max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#F1F5F9]">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">
              {isEdit ? "Edit Client" : "Add Client"}
            </h2>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              {isEdit ? "Update client information" : "Add a new client to your organization"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#F1F5F9] transition-colors text-[#94A3B8]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Company Name & Display Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.companyName}
                onChange={(e) => handleChange("companyName", e.target.value)}
                placeholder="Acme Corp"
                className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
                required
              />
            </div>
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Display Name</Label>
              <Input
                value={form.displayName}
                onChange={(e) => handleChange("displayName", e.target.value)}
                placeholder="Acme"
                className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
              />
            </div>
          </div>

          {/* Industry & Website */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Industry</Label>
              <select
                value={form.industry}
                onChange={(e) => handleChange("industry", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#334155]"
              >
                {industries.map((i) => (
                  <option key={i} value={i}>
                    {i.charAt(0).toUpperCase() + i.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Website</Label>
              <Input
                value={form.website}
                onChange={(e) => handleChange("website", e.target.value)}
                placeholder="https://acme.com"
                className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
              />
            </div>
          </div>

          {/* Primary Contact Person (backward compat) */}
          <div>
            <p className="text-[12px] font-semibold text-[#334155] mb-2">Primary Contact</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Name</Label>
                <Input
                  value={form.contactName}
                  onChange={(e) => handleChange("contactName", e.target.value)}
                  placeholder="John Doe"
                  className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
                />
              </div>
              <div>
                <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Email</Label>
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => handleChange("contactEmail", e.target.value)}
                  placeholder="john@acme.com"
                  className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
                />
              </div>
              <div>
                <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Phone</Label>
                <Input
                  value={form.contactPhone}
                  onChange={(e) => handleChange("contactPhone", e.target.value)}
                  placeholder="+91 98765 43210"
                  className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
                />
              </div>
              <div>
                <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Designation</Label>
                <Input
                  value={form.contactDesignation}
                  onChange={(e) => handleChange("contactDesignation", e.target.value)}
                  placeholder="CTO"
                  className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Additional Contact Persons */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-semibold text-[#334155]">Additional Contacts</p>
              <button
                type="button"
                onClick={addContactPerson}
                className="text-[12px] font-medium text-[#2E86C1] hover:text-[#1A5276] flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Contact
              </button>
            </div>
            {form.contactPersons.map((cp, idx) => (
              <div key={idx} className="border border-[#E2E8F0] rounded-lg p-3 mb-2 bg-[#FAFBFC]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium text-[#64748B]">Contact #{idx + 1}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[11px] text-[#475569] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cp.isPrimary}
                        onChange={(e) => updateContactPerson(idx, "isPrimary", e.target.checked)}
                        className="rounded border-[#CBD5E1]"
                      />
                      Primary
                    </label>
                    <button
                      type="button"
                      onClick={() => removeContactPerson(idx)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    value={cp.name}
                    onChange={(e) => updateContactPerson(idx, "name", e.target.value)}
                    placeholder="Name"
                    className="h-9 text-sm bg-white border-[#E2E8F0] rounded-lg"
                  />
                  <Input
                    type="email"
                    value={cp.email}
                    onChange={(e) => updateContactPerson(idx, "email", e.target.value)}
                    placeholder="Email"
                    className="h-9 text-sm bg-white border-[#E2E8F0] rounded-lg"
                  />
                  <Input
                    value={cp.phone}
                    onChange={(e) => updateContactPerson(idx, "phone", e.target.value)}
                    placeholder="Phone"
                    className="h-9 text-sm bg-white border-[#E2E8F0] rounded-lg"
                  />
                  <Input
                    value={cp.designation}
                    onChange={(e) => updateContactPerson(idx, "designation", e.target.value)}
                    placeholder="Designation"
                    className="h-9 text-sm bg-white border-[#E2E8F0] rounded-lg"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Billing Address */}
          <div>
            <p className="text-[12px] font-semibold text-[#334155] mb-2">Billing Address</p>
            <div className="space-y-3">
              <Input
                value={form.street}
                onChange={(e) => handleChange("street", e.target.value)}
                placeholder="Street address"
                className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  value={form.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  placeholder="City"
                  className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
                />
                <Input
                  value={form.state}
                  onChange={(e) => handleChange("state", e.target.value)}
                  placeholder="State"
                  className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  value={form.country}
                  onChange={(e) => handleChange("country", e.target.value)}
                  placeholder="Country"
                  className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
                />
                <Input
                  value={form.zip}
                  onChange={(e) => handleChange("zip", e.target.value)}
                  placeholder="ZIP / Postal Code"
                  className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Tax ID */}
          <div>
            <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Tax ID (GST/VAT)</Label>
            <Input
              value={form.taxId}
              onChange={(e) => handleChange("taxId", e.target.value)}
              placeholder="22AAAAA0000A1Z5"
              className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
            />
          </div>

          {/* Currency, Payment Terms, Status */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Currency</Label>
              <select
                value={form.currency}
                onChange={(e) => handleChange("currency", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#334155]"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Payment Terms (days)</Label>
              <Input
                type="number"
                value={form.paymentTerms}
                onChange={(e) => handleChange("paymentTerms", e.target.value)}
                placeholder="30"
                className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
              />
            </div>
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Status</Label>
              <select
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#334155]"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="prospect">Prospect</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Tags</Label>
            <Input
              value={form.tags}
              onChange={(e) => handleChange("tags", e.target.value)}
              placeholder="enterprise, recurring, priority (comma-separated)"
              className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
            />
            <p className="text-[11px] text-[#94A3B8] mt-1">Separate tags with commas</p>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Notes</Label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Additional notes about this client..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#334155] resize-none focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              onClick={onClose}
              className="h-10 px-5 rounded-xl text-sm font-medium bg-white text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="h-10 px-5 rounded-xl text-sm font-medium bg-[#2E86C1] hover:bg-[#2471A3] text-white disabled:opacity-50"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </span>
              ) : isEdit ? (
                "Save Changes"
              ) : (
                "Add Client"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ──

function DeleteModal({
  open,
  onClose,
  onConfirm,
  clientName,
  deleting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  clientName: string;
  deleting: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-[420px] mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[#0F172A]">Delete Client</h3>
            <p className="text-[13px] text-[#64748B]">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-[13px] text-[#475569] mb-5">
          Are you sure you want to delete <span className="font-semibold">{clientName}</span>?
        </p>
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl text-sm font-medium bg-white text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="h-9 px-4 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Client Detail Panel ──

function ClientDetailPanel({
  client,
  onClose,
  onEdit,
  onRefresh,
}: {
  client: Client;
  onClose: () => void;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "projects" | "invoices" | "activity">("overview");
  const [projects, setProjects] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [newContact, setNewContact] = useState<ContactFormData>({ ...emptyContact });

  const fetchClientProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const res = await clientApi.getProjects(client._id);
      setProjects((res.data as any[]) || []);
    } catch {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [client._id]);

  const fetchAllProjects = useCallback(async () => {
    // Projects feature removed
    setAllProjects([]);
  }, []);

  useEffect(() => {
    fetchClientProjects();
    fetchAllProjects();
  }, [fetchClientProjects, fetchAllProjects]);

  const handleLinkProject = async (projectId: string) => {
    try {
      await clientApi.linkProject(client._id, projectId);
      toast.success("Project linked");
      setShowProjectPicker(false);
      fetchClientProjects();
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to link project");
    }
  };

  const handleUnlinkProject = async (projectId: string) => {
    try {
      await clientApi.unlinkProject(client._id, projectId);
      toast.success("Project unlinked");
      fetchClientProjects();
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unlink project");
    }
  };

  const handleAddContact = async () => {
    if (!newContact.name || !newContact.email) {
      toast.error("Name and email are required");
      return;
    }
    try {
      await clientApi.addContact(client._id, {
        name: newContact.name,
        email: newContact.email,
        phone: newContact.phone || undefined,
        designation: newContact.designation || undefined,
        isPrimary: newContact.isPrimary,
      });
      toast.success("Contact added");
      setNewContact({ ...emptyContact });
      setAddingContact(false);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add contact");
    }
  };

  const handleRemoveContact = async (idx: number) => {
    try {
      await clientApi.removeContact(client._id, idx);
      toast.success("Contact removed");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove contact");
    }
  };

  const initials = (client.displayName || client.companyName)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const linkedProjectIds = client.projectIds || [];
  const availableProjects = allProjects.filter(p => !linkedProjectIds.includes(p._id));

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "projects" as const, label: `Projects (${linkedProjectIds.length})` },
    { key: "invoices" as const, label: "Invoices" },
    { key: "activity" as const, label: "Activity" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-[840px] max-h-[90vh] overflow-hidden mx-0 sm:mx-4 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#F1F5F9]">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-[#2E86C1] flex items-center justify-center text-white font-bold text-lg shrink-0">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-[#0F172A]">{client.companyName}</h2>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${statusColors[client.status] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                    {client.status}
                  </span>
                </div>
                {client.displayName && (
                  <p className="text-[13px] text-[#64748B] mt-0.5">{client.displayName}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize ${industryColors[client.industry] || industryColors.other}`}>
                    {client.industry}
                  </span>
                  {client.website && (
                    <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#2E86C1] hover:underline">
                      {client.website}
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onEdit}
                className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#EBF5FB] transition-colors text-[#2E86C1]"
                title="Edit"
              >
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#F1F5F9] transition-colors text-[#94A3B8]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Revenue summary */}
          <div className="grid grid-cols-4 gap-3 mt-5">
            <div className="bg-[#F8FAFC] rounded-lg p-3">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider">Revenue</p>
              <p className="text-[15px] font-bold text-[#0F172A] mt-0.5">
                {client.currency} {(client.totalRevenue || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-[#F8FAFC] rounded-lg p-3">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider">Outstanding</p>
              <p className="text-[15px] font-bold text-[#0F172A] mt-0.5">
                {client.currency} {(client.outstandingAmount || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-[#F8FAFC] rounded-lg p-3">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider">Projects</p>
              <p className="text-[15px] font-bold text-[#0F172A] mt-0.5">{linkedProjectIds.length}</p>
            </div>
            <div className="bg-[#F8FAFC] rounded-lg p-3">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider">Terms</p>
              <p className="text-[15px] font-bold text-[#0F172A] mt-0.5">{client.paymentTerms}d</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 mt-5 border-b border-[#F1F5F9] -mb-6 -mx-6 px-6">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-[13px] font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "text-[#2E86C1] border-[#2E86C1]"
                    : "text-[#64748B] border-transparent hover:text-[#334155]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Contact Persons */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-semibold text-[#334155]">Contact Persons</h3>
                  <button
                    onClick={() => setAddingContact(true)}
                    className="text-[12px] font-medium text-[#2E86C1] hover:text-[#1A5276] flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </button>
                </div>

                {/* Legacy contact person */}
                {client.contactPerson?.name && (
                  <div className="flex items-center justify-between p-3 bg-[#F8FAFC] rounded-lg mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#2E86C1]/10 flex items-center justify-center text-[#2E86C1] font-semibold text-sm">
                        {client.contactPerson.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[#0F172A]">
                          {client.contactPerson.name}
                          {client.contactPerson.designation && (
                            <span className="text-[#94A3B8] font-normal ml-1.5 text-[11px]">({client.contactPerson.designation})</span>
                          )}
                        </p>
                        <div className="flex items-center gap-3 text-[12px] text-[#64748B]">
                          {client.contactPerson.email && <span>{client.contactPerson.email}</span>}
                          {client.contactPerson.phone && <span>{client.contactPerson.phone}</span>}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">Legacy</span>
                  </div>
                )}

                {/* New contact persons */}
                {(client.contactPersons || []).map((cp, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-[#F8FAFC] rounded-lg mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#2E86C1]/10 flex items-center justify-center text-[#2E86C1] font-semibold text-sm">
                        {cp.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[#0F172A]">
                          {cp.name}
                          {cp.designation && (
                            <span className="text-[#94A3B8] font-normal ml-1.5 text-[11px]">({cp.designation})</span>
                          )}
                          {cp.isPrimary && (
                            <span className="ml-2 text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">Primary</span>
                          )}
                        </p>
                        <div className="flex items-center gap-3 text-[12px] text-[#64748B]">
                          <span>{cp.email}</span>
                          {cp.phone && <span>{cp.phone}</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveContact(idx)}
                      className="text-red-400 hover:text-red-600 p-1"
                      title="Remove contact"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}

                {!client.contactPerson?.name && (!client.contactPersons || client.contactPersons.length === 0) && (
                  <p className="text-[13px] text-[#94A3B8] py-3">No contact persons added yet.</p>
                )}

                {/* Add contact inline form */}
                {addingContact && (
                  <div className="border border-[#E2E8F0] rounded-lg p-3 mt-2 bg-[#FAFBFC]">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <Input
                        value={newContact.name}
                        onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Name *"
                        className="h-9 text-sm bg-white border-[#E2E8F0] rounded-lg"
                      />
                      <Input
                        type="email"
                        value={newContact.email}
                        onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Email *"
                        className="h-9 text-sm bg-white border-[#E2E8F0] rounded-lg"
                      />
                      <Input
                        value={newContact.phone}
                        onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="Phone"
                        className="h-9 text-sm bg-white border-[#E2E8F0] rounded-lg"
                      />
                      <Input
                        value={newContact.designation}
                        onChange={(e) => setNewContact(prev => ({ ...prev, designation: e.target.value }))}
                        placeholder="Designation"
                        className="h-9 text-sm bg-white border-[#E2E8F0] rounded-lg"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 text-[12px] text-[#475569] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newContact.isPrimary}
                          onChange={(e) => setNewContact(prev => ({ ...prev, isPrimary: e.target.checked }))}
                          className="rounded border-[#CBD5E1]"
                        />
                        Primary contact
                      </label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={() => { setAddingContact(false); setNewContact({ ...emptyContact }); }}
                          className="h-8 px-3 rounded-lg text-[12px] font-medium bg-white text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC]"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={handleAddContact}
                          className="h-8 px-3 rounded-lg text-[12px] font-medium bg-[#2E86C1] hover:bg-[#2471A3] text-white"
                        >
                          Add Contact
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Billing Address */}
              {client.billingAddress && (client.billingAddress.street || client.billingAddress.city) && (
                <div>
                  <h3 className="text-[13px] font-semibold text-[#334155] mb-2">Billing Address</h3>
                  <div className="bg-[#F8FAFC] rounded-lg p-3 text-[13px] text-[#475569]">
                    {client.billingAddress.street && <p>{client.billingAddress.street}</p>}
                    <p>
                      {[client.billingAddress.city, client.billingAddress.state].filter(Boolean).join(", ")}
                      {client.billingAddress.zip ? ` - ${client.billingAddress.zip}` : ""}
                    </p>
                    {client.billingAddress.country && <p>{client.billingAddress.country}</p>}
                  </div>
                </div>
              )}

              {/* Details */}
              <div>
                <h3 className="text-[13px] font-semibold text-[#334155] mb-2">Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#F8FAFC] rounded-lg p-3">
                    <p className="text-[11px] text-[#94A3B8]">Currency</p>
                    <p className="text-[13px] font-medium text-[#0F172A]">{client.currency}</p>
                  </div>
                  <div className="bg-[#F8FAFC] rounded-lg p-3">
                    <p className="text-[11px] text-[#94A3B8]">Payment Terms</p>
                    <p className="text-[13px] font-medium text-[#0F172A]">{client.paymentTerms} days</p>
                  </div>
                  {client.taxId && (
                    <div className="bg-[#F8FAFC] rounded-lg p-3">
                      <p className="text-[11px] text-[#94A3B8]">Tax ID</p>
                      <p className="text-[13px] font-medium text-[#0F172A]">{client.taxId}</p>
                    </div>
                  )}
                  <div className="bg-[#F8FAFC] rounded-lg p-3">
                    <p className="text-[11px] text-[#94A3B8]">Created</p>
                    <p className="text-[13px] font-medium text-[#0F172A]">
                      {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {client.tags && client.tags.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-semibold text-[#334155] mb-2">Tags</h3>
                  <div className="flex gap-1.5 flex-wrap">
                    {client.tags.map(tag => (
                      <span key={tag} className="text-[12px] bg-[#F1F5F9] text-[#475569] px-2.5 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {client.notes && (
                <div>
                  <h3 className="text-[13px] font-semibold text-[#334155] mb-2">Notes</h3>
                  <p className="text-[13px] text-[#475569] bg-[#F8FAFC] rounded-lg p-3 whitespace-pre-wrap">{client.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Projects Tab */}
          {activeTab === "projects" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13px] font-semibold text-[#334155]">Linked Projects</h3>
                <button
                  onClick={() => setShowProjectPicker(!showProjectPicker)}
                  className="text-[12px] font-medium text-[#2E86C1] hover:text-[#1A5276] flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Link Project
                </button>
              </div>

              {/* Project Picker Dropdown */}
              {showProjectPicker && (
                <div className="border border-[#E2E8F0] rounded-lg p-3 mb-4 bg-[#FAFBFC]">
                  <p className="text-[12px] font-medium text-[#475569] mb-2">Select a project to link:</p>
                  {availableProjects.length === 0 ? (
                    <p className="text-[13px] text-[#94A3B8] py-2">No projects available to link.</p>
                  ) : (
                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                      {availableProjects.map(p => (
                        <button
                          key={p._id}
                          onClick={() => handleLinkProject(p._id)}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#EBF5FB] transition-colors flex items-center justify-between group"
                        >
                          <div>
                            <p className="text-[13px] font-medium text-[#0F172A]">{p.projectName}</p>
                            <p className="text-[11px] text-[#94A3B8]">{p.status} - {p.category || "General"}</p>
                          </div>
                          <svg className="w-4 h-4 text-[#2E86C1] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {loadingProjects ? (
                <div className="flex justify-center py-10">
                  <svg className="animate-spin h-6 w-6 text-[#2E86C1]" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-[#64748B]">No projects linked yet</p>
                  <p className="text-[12px] text-[#94A3B8] mt-1">Link projects to track work for this client</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {projects.map(p => (
                    <div key={p._id} className="flex items-center justify-between p-3 bg-[#F8FAFC] rounded-lg hover:bg-[#F1F5F9] transition-colors">
                      <div>
                        <p className="text-[13px] font-medium text-[#0F172A]">{p.projectName}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            p.status === "active" ? "bg-emerald-50 text-emerald-700" :
                            p.status === "completed" ? "bg-blue-50 text-blue-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {p.status}
                          </span>
                          <span className="text-[11px] text-[#94A3B8]">{p.progressPercentage}% complete</span>
                          {p.team && <span className="text-[11px] text-[#94A3B8]">{p.team.length} members</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleUnlinkProject(p._id)}
                        className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        title="Unlink project"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Invoices Tab */}
          {activeTab === "invoices" && (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[#334155]">Invoices</p>
              <p className="text-[12px] text-[#94A3B8] mt-1">
                Invoice management for this client will appear here.
              </p>
              {client.lastInvoiceDate && (
                <p className="text-[12px] text-[#64748B] mt-3">
                  Last invoice: {new Date(client.lastInvoiceDate).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === "activity" && (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[#334155]">Activity Log</p>
              <p className="text-[12px] text-[#94A3B8] mt-1">
                Client activity history will be available here soon.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Clients Page ──

export default function ClientsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, prospects: 0 });
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Delete state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Detail panel state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;

      const [clientsRes, statsRes] = await Promise.all([
        clientApi.getClients(params),
        clientApi.getStats(),
      ]);

      setClients(clientsRes.data || []);
      if (statsRes.data) setStats(statsRes.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load clients";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // Refresh selected client when data changes
  const refreshSelectedClient = useCallback(async () => {
    if (!selectedClient) return;
    try {
      const res = await clientApi.getClient(selectedClient._id);
      if (res.data) {
        setSelectedClient(res.data as Client);
        fetchData();
      }
    } catch {
      // Client may have been deleted
      setSelectedClient(null);
      fetchData();
    }
  }, [selectedClient, fetchData]);

  const openAddModal = () => {
    setEditingClient(null);
    setModalOpen(true);
  };

  const openEditModal = (c: Client) => {
    setEditingClient(c);
    setModalOpen(true);
  };

  const openDeleteModal = (c: Client) => {
    setDeletingClient(c);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingClient) return;
    setDeleting(true);
    try {
      await clientApi.deleteClient(deletingClient._id);
      toast.success("Client deleted successfully");
      setDeleteModalOpen(false);
      setDeletingClient(null);
      if (selectedClient?._id === deletingClient._id) setSelectedClient(null);
      fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete client";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  // Protected route: admin, super_admin, hr, manager
  const allowedRoles = ["admin", "super_admin", "hr", "manager"];
  const hasAccess = user.roles?.some((r) => allowedRoles.includes(r));

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex bg-[#F8FAFC]">
        <Sidebar user={user} onLogout={logout} />
        <main className="flex-1 ml-[260px] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#0F172A]">Access Denied</h2>
            <p className="text-[13px] text-[#64748B] mt-1">You do not have permission to view this page.</p>
          </div>
        </main>
      </div>
    );
  }

  const canManageClients = user.roles?.some((r) =>
    ["admin", "super_admin", "hr"].includes(r)
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      <main className="flex-1 ml-[260px] p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Clients</h1>
            <p className="text-[13px] text-[#64748B] mt-1">
              Manage your organization&apos;s client relationships
            </p>
          </div>
          {canManageClients && (
            <Button
              onClick={openAddModal}
              className="h-11 bg-[#2E86C1] hover:bg-[#2471A3] text-white font-medium px-5 rounded-xl text-[15px]"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Client
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Clients",
              value: stats.total,
              icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
              color: "text-blue-600 bg-blue-50",
            },
            {
              label: "Active",
              value: stats.active,
              icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
              color: "text-emerald-600 bg-emerald-50",
            },
            {
              label: "Total Revenue",
              value: `${clients.reduce((sum, c) => sum + (c.totalRevenue || 0), 0).toLocaleString()}`,
              icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
              color: "text-violet-600 bg-violet-50",
            },
            {
              label: "Outstanding",
              value: `${clients.reduce((sum, c) => sum + (c.outstandingAmount || 0), 0).toLocaleString()}`,
              icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
              color: "text-amber-600 bg-amber-50",
            },
          ].map((stat) => (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#64748B]">{stat.label}</p>
                  <p className="text-lg font-bold text-[#0F172A] mt-1">{stat.value}</p>
                </div>
                <div className={`w-11 h-11 rounded-xl ${stat.color} flex items-center justify-center`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                  </svg>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input
                  placeholder="Search by company name, contact, or tag..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-11 text-[15px] bg-[#F8FAFC] border-[#E2E8F0] rounded-xl"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-11 px-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#475569] min-w-[140px]"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="prospect">Prospect</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Client List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : clients.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[#334155]">No clients found</p>
              <p className="text-[13px] text-[#94A3B8] mt-1">
                {search || filterStatus
                  ? "Try adjusting your filters"
                  : "Add your first client to get started"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {clients.map((client) => {
              const initials = (client.displayName || client.companyName)
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              const projectCount = client.projectIds?.length || 0;

              return (
                <Card
                  key={client._id}
                  className="border-0 shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
                  onClick={() => setSelectedClient(client)}
                >
                  <CardContent className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-[#2E86C1] flex items-center justify-center text-white font-semibold text-sm shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#0F172A] truncate">{client.companyName}</p>
                          {client.displayName && (
                            <p className="text-[13px] text-[#64748B] truncate">{client.displayName}</p>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize shrink-0 ${statusColors[client.status] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                        {client.status}
                      </span>
                    </div>

                    {/* Industry Badge & Project Count */}
                    <div className="mb-3 flex items-center gap-2">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize ${industryColors[client.industry] || industryColors.other}`}>
                        {client.industry}
                      </span>
                      {projectCount > 0 && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#EBF5FB] text-[#2E86C1] border border-[#BFDBFE]">
                          {projectCount} project{projectCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {/* Contact Person */}
                    {client.contactPerson?.name && (
                      <div className="mb-3 space-y-1">
                        <div className="flex items-center gap-2 text-[13px]">
                          <svg className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="text-[#334155] truncate">{client.contactPerson.name}</span>
                          {client.contactPerson.designation && (
                            <span className="text-[#94A3B8] text-[11px]">({client.contactPerson.designation})</span>
                          )}
                        </div>
                        {client.contactPerson.email && (
                          <div className="flex items-center gap-2 text-[12px]">
                            <svg className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="text-[#64748B] truncate">{client.contactPerson.email}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Revenue & Payment Terms */}
                    <div className="flex items-center gap-4 text-[13px] mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#94A3B8]">Revenue:</span>
                        <span className="text-[#334155] font-medium">{client.currency} {(client.totalRevenue || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#94A3B8]">Terms:</span>
                        <span className="text-[#334155] font-medium">{client.paymentTerms}d</span>
                      </div>
                    </div>

                    {/* Tags */}
                    {client.tags && client.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap mb-3">
                        {client.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                        {client.tags.length > 3 && (
                          <span className="text-[10px] bg-[#F1F5F9] text-[#94A3B8] px-1.5 py-0.5 rounded-full">
                            +{client.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {canManageClients && (
                      <div className="flex items-center gap-2 pt-3 border-t border-[#F1F5F9]">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditModal(client); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 text-[12px] font-medium text-[#2E86C1] hover:text-[#1A5276] px-2.5 py-1.5 rounded-lg hover:bg-[#EBF5FB]"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openDeleteModal(client); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 text-[12px] font-medium text-red-500 hover:text-red-700 px-2.5 py-1.5 rounded-lg hover:bg-red-50"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Client Form Modal */}
      <ClientFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingClient(null);
        }}
        onSaved={() => {
          fetchData();
          if (selectedClient) refreshSelectedClient();
        }}
        client={editingClient}
      />

      {/* Delete Confirmation Modal */}
      <DeleteModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingClient(null);
        }}
        onConfirm={handleDelete}
        clientName={deletingClient?.companyName || ""}
        deleting={deleting}
      />

      {/* Client Detail Panel */}
      {selectedClient && (
        <ClientDetailPanel
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onEdit={() => {
            setEditingClient(selectedClient);
            setModalOpen(true);
          }}
          onRefresh={refreshSelectedClient}
        />
      )}
    </div>
  );
}
