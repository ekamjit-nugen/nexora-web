"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/sidebar";
import { invoiceApi, clientApi } from "@/lib/api";
import type { Invoice, InvoiceItem, InvoiceTemplate, InvoiceStats, Client } from "@/lib/api";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  partially_paid: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

const LAYOUT_PREVIEWS: Record<string, { label: string; accent: string; desc: string }> = {
  standard: { label: "Standard", accent: "#2E86C1", desc: "Clean layout with logo and tax details" },
  modern: { label: "Modern", accent: "#1E293B", desc: "Dark header, minimalist design" },
  minimal: { label: "Minimal", accent: "#6B7280", desc: "No frills, just the numbers" },
  professional: { label: "Professional", accent: "#7C3AED", desc: "Two-column header with detailed footer" },
  creative: { label: "Creative", accent: "#EC4899", desc: "Colorful with modern typography" },
};

function formatCurrency(amount: number, currency: string = "INR"): string {
  const symbols: Record<string, string> = { USD: "$", EUR: "\u20AC", GBP: "\u00A3", INR: "\u20B9" };
  const symbol = symbols[currency] || currency + " ";
  return `${symbol}${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function InvoicesPage() {
  const { user, logout } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Form state
  const [formClientId, setFormClientId] = useState("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formIssueDate, setFormIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [formDueDate, setFormDueDate] = useState("");
  const [formItems, setFormItems] = useState<InvoiceItem[]>([
    { description: "", quantity: 1, rate: 0, amount: 0, taxRate: 0, taxAmount: 0 },
  ]);
  const [formDiscount, setFormDiscount] = useState(0);
  const [formDiscountType, setFormDiscountType] = useState<"fixed" | "percentage">("fixed");
  const [formCurrency, setFormCurrency] = useState("INR");
  const [formPaymentTerms, setFormPaymentTerms] = useState(30);
  const [formNotes, setFormNotes] = useState("");
  const [formTerms, setFormTerms] = useState("");
  const [formTemplateName, setFormTemplateName] = useState("");
  const [formBrandName, setFormBrandName] = useState("");
  const [formBrandAddress, setFormBrandAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Send modal state
  const [sendEmail, setSendEmail] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendMessage, setSendMessage] = useState("");

  // Pay modal state
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("");
  const [payNotes, setPayNotes] = useState("");

  const fetchInvoices = useCallback(async () => {
    try {
      const params: Record<string, string> = {
        page: String(pagination.page),
        limit: String(pagination.limit),
      };
      if (statusFilter && statusFilter !== "all") params.status = statusFilter;
      if (clientFilter) params.clientId = clientFilter;
      if (searchQuery) params.search = searchQuery;

      const res = await invoiceApi.getAll(params);
      setInvoices((res.data as Invoice[]) || []);
      if (res.pagination) setPagination(res.pagination);
    } catch (err: any) {
      toast.error(err.message || "Failed to load invoices");
    }
  }, [statusFilter, clientFilter, searchQuery, pagination.page, pagination.limit]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await invoiceApi.getStats();
      setStats(res.data || null);
    } catch {}
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await invoiceApi.getTemplates();
      setTemplates((res.data as InvoiceTemplate[]) || []);
    } catch {}
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await clientApi.getClients({ limit: "200" });
      setClients((res.data as Client[]) || []);
    } catch {}
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      // Projects feature removed — skip loading
      setProjects([]);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([fetchInvoices(), fetchStats(), fetchTemplates(), fetchClients(), fetchProjects()]).finally(() =>
      setLoading(false)
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const recalculateItems = (items: InvoiceItem[]): InvoiceItem[] => {
    return items.map((item) => {
      const amount = item.quantity * item.rate;
      const taxAmount = item.taxRate ? (amount * item.taxRate) / 100 : 0;
      return { ...item, amount: Math.round(amount * 100) / 100, taxAmount: Math.round(taxAmount * 100) / 100 };
    });
  };

  const getFormTotals = () => {
    const items = recalculateItems(formItems);
    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const taxTotal = items.reduce((s, i) => s + (i.taxAmount || 0), 0);
    const discountAmt =
      formDiscountType === "percentage" ? ((subtotal + taxTotal) * formDiscount) / 100 : formDiscount;
    const total = subtotal + taxTotal - discountAmt;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      discountAmt: Math.round(discountAmt * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  };

  const resetForm = () => {
    setFormClientId("");
    setFormProjectId("");
    setFormIssueDate(new Date().toISOString().split("T")[0]);
    setFormDueDate("");
    setFormItems([{ description: "", quantity: 1, rate: 0, amount: 0, taxRate: 0, taxAmount: 0 }]);
    setFormDiscount(0);
    setFormDiscountType("fixed");
    setFormCurrency("INR");
    setFormPaymentTerms(30);
    setFormNotes("");
    setFormTerms("");
    setFormTemplateName("");
    setFormBrandName("");
    setFormBrandAddress("");
    setEditingInvoice(null);
  };

  const applyTemplate = (template: InvoiceTemplate) => {
    setFormCurrency(template.defaultCurrency);
    setFormPaymentTerms(template.defaultPaymentTerms);
    setFormNotes(template.defaultNotes || "");
    setFormTerms(template.defaultTerms || "");
    setFormTemplateName(template.name);
    if (template.defaultItems && template.defaultItems.length > 0) {
      setFormItems(
        template.defaultItems.map((di) => ({
          description: di.description,
          quantity: 1,
          rate: di.rate,
          amount: di.rate,
          taxRate: 0,
          taxAmount: 0,
        }))
      );
    }
  };

  const openEditModal = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormClientId(invoice.clientId);
    setFormProjectId(invoice.projectId || "");
    setFormIssueDate(invoice.issueDate.split("T")[0]);
    setFormDueDate(invoice.dueDate.split("T")[0]);
    setFormItems(invoice.items.length > 0 ? invoice.items : [{ description: "", quantity: 1, rate: 0, amount: 0, taxRate: 0, taxAmount: 0 }]);
    setFormDiscount(invoice.discount);
    setFormDiscountType(invoice.discountType as "fixed" | "percentage");
    setFormCurrency(invoice.currency);
    setFormPaymentTerms(invoice.paymentTerms);
    setFormNotes(invoice.notes || "");
    setFormTerms(invoice.terms || "");
    setFormTemplateName(invoice.templateName || "");
    setFormBrandName(invoice.brandName || "");
    setFormBrandAddress(invoice.brandAddress || "");
    setShowCreateModal(true);
  };

  const handleSave = async (asDraft: boolean) => {
    if (!formClientId) {
      toast.error("Please select a client");
      return;
    }
    if (!formDueDate) {
      toast.error("Please set a due date");
      return;
    }
    if (formItems.some((i) => !i.description || i.rate <= 0)) {
      toast.error("Please fill in all item descriptions and rates");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        clientId: formClientId,
        projectId: formProjectId || undefined,
        templateName: formTemplateName || undefined,
        issueDate: formIssueDate,
        dueDate: formDueDate,
        items: recalculateItems(formItems),
        discount: formDiscount,
        discountType: formDiscountType,
        currency: formCurrency,
        paymentTerms: formPaymentTerms,
        notes: formNotes || undefined,
        terms: formTerms || undefined,
        brandName: formBrandName || undefined,
        brandAddress: formBrandAddress || undefined,
      };

      let invoice: Invoice;
      if (editingInvoice) {
        const res = await invoiceApi.update(editingInvoice._id, payload);
        invoice = res.data as Invoice;
        toast.success("Invoice updated");
      } else {
        const res = await invoiceApi.create(payload);
        invoice = res.data as Invoice;
        toast.success("Invoice created");
      }

      if (!asDraft && invoice) {
        // Find client email to pre-fill
        const client = clients.find((c) => c._id === formClientId);
        const email = client?.contactPerson?.email || "";
        setSelectedInvoice(invoice);
        setSendEmail(email);
        setSendSubject(`Invoice ${invoice.invoiceNumber}`);
        setSendMessage("");
        setShowCreateModal(false);
        setShowSendModal(true);
      } else {
        setShowCreateModal(false);
      }

      resetForm();
      fetchInvoices();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || "Failed to save invoice");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSend = async () => {
    if (!selectedInvoice || !sendEmail) {
      toast.error("Please enter an email address");
      return;
    }
    setSubmitting(true);
    try {
      await invoiceApi.send(selectedInvoice._id, {
        email: sendEmail,
        subject: sendSubject || undefined,
        message: sendMessage || undefined,
      });
      toast.success("Invoice sent");
      setShowSendModal(false);
      fetchInvoices();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || "Failed to send invoice");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!selectedInvoice || payAmount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }
    setSubmitting(true);
    try {
      await invoiceApi.markPaid(selectedInvoice._id, {
        amount: payAmount,
        paymentMethod: payMethod || undefined,
        paymentNotes: payNotes || undefined,
      });
      toast.success("Payment recorded");
      setShowPayModal(false);
      setShowDetailModal(false);
      fetchInvoices();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this draft invoice?")) return;
    try {
      await invoiceApi.delete(id);
      toast.success("Invoice deleted");
      fetchInvoices();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete invoice");
    }
  };

  const getClientName = (clientId: string) => {
    const client = clients.find((c) => c._id === clientId);
    return client?.displayName || client?.companyName || "Unknown Client";
  };

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} />

      <main className="ml-[260px] flex-1 overflow-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
              <p className="text-sm text-gray-500 mt-1">Manage invoices, track payments, and send to clients</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#2E86C1] text-white text-sm font-medium rounded-lg hover:bg-[#2574A9] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Invoice
            </button>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Revenue</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.totalRevenue)}</div>
                <div className="text-xs text-gray-400 mt-1">{stats.totalCount} invoices</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Paid</div>
                <div className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(stats.paidAmount)}</div>
                <div className="text-xs text-gray-400 mt-1">{stats.paidCount} invoices</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="text-xs font-medium text-amber-600 uppercase tracking-wide">Pending</div>
                <div className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(stats.pendingAmount)}</div>
                <div className="text-xs text-gray-400 mt-1">{stats.sentCount + stats.partiallyPaidCount} invoices</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="text-xs font-medium text-red-600 uppercase tracking-wide">Overdue</div>
                <div className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(stats.overdueAmount)}</div>
                <div className="text-xs text-gray-400 mt-1">{stats.overdueCount} invoices</div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
              {["all", "draft", "sent", "paid", "partially_paid", "overdue"].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(s);
                    setPagination((p) => ({ ...p, page: 1 }));
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    statusFilter === s
                      ? "bg-[#2E86C1] text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {s === "all" ? "All" : STATUS_LABELS[s]}
                </button>
              ))}
            </div>

            <select
              value={clientFilter}
              onChange={(e) => {
                setClientFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20"
            >
              <option value="">All Clients</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.displayName || c.companyName}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 w-64"
            />
          </div>

          {/* Invoice Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-400">Loading invoices...</div>
            ) : invoices.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-gray-400 text-lg mb-2">No invoices found</div>
                <p className="text-gray-400 text-sm">Create your first invoice to get started</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Client</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Due Date</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv._id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setShowDetailModal(true);
                      }}
                    >
                      <td className="px-5 py-4">
                        <div className="text-sm font-semibold text-gray-900">{inv.invoiceNumber}</div>
                        <div className="text-xs text-gray-400">{formatDate(inv.issueDate)}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">{getClientName(inv.clientId)}</td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-semibold text-gray-900">{formatCurrency(inv.total, inv.currency)}</div>
                        {inv.balanceDue > 0 && inv.balanceDue < inv.total && (
                          <div className="text-xs text-amber-600">Due: {formatCurrency(inv.balanceDue, inv.currency)}</div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status] || STATUS_COLORS.draft}`}>
                          {STATUS_LABELS[inv.status] || inv.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">{formatDate(inv.dueDate)}</td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {["draft", "sent"].includes(inv.status) && (
                            <button
                              onClick={() => openEditModal(inv)}
                              className="p-1.5 text-gray-400 hover:text-[#2E86C1] rounded-md hover:bg-blue-50 transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          {["draft", "sent", "partially_paid"].includes(inv.status) && (
                            <button
                              onClick={() => {
                                setSelectedInvoice(inv);
                                const client = clients.find((c) => c._id === inv.clientId);
                                setSendEmail(client?.contactPerson?.email || inv.sentTo || "");
                                setSendSubject(`Invoice ${inv.invoiceNumber}`);
                                setSendMessage("");
                                setShowSendModal(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                              title="Send"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </button>
                          )}
                          {inv.status === "draft" && (
                            <button
                              onClick={() => handleDelete(inv._id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <div className="text-sm text-gray-500">
                  Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.pages, p.page + 1) }))}
                    disabled={pagination.page >= pagination.pages}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create/Edit Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingInvoice ? `Edit Invoice ${editingInvoice.invoiceNumber}` : "Create Invoice"}
              </h2>
              <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="p-1 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-6">
              {/* Template selector */}
              {!editingInvoice && templates.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Template</label>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {templates.map((t) => (
                      <button
                        key={t._id}
                        onClick={() => applyTemplate(t)}
                        className={`flex-shrink-0 px-4 py-3 rounded-lg border-2 text-left transition-all ${
                          formTemplateName === t.name ? "border-[#2E86C1] bg-blue-50" : "border-gray-200 hover:border-gray-300"
                        }`}
                        style={{ minWidth: 140 }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-3 h-3 rounded-full" style={{ background: t.colorScheme }} />
                          <div className="text-sm font-medium text-gray-900">{t.name}</div>
                        </div>
                        <div className="text-xs text-gray-400">{LAYOUT_PREVIEWS[t.layout]?.desc || t.layout}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Client & Project */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Client *</label>
                  <select
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20"
                  >
                    <option value="">Select client...</option>
                    {clients.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.displayName || c.companyName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Project (optional)</label>
                  <select
                    value={formProjectId}
                    onChange={(e) => setFormProjectId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20"
                  >
                    <option value="">None</option>
                    {projects.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.projectName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates & Currency */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Issue Date *</label>
                  <input
                    type="date"
                    value={formIssueDate}
                    onChange={(e) => setFormIssueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Due Date *</label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Currency</label>
                  <select
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Payment Terms</label>
                  <select
                    value={formPaymentTerms}
                    onChange={(e) => setFormPaymentTerms(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20"
                  >
                    <option value={7}>Net 7</option>
                    <option value={15}>Net 15</option>
                    <option value={30}>Net 30</option>
                    <option value={45}>Net 45</option>
                    <option value={60}>Net 60</option>
                    <option value={90}>Net 90</option>
                  </select>
                </div>
              </div>

              {/* Branding */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Brand Name</label>
                  <input
                    type="text"
                    value={formBrandName}
                    onChange={(e) => setFormBrandName(e.target.value)}
                    placeholder="Your company name"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Brand Address</label>
                  <input
                    type="text"
                    value={formBrandAddress}
                    onChange={(e) => setFormBrandAddress(e.target.value)}
                    placeholder="Company address"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Line Items</label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-3 py-2">Description</th>
                        <th className="text-center px-3 py-2 w-20">Qty</th>
                        <th className="text-center px-3 py-2 w-24">Rate</th>
                        <th className="text-center px-3 py-2 w-20">Tax %</th>
                        <th className="text-right px-3 py-2 w-24">Amount</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formItems.map((item, idx) => (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => {
                                const newItems = [...formItems];
                                newItems[idx] = { ...newItems[idx], description: e.target.value };
                                setFormItems(newItems);
                              }}
                              placeholder="Item description"
                              className="w-full px-2 py-1.5 text-sm border-0 focus:outline-none focus:ring-0"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => {
                                const newItems = [...formItems];
                                newItems[idx] = { ...newItems[idx], quantity: Number(e.target.value) };
                                setFormItems(recalculateItems(newItems));
                              }}
                              className="w-full text-center px-2 py-1.5 text-sm border-0 focus:outline-none focus:ring-0"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={item.rate}
                              onChange={(e) => {
                                const newItems = [...formItems];
                                newItems[idx] = { ...newItems[idx], rate: Number(e.target.value) };
                                setFormItems(recalculateItems(newItems));
                              }}
                              className="w-full text-center px-2 py-1.5 text-sm border-0 focus:outline-none focus:ring-0"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              value={item.taxRate || 0}
                              onChange={(e) => {
                                const newItems = [...formItems];
                                newItems[idx] = { ...newItems[idx], taxRate: Number(e.target.value) };
                                setFormItems(recalculateItems(newItems));
                              }}
                              className="w-full text-center px-2 py-1.5 text-sm border-0 focus:outline-none focus:ring-0"
                            />
                          </td>
                          <td className="px-3 py-1 text-right text-sm font-medium text-gray-700">
                            {formatCurrency(item.amount + (item.taxAmount || 0), formCurrency)}
                          </td>
                          <td className="px-1 py-1">
                            {formItems.length > 1 && (
                              <button
                                onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))}
                                className="p-1 text-gray-300 hover:text-red-500"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 border-t border-gray-100">
                    <button
                      onClick={() =>
                        setFormItems([...formItems, { description: "", quantity: 1, rate: 0, amount: 0, taxRate: 0, taxAmount: 0 }])
                      }
                      className="text-sm text-[#2E86C1] hover:underline font-medium"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>
              </div>

              {/* Discount & Totals */}
              <div className="flex justify-end">
                <div className="w-72 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-medium text-gray-700">{formatCurrency(getFormTotals().subtotal, formCurrency)}</span>
                  </div>
                  {getFormTotals().taxTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Tax</span>
                      <span className="font-medium text-gray-700">{formatCurrency(getFormTotals().taxTotal, formCurrency)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm gap-2">
                    <span className="text-gray-500">Discount</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        value={formDiscount}
                        onChange={(e) => setFormDiscount(Number(e.target.value))}
                        className="w-20 text-right px-2 py-1 text-sm border border-gray-200 rounded"
                      />
                      <select
                        value={formDiscountType}
                        onChange={(e) => setFormDiscountType(e.target.value as "fixed" | "percentage")}
                        className="px-1 py-1 text-xs border border-gray-200 rounded"
                      >
                        <option value="fixed">Fixed</option>
                        <option value="percentage">%</option>
                      </select>
                    </div>
                  </div>
                  {getFormTotals().discountAmt > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Discount Amount</span>
                      <span className="font-medium text-red-500">-{formatCurrency(getFormTotals().discountAmt, formCurrency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                    <span className="text-gray-900">Total</span>
                    <span className="text-gray-900">{formatCurrency(getFormTotals().total, formCurrency)}</span>
                  </div>
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    rows={3}
                    placeholder="Thank you for your business..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Terms & Conditions</label>
                  <textarea
                    value={formTerms}
                    onChange={(e) => setFormTerms(e.target.value)}
                    rows={3}
                    placeholder="Payment is due within the specified terms..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save as Draft"}
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-[#2E86C1] rounded-lg hover:bg-[#2574A9] disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save & Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {showDetailModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selectedInvoice.invoiceNumber}</h2>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${STATUS_COLORS[selectedInvoice.status]}`}>
                  {STATUS_LABELS[selectedInvoice.status]}
                </span>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-5">
              {/* Header info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 uppercase">Client</div>
                  <div className="text-sm font-medium text-gray-900">{getClientName(selectedInvoice.clientId)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 uppercase">Amount</div>
                  <div className="text-xl font-bold text-gray-900">{formatCurrency(selectedInvoice.total, selectedInvoice.currency)}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
                <div>
                  <div className="text-xs text-gray-400">Issue Date</div>
                  <div className="text-sm font-medium">{formatDate(selectedInvoice.issueDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Due Date</div>
                  <div className="text-sm font-medium">{formatDate(selectedInvoice.dueDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Payment Terms</div>
                  <div className="text-sm font-medium">Net {selectedInvoice.paymentTerms}</div>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="text-xs font-medium text-gray-400 uppercase mb-2">Items</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase border-b border-gray-200">
                      <th className="text-left py-2">Description</th>
                      <th className="text-center py-2">Qty</th>
                      <th className="text-right py-2">Rate</th>
                      <th className="text-right py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items.map((item, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-2 text-gray-700">{item.description}</td>
                        <td className="py-2 text-center text-gray-600">{item.quantity}</td>
                        <td className="py-2 text-right text-gray-600">{formatCurrency(item.rate, selectedInvoice.currency)}</td>
                        <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(item.amount, selectedInvoice.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span>{formatCurrency(selectedInvoice.subtotal, selectedInvoice.currency)}</span>
                  </div>
                  {selectedInvoice.taxTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tax</span>
                      <span>{formatCurrency(selectedInvoice.taxTotal, selectedInvoice.currency)}</span>
                    </div>
                  )}
                  {selectedInvoice.discount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Discount</span>
                      <span className="text-red-500">-{formatCurrency(selectedInvoice.discount, selectedInvoice.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-2 border-t border-gray-200 text-base">
                    <span>Total</span>
                    <span>{formatCurrency(selectedInvoice.total, selectedInvoice.currency)}</span>
                  </div>
                  {selectedInvoice.amountPaid > 0 && (
                    <>
                      <div className="flex justify-between text-emerald-600">
                        <span>Paid</span>
                        <span>{formatCurrency(selectedInvoice.amountPaid, selectedInvoice.currency)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-amber-600">
                        <span>Balance Due</span>
                        <span>{formatCurrency(selectedInvoice.balanceDue, selectedInvoice.currency)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {selectedInvoice.notes && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 uppercase mb-1">Notes</div>
                  <div className="text-sm text-gray-600">{selectedInvoice.notes}</div>
                </div>
              )}

              {selectedInvoice.sentAt && (
                <div className="text-xs text-gray-400">
                  Last sent: {formatDate(selectedInvoice.sentAt)} to {selectedInvoice.sentTo} ({selectedInvoice.emailCount} email{selectedInvoice.emailCount !== 1 ? "s" : ""})
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
              {["draft", "sent"].includes(selectedInvoice.status) && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    openEditModal(selectedInvoice);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Edit
                </button>
              )}
              {["sent", "partially_paid"].includes(selectedInvoice.status) && (
                <button
                  onClick={() => {
                    setPayAmount(selectedInvoice.balanceDue);
                    setPayMethod("");
                    setPayNotes("");
                    setShowPayModal(true);
                  }}
                  className="px-4 py-2 text-sm font-medium text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50"
                >
                  Record Payment
                </button>
              )}
              {["draft", "sent", "partially_paid"].includes(selectedInvoice.status) && (
                <button
                  onClick={() => {
                    const client = clients.find((c) => c._id === selectedInvoice.clientId);
                    setSendEmail(client?.contactPerson?.email || selectedInvoice.sentTo || "");
                    setSendSubject(`Invoice ${selectedInvoice.invoiceNumber}`);
                    setSendMessage("");
                    setShowSendModal(true);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#2E86C1] rounded-lg hover:bg-[#2574A9]"
                >
                  Send Invoice
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Send Invoice Modal */}
      {showSendModal && selectedInvoice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Invoice {selectedInvoice.invoiceNumber}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Email *</label>
                <input
                  type="email"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20"
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Subject</label>
                <input
                  type="text"
                  value={sendSubject}
                  onChange={(e) => setSendSubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Message (optional)</label>
                <textarea
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 resize-none"
                  placeholder="Additional message to include..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSendModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-[#2E86C1] rounded-lg hover:bg-[#2574A9] disabled:opacity-50"
              >
                {submitting ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Paid Modal */}
      {showPayModal && selectedInvoice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Record Payment</h3>
            <p className="text-sm text-gray-500 mb-4">
              Balance due: <span className="font-bold text-gray-900">{formatCurrency(selectedInvoice.balanceDue, selectedInvoice.currency)}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Amount *</label>
                <input
                  type="number"
                  min={0}
                  max={selectedInvoice.balanceDue}
                  step={0.01}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20"
                >
                  <option value="">Select...</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Notes</label>
                <textarea
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 resize-none"
                  placeholder="Transaction reference, etc."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowPayModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? "Recording..." : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
