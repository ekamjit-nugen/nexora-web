"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/sidebar";
import { invoiceApi, clientApi } from "@/lib/api";
import type { Invoice, InvoiceItem, InvoiceTemplate, InvoiceStats, InvoiceLifecycleStats, InvoiceNotification, Client } from "@/lib/api";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/confirm-modal";
import { RouteGuard } from "@/components/route-guard";

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

// Visual styling for the cron-driven lifecycleState. Mirrors the buckets
// in InvoiceLifecycleService: upcoming → calm blue, due_soon → amber,
// due_today → orange (action expected), overdue → red, paid → green.
const LIFECYCLE_CHIP: Record<string, { label: string; cls: string; emoji: string }> = {
  upcoming:  { label: "Upcoming",  cls: "bg-blue-50 text-blue-700 border-blue-200",     emoji: "🕒" },
  due_soon:  { label: "Due soon",  cls: "bg-amber-50 text-amber-700 border-amber-200",  emoji: "⏰" },
  due_today: { label: "Due today", cls: "bg-orange-50 text-orange-700 border-orange-200", emoji: "📌" },
  overdue:   { label: "Overdue",   cls: "bg-red-50 text-red-700 border-red-200",        emoji: "🔥" },
  paid:      { label: "Paid",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200", emoji: "✅" },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

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
  const [lifecycleStats, setLifecycleStats] = useState<InvoiceLifecycleStats | null>(null);
  const [notifications, setNotifications] = useState<InvoiceNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
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
  const [formBrandLogo, setFormBrandLogo] = useState("");
  const [formSignature, setFormSignature] = useState("");
  const [formRecurring, setFormRecurring] = useState(false);
  const [formRecurringInterval, setFormRecurringInterval] = useState("monthly");
  const [formRecurringEmail, setFormRecurringEmail] = useState("");
  const [invoiceStep, setInvoiceStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Send modal state
  const [sendEmail, setSendEmail] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendMessage, setSendMessage] = useState("");

  // Pay modal state
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("");

  // Confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; variant: "danger" | "warning" | "info"; onConfirm: () => void }>({ title: "", message: "", variant: "danger", onConfirm: () => {} });

  // Quick preview modal
  const [quickPreviewInvoice, setQuickPreviewInvoice] = useState<Invoice | null>(null);
  const [payNotes, setPayNotes] = useState("");

  // Recurring modal state
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringTarget, setRecurringTarget] = useState<Invoice | null>(null);
  const [recurringModalInterval, setRecurringModalInterval] = useState("monthly");
  const [recurringModalStartDate, setRecurringModalStartDate] = useState("");
  const [recurringModalEmail, setRecurringModalEmail] = useState("");

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

  // Lifecycle stats — counts + total value per bucket. Cheap query;
  // we re-fetch on every list-refresh so the cards stay in sync after
  // a status edit, mark-paid, or fresh cron run.
  const fetchLifecycleStats = useCallback(async () => {
    try {
      const res = await invoiceApi.getLifecycleStats();
      setLifecycleStats((res.data as InvoiceLifecycleStats) || null);
    } catch {}
  }, []);

  // Notifications dropdown (top-right of the page, bell icon). The API
  // returns the list AND unread count in one trip — we cache both.
  // Polling happens via a separate useEffect with a 60s interval.
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await invoiceApi.getNotifications(false);
      setNotifications((res.data as InvoiceNotification[]) || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {}
  }, []);

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await invoiceApi.markNotificationRead(id);
      // Optimistically update — the server already enforced the read
      // state, so we don't need to wait for the next poll to refresh.
      setNotifications((prev) => prev.map(n => n._id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await invoiceApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map(n => ({ ...n, read: true, readAt: n.readAt || new Date().toISOString() })));
      setUnreadCount(0);
    } catch {}
  };

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await invoiceApi.getTemplates();
      setTemplates((res.data as InvoiceTemplate[]) || []);
    } catch {}
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await clientApi.getClients({ limit: "100" });
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
    Promise.all([
      fetchInvoices(),
      fetchStats(),
      fetchLifecycleStats(),
      fetchNotifications(),
      fetchTemplates(),
      fetchClients(),
      fetchProjects(),
    ]).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll notifications every 60s. The cron only runs once a day so this
  // is mostly idle, but the Nugen admin's UI feels live without F5
  // when the cron does fire (or when another admin marks-all-read).
  useEffect(() => {
    const id = setInterval(() => {
      fetchNotifications();
      fetchLifecycleStats();
    }, 60_000);
    return () => clearInterval(id);
  }, [fetchNotifications, fetchLifecycleStats]);

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

  const DEFAULT_TERMS = "1. Payment is due within the specified payment terms from the invoice date.\n2. Late payments may attract interest at 1.5% per month.\n3. All disputes must be raised within 7 days of invoice receipt.\n4. This invoice is system-generated and valid without signature.";

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
    setFormTerms(DEFAULT_TERMS);
    setFormTemplateName("standard");
    setFormBrandName("");
    setFormBrandAddress("");
    setFormBrandLogo("");
    setFormSignature("");
    setFormRecurring(false);
    setFormRecurringInterval("monthly");
    setFormRecurringEmail("");
    setInvoiceStep(0);
    setEditingInvoice(null);
  };

  const BUILTIN_TEMPLATE_DEFAULTS: Record<string, { currency: string; terms: number; notes: string }> = {
    standard: { currency: "INR", terms: 30, notes: "Thank you for your business." },
    modern: { currency: "USD", terms: 15, notes: "We appreciate your prompt payment." },
    minimal: { currency: "INR", terms: 30, notes: "" },
    professional: { currency: "INR", terms: 45, notes: "Thank you for choosing our services." },
    creative: { currency: "USD", terms: 14, notes: "It was a pleasure working with you!" },
  };

  const applyBuiltinTemplate = (key: string) => {
    setFormTemplateName(key);
    const defaults = BUILTIN_TEMPLATE_DEFAULTS[key];
    if (defaults) {
      setFormCurrency(defaults.currency);
      setFormPaymentTerms(defaults.terms);
      if (defaults.notes) setFormNotes(defaults.notes);
      if (!formTerms) setFormTerms(DEFAULT_TERMS);
    }
  };

  const applyTemplate = (template: InvoiceTemplate) => {
    setFormCurrency(template.defaultCurrency);
    setFormPaymentTerms(template.defaultPaymentTerms);
    setFormNotes(template.defaultNotes || "");
    setFormTerms(template.defaultTerms || DEFAULT_TERMS);
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
    setFormBrandLogo((invoice as any).brandLogo || "");
    setFormSignature((invoice as any).signature || "");
    setFormRecurring(invoice.isRecurring || false);
    setFormRecurringInterval(invoice.recurringInterval || "monthly");
    setFormRecurringEmail(invoice.recurringEmail || "");
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
        brandLogo: formBrandLogo || undefined,
        signature: formSignature || undefined,
        isRecurring: formRecurring || undefined,
        recurringInterval: formRecurring ? formRecurringInterval : undefined,
        recurringEmail: formRecurring ? formRecurringEmail : undefined,
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

  const handleDelete = (id: string) => {
    setConfirmConfig({
      title: "Delete Invoice",
      message: "Are you sure you want to delete this draft invoice? This action cannot be undone.",
      variant: "danger",
      onConfirm: async () => {
        setConfirmOpen(false);
        try {
          await invoiceApi.delete(id);
          toast.success("Invoice deleted");
          fetchInvoices();
          fetchStats();
        } catch (err: any) {
          toast.error(err.message || "Failed to delete invoice");
        }
      },
    });
    setConfirmOpen(true);
  };

  const handleStatusChange = async (invoiceId: string, newStatus: string) => {
    try {
      await invoiceApi.updateStatus(invoiceId, newStatus);
      toast.success(`Status changed to ${STATUS_LABELS[newStatus] || newStatus}`);
      fetchInvoices();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const openRecurringModal = (invoice: Invoice) => {
    setRecurringTarget(invoice);
    setRecurringModalInterval(invoice.recurringInterval || "monthly");
    setRecurringModalStartDate(invoice.recurringNextDate ? invoice.recurringNextDate.split("T")[0] : new Date().toISOString().split("T")[0]);
    const client = clients.find((c) => c._id === invoice.clientId);
    setRecurringModalEmail(invoice.recurringEmail || client?.contactPerson?.email || "");
    setShowRecurringModal(true);
  };

  const handleSaveRecurring = async () => {
    if (!recurringTarget) return;
    if (!recurringModalStartDate) {
      toast.error("Please select a start date");
      return;
    }
    try {
      await invoiceApi.update(recurringTarget._id, {
        isRecurring: true,
        recurringInterval: recurringModalInterval,
        recurringNextDate: recurringModalStartDate,
        recurringEmail: recurringModalEmail || undefined,
      } as any);
      toast.success("Recurring schedule saved");
      setShowRecurringModal(false);
      setRecurringTarget(null);
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.message || "Failed to save recurring settings");
    }
  };

  const handleDisableRecurring = async (invoice: Invoice) => {
    try {
      await invoiceApi.update(invoice._id, {
        isRecurring: false,
        recurringInterval: undefined,
        recurringNextDate: undefined,
        recurringEmail: undefined,
      } as any);
      toast.success("Recurring disabled");
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.message || "Failed to disable recurring");
    }
  };

  const getClientName = (clientId: string) => {
    const client = clients.find((c) => c._id === clientId);
    return client?.displayName || client?.companyName || "Unknown Client";
  };

  if (!user) return null;

  return (
    <RouteGuard minOrgRole="manager">
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} />

      <main className="md:ml-[260px] flex-1 overflow-auto">
        <div className="p-6 max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
              <p className="text-sm text-gray-500 mt-1">Manage invoices, track payments, and send to clients</p>
            </div>
            <div className="flex items-center gap-3">
              {invoices.some(i => i.isRecurring) && (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  <span className="text-xs font-medium text-blue-700">{invoices.filter(i => i.isRecurring).length} recurring</span>
                </div>
              )}

              {/* Notifications bell — popover with the user's recent
                  invoice lifecycle alerts (upcoming/due/overdue).
                  Persistent (Mongo-backed); cron writes daily, plus
                  any backfill runs from POST /lifecycle/run.
                  Closes on outside click via the backdrop layer. */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications((s) => !s)}
                  className="relative p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  title={`${unreadCount} unread invoice notification${unreadCount === 1 ? '' : 's'}`}
                  aria-label="Invoice notifications"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <div className="absolute right-0 top-12 z-50 w-[380px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">Invoice notifications</div>
                          <div className="text-[11px] text-gray-500">{unreadCount} unread · {notifications.length} total</div>
                        </div>
                        {unreadCount > 0 && (
                          <button onClick={handleMarkAllRead} className="text-[11px] font-medium text-[#2E86C1] hover:underline">Mark all read</button>
                        )}
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-10 text-center text-[12px] text-gray-400">
                            No invoice alerts yet. The daily scan runs at 9am IST.
                          </div>
                        ) : notifications.map((n) => (
                          <button
                            key={n._id}
                            onClick={() => {
                              if (!n.read) handleMarkNotificationRead(n._id);
                              setShowNotifications(false);
                              // Find the invoice and open its detail modal — keeps
                              // the user inside the same page rather than navigating.
                              const inv = invoices.find(i => i._id === n.invoiceId);
                              if (inv) { setSelectedInvoice(inv); setShowDetailModal(true); }
                            }}
                            className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${n.read ? '' : 'bg-blue-50/30'}`}
                          >
                            <div className="flex items-start gap-2">
                              {!n.read && <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <div className={`text-[13px] ${n.read ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>{n.title}</div>
                                <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{n.message}</div>
                                <div className="text-[10px] text-gray-400 mt-1">{relativeTime(n.createdAt)}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#2E86C1] text-white text-sm font-medium rounded-lg hover:bg-[#2574A9] transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Invoice
              </button>
            </div>
          </div>

          {/* Lifecycle row — populated by the InvoiceLifecycleService
              daily cron (with a manual /lifecycle/run trigger for fresh
              imports). Five buckets, one card each, tap to filter the
              list. Hidden when no data has been computed yet (e.g.
              fresh org with no invoices). */}
          {lifecycleStats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              {(['upcoming', 'due_soon', 'due_today', 'overdue', 'paid'] as const).map((bucket) => {
                const v = lifecycleStats[bucket];
                const chip = LIFECYCLE_CHIP[bucket];
                return (
                  <div key={bucket} className={`rounded-xl border p-4 ${chip.cls}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">{chip.label}</span>
                      <span className="text-base">{chip.emoji}</span>
                    </div>
                    <div className="text-2xl font-bold mt-1.5">{v.count}</div>
                    <div className="text-[11px] opacity-70 mt-0.5">{formatCurrency(v.totalValue)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stats Cards — Enhanced */}
          {stats && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-[60px] -mr-2 -mt-2" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 10v1" /></svg>
                      </div>
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Revenue</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</div>
                    <div className="text-xs text-gray-400 mt-1">{stats.totalCount} invoices total</div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-[60px] -mr-2 -mt-2" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <span className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Collected</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.paidAmount)}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${stats.totalRevenue > 0 ? Math.round((stats.paidAmount / stats.totalRevenue) * 100) : 0}%` }} />
                      </div>
                      <span className="text-[11px] font-medium text-emerald-600">{stats.totalRevenue > 0 ? Math.round((stats.paidAmount / stats.totalRevenue) * 100) : 0}%</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-bl-[60px] -mr-2 -mt-2" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <span className="text-xs font-medium text-amber-600 uppercase tracking-wide">Pending</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-600">{formatCurrency(stats.pendingAmount)}</div>
                    <div className="text-xs text-gray-400 mt-1">{stats.sentCount} sent + {stats.partiallyPaidCount} partial</div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-red-50 rounded-bl-[60px] -mr-2 -mt-2" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                      </div>
                      <span className="text-xs font-medium text-red-600 uppercase tracking-wide">Overdue</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.overdueAmount)}</div>
                    <div className="text-xs text-gray-400 mt-1">{stats.overdueCount} invoice{stats.overdueCount !== 1 ? 's' : ''} overdue</div>
                  </div>
                </div>
              </div>

              {/* Secondary Analytics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                {[
                  { label: "Draft", count: stats.draftCount, color: "text-gray-600 bg-gray-50 border-gray-200" },
                  { label: "Sent", count: stats.sentCount, color: "text-blue-600 bg-blue-50 border-blue-200" },
                  { label: "Partial", count: stats.partiallyPaidCount, color: "text-amber-600 bg-amber-50 border-amber-200" },
                  { label: "Paid", count: stats.paidCount, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
                  { label: "Overdue", count: stats.overdueCount, color: "text-red-600 bg-red-50 border-red-200" },
                  { label: "Avg Invoice", count: stats.totalCount > 0 ? formatCurrency(Math.round(stats.totalRevenue / stats.totalCount)) : formatCurrency(0), color: "text-violet-600 bg-violet-50 border-violet-200", isText: true },
                ].map((item) => (
                  <div key={item.label} className={`rounded-lg border px-3 py-2.5 ${item.color}`}>
                    <div className="text-[10px] font-medium uppercase tracking-wide opacity-80">{item.label}</div>
                    <div className="text-lg font-bold mt-0.5">{(item as any).isText ? item.count : item.count}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
              {["all", "draft", "sent", "paid", "partially_paid", "overdue", "cancelled"].map((s) => (
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
              <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Invoice</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Client</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Lifecycle</th>
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
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={inv.status}
                            onChange={(e) => handleStatusChange(inv._id, e.target.value)}
                            className={`appearance-none cursor-pointer inline-flex items-center pl-2.5 pr-6 py-0.5 rounded-full text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 ${STATUS_COLORS[inv.status] || STATUS_COLORS.draft}`}
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center' }}
                          >
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="partially_paid">Partially Paid</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                          {inv.isRecurring && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-200" title={`Recurring: ${inv.recurringInterval || 'monthly'}`}>
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              {(inv.recurringInterval || 'monthly').slice(0, 3)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {inv.lifecycleState && LIFECYCLE_CHIP[inv.lifecycleState] ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${LIFECYCLE_CHIP[inv.lifecycleState].cls}`}
                            title={
                              inv.lifecycleState === 'overdue' && inv.overdueDays
                                ? `${inv.overdueDays} day${inv.overdueDays === 1 ? '' : 's'} overdue`
                                : (typeof inv.daysUntilDue === 'number'
                                    ? `${inv.daysUntilDue} day${inv.daysUntilDue === 1 ? '' : 's'} until due`
                                    : LIFECYCLE_CHIP[inv.lifecycleState].label)
                            }
                          >
                            {LIFECYCLE_CHIP[inv.lifecycleState].emoji}
                            {inv.lifecycleState === 'overdue' && inv.overdueDays
                              ? `${inv.overdueDays}d overdue`
                              : LIFECYCLE_CHIP[inv.lifecycleState].label}
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-300">—</span>
                        )}
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
                          {["draft", "sent", "partially_paid", "overdue"].includes(inv.status) && (
                            <button
                              onClick={() => {
                                setSelectedInvoice(inv);
                                const client = clients.find((c) => c._id === inv.clientId);
                                setSendEmail(client?.contactPerson?.email || inv.sentTo || "");
                                // Pre-fill a reminder-style subject + body when
                                // the invoice is overdue. The admin can still
                                // edit before sending — this just saves them
                                // typing the most common nudge.
                                if (inv.status === 'overdue' || inv.lifecycleState === 'overdue') {
                                  const days = inv.overdueDays || 0;
                                  setSendSubject(`Reminder: Invoice ${inv.invoiceNumber}${days > 0 ? ` is ${days} day${days === 1 ? '' : 's'} overdue` : ' is overdue'}`);
                                  setSendMessage(`Hi,\n\nThis is a friendly reminder that invoice ${inv.invoiceNumber} for ${formatCurrency(inv.balanceDue || inv.total, inv.currency)} ${days > 0 ? `is now ${days} day${days === 1 ? '' : 's'} overdue` : 'has passed its due date'}. We'd appreciate it if you could process the payment at your earliest convenience.\n\nIf the payment has already been made, please disregard this message.\n\nThanks,`);
                                } else {
                                  setSendSubject(`Invoice ${inv.invoiceNumber}`);
                                  setSendMessage("");
                                }
                                setShowSendModal(true);
                              }}
                              className={`p-1.5 rounded-md transition-colors ${
                                inv.lifecycleState === 'overdue'
                                  ? 'text-red-500 hover:text-red-700 hover:bg-red-50'
                                  : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                              }`}
                              title={inv.lifecycleState === 'overdue' ? 'Send reminder to client' : 'Send to client'}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </button>
                          )}
                          {["sent", "partially_paid"].includes(inv.status) && (
                            <button
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setPayAmount(0);
                                setPayMethod("");
                                setPayNotes("");
                                setShowPayModal(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-md hover:bg-emerald-50 transition-colors"
                              title="Record Payment"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          )}
                          {/* Preview */}
                          <button
                            onClick={() => setQuickPreviewInvoice(inv)}
                            className="p-1.5 text-gray-400 hover:text-violet-600 rounded-md hover:bg-violet-50 transition-colors"
                            title="Preview"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          {/* Recurring toggle */}
                          {!["cancelled"].includes(inv.status) && (
                            <button
                              onClick={() => inv.isRecurring ? handleDisableRecurring(inv) : openRecurringModal(inv)}
                              className={`p-1.5 rounded-md transition-colors ${inv.isRecurring ? "text-blue-600 bg-blue-50 hover:bg-blue-100" : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"}`}
                              title={inv.isRecurring ? "Disable Recurring" : "Set Recurring"}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
              </div>
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

      {/* Create/Edit Invoice Modal — 4-Step Wizard */}
      {showCreateModal && (() => {
        const INV_STEPS = [
          { num: 1, label: "Details" },
          { num: 2, label: "Items" },
          { num: 3, label: "Terms & Extras" },
          { num: 4, label: "Preview" },
        ];
        const canNext = (s: number) => {
          if (s === 0) return !!formClientId && !!formDueDate;
          if (s === 1) return formItems.some(i => i.description && i.rate > 0);
          return true;
        };
        const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20";
        const labelCls = "block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1";

        return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[92vh]">
            {/* Header + Stepper */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{editingInvoice ? `Edit ${editingInvoice.invoiceNumber}` : "Create Invoice"}</h2>
                  <p className="text-[13px] text-gray-400 mt-0.5">Step {invoiceStep + 1} of 4 — {INV_STEPS[invoiceStep].label}</p>
                </div>
                <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="p-1 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex items-center justify-center gap-0">
                {INV_STEPS.map((s, i) => (
                  <div key={i} className="flex items-center">
                    <button type="button" onClick={() => (i <= invoiceStep || editingInvoice) && setInvoiceStep(i)}
                      className={`w-8 h-8 rounded-full text-xs font-semibold transition-all duration-300 ${
                        i === invoiceStep ? "bg-[#2E86C1] text-white shadow-lg shadow-[#2E86C1]/30 scale-110 ring-4 ring-[#2E86C1]/15"
                        : i < invoiceStep ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-400 border border-gray-200"
                      } ${(i <= invoiceStep || editingInvoice) ? "cursor-pointer" : "cursor-default"}`}>
                      {i < invoiceStep ? <svg className="w-3.5 h-3.5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : s.num}
                    </button>
                    <span className={`ml-1.5 text-[11px] font-medium ${i === invoiceStep ? "text-[#2E86C1]" : i < invoiceStep ? "text-emerald-600" : "text-gray-400"}`}>{s.label}</span>
                    {i < 3 && <div className={`mx-2 w-8 h-[2px] rounded-full transition-colors duration-500 ${i < invoiceStep ? "bg-emerald-400" : "bg-gray-200"}`} />}
                  </div>
                ))}
              </div>
              <div className="mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#2E86C1] to-[#3498DB] rounded-full transition-all duration-500" style={{ width: `${((invoiceStep + 1) / 4) * 100}%` }} />
              </div>
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="transition-all duration-200 ease-in-out space-y-5">

              {/* Step 1: Details */}
              {invoiceStep === 0 && (<>
                <div>
                  <label className={labelCls}>Client *</label>
                  <select value={formClientId} onChange={(e) => setFormClientId(e.target.value)} className={inputCls}>
                    <option value="">Select client...</option>
                    {clients.map((c) => <option key={c._id} value={c._id}>{c.displayName || c.companyName}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div><label className={labelCls}>Issue Date *</label><input type="date" value={formIssueDate} onChange={(e) => setFormIssueDate(e.target.value)} className={inputCls} /></div>
                  <div><label className={labelCls}>Due Date *</label><input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} className={inputCls} /></div>
                  <div><label className={labelCls}>Currency</label><select value={formCurrency} onChange={(e) => setFormCurrency(e.target.value)} className={inputCls}><option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option></select></div>
                  <div><label className={labelCls}>Payment Terms</label><select value={formPaymentTerms} onChange={(e) => setFormPaymentTerms(Number(e.target.value))} className={inputCls}><option value={7}>Net 7</option><option value={15}>Net 15</option><option value={30}>Net 30</option><option value={45}>Net 45</option><option value={60}>Net 60</option><option value={90}>Net 90</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls}>Brand Name</label><input type="text" value={formBrandName} onChange={(e) => setFormBrandName(e.target.value)} placeholder="Your company name" className={inputCls} /></div>
                  <div><label className={labelCls}>Brand Address</label><input type="text" value={formBrandAddress} onChange={(e) => setFormBrandAddress(e.target.value)} placeholder="Company address" className={inputCls} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Company Logo</label>
                    {formBrandLogo ? (
                      <div className="relative w-full h-20 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden group">
                        <img src={formBrandLogo} alt="Logo" className="max-h-16 max-w-full object-contain" />
                        <button type="button" onClick={() => setFormBrandLogo("")} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-[#2E86C1] hover:bg-blue-50/30 transition-colors">
                        <svg className="w-5 h-5 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="text-[11px] text-gray-400">Upload logo</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (f.size > 2000000) { toast.error("Logo must be under 2MB"); return; } const r = new FileReader(); r.onload = () => setFormBrandLogo(r.result as string); r.readAsDataURL(f); }}} />
                      </label>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Signature</label>
                    {formSignature ? (
                      <div className="relative w-full h-20 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden group">
                        <img src={formSignature} alt="Signature" className="max-h-16 max-w-full object-contain" />
                        <button type="button" onClick={() => setFormSignature("")} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-[#2E86C1] hover:bg-blue-50/30 transition-colors">
                        <svg className="w-5 h-5 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        <span className="text-[11px] text-gray-400">Upload signature</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (f.size > 2000000) { toast.error("Signature must be under 2MB"); return; } const r = new FileReader(); r.onload = () => setFormSignature(r.result as string); r.readAsDataURL(f); }}} />
                      </label>
                    )}
                  </div>
                </div>
              </>)}

              {/* Step 2: Line Items */}
              {invoiceStep === 1 && (<>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-lg">
                  <table className="w-full">
                    <thead><tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <th className="text-left px-3 py-2">Description</th><th className="text-center px-3 py-2 w-20">Qty</th><th className="text-center px-3 py-2 w-24">Rate</th><th className="text-center px-3 py-2 w-20">Tax %</th><th className="text-right px-3 py-2 w-24">Amount</th><th className="w-10"></th>
                    </tr></thead>
                    <tbody>
                      {formItems.map((item, idx) => (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="px-2 py-1"><input type="text" value={item.description} onChange={(e) => { const n = [...formItems]; n[idx] = { ...n[idx], description: e.target.value }; setFormItems(n); }} placeholder="Item description" className="w-full px-2 py-1.5 text-sm border-0 focus:outline-none focus:ring-0" /></td>
                          <td className="px-2 py-1"><input type="number" min={1} value={item.quantity} onChange={(e) => { const n = [...formItems]; n[idx] = { ...n[idx], quantity: Number(e.target.value) }; setFormItems(recalculateItems(n)); }} className="w-full text-center px-2 py-1.5 text-sm border-0 focus:outline-none focus:ring-0" /></td>
                          <td className="px-2 py-1"><input type="number" min={0} step={0.01} value={item.rate} onChange={(e) => { const n = [...formItems]; n[idx] = { ...n[idx], rate: Number(e.target.value) }; setFormItems(recalculateItems(n)); }} className="w-full text-center px-2 py-1.5 text-sm border-0 focus:outline-none focus:ring-0" /></td>
                          <td className="px-2 py-1"><input type="number" min={0} max={100} step={0.1} value={item.taxRate || 0} onChange={(e) => { const n = [...formItems]; n[idx] = { ...n[idx], taxRate: Number(e.target.value) }; setFormItems(recalculateItems(n)); }} className="w-full text-center px-2 py-1.5 text-sm border-0 focus:outline-none focus:ring-0" /></td>
                          <td className="px-3 py-1 text-right text-sm font-medium text-gray-700">{formatCurrency(item.amount + (item.taxAmount || 0), formCurrency)}</td>
                          <td className="px-1 py-1">{formItems.length > 1 && <button onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))} className="p-1 text-gray-300 hover:text-red-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  <div className="px-3 py-2 border-t border-gray-100">
                    <button onClick={() => setFormItems([...formItems, { description: "", quantity: 1, rate: 0, amount: 0, taxRate: 0, taxAmount: 0 }])} className="text-sm text-[#2E86C1] hover:underline font-medium">+ Add Item</button>
                  </div>
                </div>
                {/* Discount & Totals */}
                <div className="flex justify-end">
                  <div className="w-72 space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="font-medium">{formatCurrency(getFormTotals().subtotal, formCurrency)}</span></div>
                    {getFormTotals().taxTotal > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Tax</span><span className="font-medium">{formatCurrency(getFormTotals().taxTotal, formCurrency)}</span></div>}
                    <div className="flex items-center justify-between text-sm gap-2">
                      <span className="text-gray-500">Discount</span>
                      <div className="flex items-center gap-1">
                        <input type="number" min={0} value={formDiscount} onChange={(e) => setFormDiscount(Number(e.target.value))} className="w-20 text-right px-2 py-1 text-sm border border-gray-200 rounded" />
                        <select value={formDiscountType} onChange={(e) => setFormDiscountType(e.target.value as "fixed" | "percentage")} className="px-1 py-1 text-xs border border-gray-200 rounded"><option value="fixed">Fixed</option><option value="percentage">%</option></select>
                      </div>
                    </div>
                    {getFormTotals().discountAmt > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Discount Amount</span><span className="text-red-500">-{formatCurrency(getFormTotals().discountAmt, formCurrency)}</span></div>}
                    <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200"><span>Total</span><span>{formatCurrency(getFormTotals().total, formCurrency)}</span></div>
                  </div>
                </div>
              </>)}

              {/* Step 3: Terms & Extras */}
              {invoiceStep === 2 && (<>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls}>Notes</label><textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={4} placeholder="Thank you for your business..." className={`${inputCls} resize-none`} /></div>
                  <div><label className={labelCls}>Terms & Conditions</label><textarea value={formTerms} onChange={(e) => setFormTerms(e.target.value)} rows={4} placeholder="Payment is due within the specified terms..." className={`${inputCls} resize-none`} /></div>
                </div>
                {/* Recurring Invoice */}
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium text-gray-800">Recurring Invoice</p><p className="text-[11px] text-gray-400 mt-0.5">Auto-send this invoice on a schedule</p></div>
                    <button type="button" onClick={() => setFormRecurring(!formRecurring)} className={`relative w-10 h-5 rounded-full transition-colors ${formRecurring ? "bg-[#2E86C1]" : "bg-gray-200"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${formRecurring ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                  {formRecurring && (
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100">
                      <div><label className={labelCls}>Interval</label><select value={formRecurringInterval} onChange={(e) => setFormRecurringInterval(e.target.value)} className={inputCls}><option value="weekly">Weekly</option><option value="biweekly">Bi-weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></div>
                      <div><label className={labelCls}>Send To Email</label><input type="email" value={formRecurringEmail} onChange={(e) => setFormRecurringEmail(e.target.value)} placeholder="client@company.com" className={inputCls} /></div>
                    </div>
                  )}
                </div>
              </>)}

              {/* Step 4: Preview */}
              {invoiceStep === 3 && (() => {
                const tpl = formTemplateName || "standard";
                const accent = LAYOUT_PREVIEWS[tpl]?.accent || "#2E86C1";
                const clientName = clients.find(c => c._id === formClientId)?.companyName || "—";
                const totals = getFormTotals();
                const items = recalculateItems(formItems);

                // Template-specific styles
                const tplStyles: Record<string, { headerBg: string; headerText: string; accentText: string; tableBg: string; bodyBg: string; totalBg: string }> = {
                  standard:     { headerBg: "bg-white",     headerText: "text-gray-900", accentText: "text-[#2E86C1]",  tableBg: "bg-gray-50",    bodyBg: "bg-white",     totalBg: "bg-blue-50" },
                  modern:       { headerBg: "bg-[#1E293B]", headerText: "text-white",    accentText: "text-white",      tableBg: "bg-slate-50",   bodyBg: "bg-white",     totalBg: "bg-slate-100" },
                  minimal:      { headerBg: "bg-white",     headerText: "text-gray-700", accentText: "text-gray-500",   tableBg: "bg-white",      bodyBg: "bg-white",     totalBg: "bg-white" },
                  professional: { headerBg: "bg-[#7C3AED]", headerText: "text-white",    accentText: "text-white",      tableBg: "bg-violet-50",  bodyBg: "bg-white",     totalBg: "bg-violet-50" },
                  creative:     { headerBg: "bg-gradient-to-r from-pink-500 to-rose-500", headerText: "text-white", accentText: "text-white", tableBg: "bg-pink-50", bodyBg: "bg-white", totalBg: "bg-pink-50" },
                };
                const s = tplStyles[tpl] || tplStyles.standard;

                return (<>
                  {/* Template switcher */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mr-1">Style:</span>
                    {Object.entries(LAYOUT_PREVIEWS).map(([key, preview]) => (
                      <button key={key} type="button" onClick={() => setFormTemplateName(key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                          tpl === key
                            ? "text-white shadow-md scale-105"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                        style={tpl === key ? { background: preview.accent } : undefined}
                      >
                        <div className="w-2.5 h-2.5 rounded-full border border-white/40" style={{ background: preview.accent }} />
                        {preview.label}
                      </button>
                    ))}
                    {templates.length > 0 && (<>
                      <div className="w-px h-5 bg-gray-200 mx-1" />
                      {templates.map((t) => (
                        <button key={t._id} type="button" onClick={() => { applyTemplate(t); }}
                          className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${formTemplateName === t.name ? "bg-[#2E86C1] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >{t.name}</button>
                      ))}
                    </>)}
                  </div>

                  {/* Invoice preview with template styles */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm transition-all duration-300">
                    {/* Header */}
                    <div className={`${s.headerBg} px-8 py-6`}>
                      <div className="flex justify-between items-start">
                        <div>
                          {formBrandLogo && (
                            <div className={`inline-block rounded-lg p-1.5 mb-2 ${tpl === "modern" || tpl === "professional" || tpl === "creative" ? "bg-white/90" : ""}`}>
                              <img src={formBrandLogo} alt="Logo" className="h-10 object-contain" />
                            </div>
                          )}
                          <p className={`text-xl font-bold ${s.headerText}`}>{formBrandName || "Your Company"}</p>
                          {formBrandAddress && <p className={`text-xs mt-0.5 ${tpl === "modern" || tpl === "professional" || tpl === "creative" ? "text-white/60" : "text-gray-500"}`}>{formBrandAddress}</p>}
                        </div>
                        <div className="text-right">
                          <p className={`text-3xl font-bold tracking-tight ${s.accentText}`}>INVOICE</p>
                          <div className={`text-xs mt-2 space-y-0.5 ${tpl === "modern" || tpl === "professional" || tpl === "creative" ? "text-white/60" : "text-gray-400"}`}>
                            <p>Issue: {formIssueDate || "—"}</p>
                            <p>Due: {formDueDate || "—"}</p>
                            <p>{formCurrency} | Net {formPaymentTerms}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className={`${s.bodyBg} px-8 py-6 text-[13px]`}>
                      <div className="mb-6 pb-4" style={{ borderBottom: `2px solid ${accent}20` }}>
                        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: accent }}>Bill To</p>
                        <p className="text-base font-semibold text-gray-800">{clientName}</p>
                      </div>

                      {/* Items table */}
                      <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-lg">
                      <table className="w-full mb-6">
                        <thead>
                          <tr className={`text-[10px] uppercase tracking-wider ${s.tableBg}`} style={{ borderBottom: `2px solid ${accent}30` }}>
                            <th className="text-left py-2.5 px-2">Description</th>
                            <th className="text-center py-2.5 w-14">Qty</th>
                            <th className="text-right py-2.5 w-24">Rate</th>
                            <th className="text-right py-2.5 w-14">Tax</th>
                            <th className="text-right py-2.5 px-2 w-24">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, i) => (
                            <tr key={i} className="border-b border-gray-100">
                              <td className="py-2.5 px-2 text-gray-700">{item.description || "—"}</td>
                              <td className="text-center py-2.5 text-gray-600">{item.quantity}</td>
                              <td className="text-right py-2.5 text-gray-600">{formatCurrency(item.rate, formCurrency)}</td>
                              <td className="text-right py-2.5 text-gray-400 text-xs">{item.taxRate || 0}%</td>
                              <td className="text-right py-2.5 px-2 font-medium text-gray-800">{formatCurrency(item.amount, formCurrency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>

                      {/* Totals */}
                      <div className="flex justify-end mb-6">
                        <div className={`w-64 rounded-lg p-4 ${s.totalBg}`}>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(totals.subtotal, formCurrency)}</span></div>
                            {totals.taxTotal > 0 && <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{formatCurrency(totals.taxTotal, formCurrency)}</span></div>}
                            {formDiscount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-{formatCurrency(totals.discountAmt, formCurrency)}</span></div>}
                            <div className="flex justify-between font-bold text-lg pt-2" style={{ borderTop: `2px solid ${accent}40` }}>
                              <span>Total</span>
                              <span style={{ color: accent }}>{formatCurrency(totals.total, formCurrency)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {formNotes && <div className="mb-4"><p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: accent }}>Notes</p><p className="text-gray-600 text-xs">{formNotes}</p></div>}
                      {formTerms && (
                        <div className="mb-4 p-4 rounded-lg" style={{ background: `${accent}08`, border: `1px solid ${accent}15` }}>
                          <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: accent }}>Terms & Conditions</p>
                          <p className="text-gray-600 text-xs whitespace-pre-line leading-relaxed">{formTerms}</p>
                        </div>
                      )}
                      {formSignature && (
                        <div className="text-right mt-6 pt-4" style={{ borderTop: `1px solid ${accent}20` }}>
                          <img src={formSignature} alt="Signature" className="inline-block h-14 object-contain" />
                          <p className="text-xs text-gray-400 mt-1">Authorized Signature</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>);
              })()}

              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white rounded-b-2xl">
              <div>
                {invoiceStep === 0 ? (
                  <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                ) : (
                  <button onClick={() => setInvoiceStep(invoiceStep - 1)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>Back
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {invoiceStep < 3 ? (
                  <button onClick={() => { if (!canNext(invoiceStep)) { toast.error(invoiceStep === 0 ? "Select a client and due date" : "Add at least one item"); return; } setInvoiceStep(invoiceStep + 1); }}
                    className="px-5 py-2 text-sm font-medium text-white bg-[#2E86C1] rounded-lg hover:bg-[#2574A9] flex items-center gap-1.5">
                    Next<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                ) : (<>
                  <button onClick={() => handleSave(true)} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">{submitting ? "Saving..." : "Save as Draft"}</button>
                  <button onClick={() => handleSave(false)} disabled={submitting} className="px-5 py-2 text-sm font-medium text-white bg-[#2E86C1] rounded-lg hover:bg-[#2574A9] disabled:opacity-50">{submitting ? "Saving..." : "Save & Send"}</button>
                </>)}
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Invoice Detail Modal */}
      {showDetailModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selectedInvoice.invoiceNumber}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <select
                    value={selectedInvoice.status}
                    onChange={(e) => {
                      handleStatusChange(selectedInvoice._id, e.target.value);
                      setSelectedInvoice({ ...selectedInvoice, status: e.target.value });
                    }}
                    className={`appearance-none cursor-pointer inline-flex items-center pl-2.5 pr-6 py-0.5 rounded-full text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 ${STATUS_COLORS[selectedInvoice.status]}`}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center' }}
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="partially_paid">Partially Paid</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  {selectedInvoice.isRecurring && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-200">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      Recurring
                    </span>
                  )}
                </div>
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

              {/* Recurring Info */}
              {selectedInvoice.isRecurring && (
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800">Recurring Invoice</p>
                    <p className="text-xs text-blue-600">
                      Frequency: <span className="font-medium capitalize">{selectedInvoice.recurringInterval || 'monthly'}</span>
                      {selectedInvoice.recurringNextDate && <> &middot; Starts: {formatDate(selectedInvoice.recurringNextDate)}</>}
                      {selectedInvoice.recurringEmail && <> &middot; Sends to: {selectedInvoice.recurringEmail}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openRecurringModal(selectedInvoice)}
                      className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { handleDisableRecurring(selectedInvoice); setSelectedInvoice({ ...selectedInvoice, isRecurring: false }); }}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      Disable
                    </button>
                  </div>
                </div>
              )}

              {/* Items */}
              <div>
                <div className="text-xs font-medium text-gray-400 uppercase mb-2">Items</div>
                <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-lg">
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

              {selectedInvoice.terms && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 uppercase mb-1">Terms & Conditions</div>
                  <div className="text-sm text-gray-600 whitespace-pre-line">{selectedInvoice.terms}</div>
                </div>
              )}

              {/* Sent Logs */}
              {(selectedInvoice.sentAt || selectedInvoice.emailCount > 0) && (
                <div className="border border-blue-100 rounded-lg overflow-hidden">
                  <div className="bg-blue-50 px-4 py-2">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Email History</p>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">
                          Sent to <span className="text-blue-600">{selectedInvoice.sentTo || "—"}</span>
                        </p>
                        <p className="text-xs text-gray-400">
                          {selectedInvoice.sentAt ? formatDate(selectedInvoice.sentAt) : "—"}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                        {selectedInvoice.emailCount} sent
                      </span>
                    </div>
                    {selectedInvoice.paymentMethod && (
                      <div className="flex items-center gap-3 pt-2 border-t border-blue-50">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 10v1" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">
                            Payment via <span className="capitalize">{selectedInvoice.paymentMethod.replace(/_/g, " ")}</span>
                          </p>
                          {selectedInvoice.paymentNotes && (
                            <p className="text-xs text-gray-400">{selectedInvoice.paymentNotes}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
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

      {/* Quick Preview Modal */}
      {quickPreviewInvoice && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">{quickPreviewInvoice.invoiceNumber}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[quickPreviewInvoice.status]}`}>{STATUS_LABELS[quickPreviewInvoice.status]}</span>
              </div>
              <button onClick={() => setQuickPreviewInvoice(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-8 max-h-[75vh] overflow-y-auto text-[13px]">
              <div className="flex justify-between items-start mb-8">
                <div>
                  {(quickPreviewInvoice as any).brandLogo && <img src={(quickPreviewInvoice as any).brandLogo} alt="Logo" className="h-12 mb-2 object-contain" />}
                  <p className="text-xl font-bold text-gray-900">{quickPreviewInvoice.brandName || "Company"}</p>
                  {quickPreviewInvoice.brandAddress && <p className="text-gray-500 text-xs mt-0.5">{quickPreviewInvoice.brandAddress}</p>}
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-[#2E86C1] tracking-tight">INVOICE</p>
                  <p className="text-xs text-gray-400 mt-2">Issue: {formatDate(quickPreviewInvoice.issueDate)}</p>
                  <p className="text-xs text-gray-400">Due: {formatDate(quickPreviewInvoice.dueDate)}</p>
                  <p className="text-xs text-gray-400">{quickPreviewInvoice.currency} | Net {quickPreviewInvoice.paymentTerms}</p>
                </div>
              </div>
              <div className="mb-6 pb-4 border-b border-gray-100">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Bill To</p>
                <p className="text-base font-semibold text-gray-800">{getClientName(quickPreviewInvoice.clientId)}</p>
              </div>
              <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-lg">
              <table className="w-full mb-6">
                <thead><tr className="text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-200"><th className="text-left py-2">Description</th><th className="text-center py-2 w-14">Qty</th><th className="text-right py-2 w-24">Rate</th><th className="text-right py-2 w-24">Amount</th></tr></thead>
                <tbody>{quickPreviewInvoice.items.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50"><td className="py-2.5 text-gray-700">{item.description}</td><td className="text-center py-2.5 text-gray-600">{item.quantity}</td><td className="text-right py-2.5 text-gray-600">{formatCurrency(item.rate, quickPreviewInvoice.currency)}</td><td className="text-right py-2.5 font-medium text-gray-800">{formatCurrency(item.amount, quickPreviewInvoice.currency)}</td></tr>
                ))}</tbody>
              </table>
              </div>
              <div className="flex justify-end mb-6">
                <div className="w-64 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(quickPreviewInvoice.subtotal, quickPreviewInvoice.currency)}</span></div>
                  {quickPreviewInvoice.taxTotal > 0 && <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{formatCurrency(quickPreviewInvoice.taxTotal, quickPreviewInvoice.currency)}</span></div>}
                  {quickPreviewInvoice.discount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-{formatCurrency(quickPreviewInvoice.discount, quickPreviewInvoice.currency)}</span></div>}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200"><span>Total</span><span className="text-[#2E86C1]">{formatCurrency(quickPreviewInvoice.total, quickPreviewInvoice.currency)}</span></div>
                  {quickPreviewInvoice.amountPaid > 0 && (<>
                    <div className="flex justify-between text-emerald-600"><span>Paid</span><span>{formatCurrency(quickPreviewInvoice.amountPaid, quickPreviewInvoice.currency)}</span></div>
                    <div className="flex justify-between font-bold text-amber-600"><span>Balance Due</span><span>{formatCurrency(quickPreviewInvoice.balanceDue, quickPreviewInvoice.currency)}</span></div>
                  </>)}
                </div>
              </div>
              {quickPreviewInvoice.notes && <div className="mb-4"><p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Notes</p><p className="text-gray-600 text-xs">{quickPreviewInvoice.notes}</p></div>}
              {quickPreviewInvoice.terms && <div className="mb-4 p-3 bg-gray-50 rounded-lg"><p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Terms & Conditions</p><p className="text-gray-600 text-xs whitespace-pre-line leading-relaxed">{quickPreviewInvoice.terms}</p></div>}
              {(quickPreviewInvoice as any).signature && <div className="text-right mt-6"><img src={(quickPreviewInvoice as any).signature} alt="Signature" className="inline-block h-14 object-contain" /><p className="text-xs text-gray-400 mt-1">Authorized Signature</p></div>}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {/* Recurring Settings Modal */}
      {showRecurringModal && recurringTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Set Recurring</h3>
                  <p className="text-xs text-gray-500">Invoice {recurringTarget.invoiceNumber}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Frequency *</label>
                <select
                  value={recurringModalInterval}
                  onChange={(e) => setRecurringModalInterval(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 bg-gray-50"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Start Date *</label>
                <input
                  type="date"
                  value={recurringModalStartDate}
                  onChange={(e) => setRecurringModalStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 bg-gray-50"
                />
                <p className="text-[11px] text-gray-400 mt-1">The first recurring invoice will be generated on this date</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Send To Email</label>
                <input
                  type="email"
                  value={recurringModalEmail}
                  onChange={(e) => setRecurringModalEmail(e.target.value)}
                  placeholder="client@company.com"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 bg-gray-50"
                />
              </div>
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  This invoice will recur <span className="font-semibold capitalize">{recurringModalInterval}</span> starting{" "}
                  <span className="font-semibold">{recurringModalStartDate ? formatDate(recurringModalStartDate) : "—"}</span>
                  {recurringModalEmail && <> and will be sent to <span className="font-semibold">{recurringModalEmail}</span></>}.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={() => { setShowRecurringModal(false); setRecurringTarget(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRecurring}
                disabled={!recurringModalStartDate}
                className="px-5 py-2 text-sm font-medium text-white bg-[#2E86C1] rounded-lg hover:bg-[#2574A9] disabled:opacity-50"
              >
                Save Recurring
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        variant={confirmConfig.variant}
        confirmLabel={confirmConfig.variant === "danger" ? "Delete" : "OK"}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
    </RouteGuard>
  );
}
