"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmployeePicker } from "@/components/EmployeePicker";
import { EmployeeMultiPicker } from "@/components/EmployeeMultiPicker";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Status configs
// ---------------------------------------------------------------------------
const jobStatusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600 border-gray-200" },
  open: { label: "Open", color: "bg-green-50 text-green-700 border-green-200" },
  on_hold: { label: "On Hold", color: "bg-amber-50 text-amber-700 border-amber-200" },
  closed: { label: "Closed", color: "bg-gray-50 text-gray-500 border-gray-200" },
  cancelled: { label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200" },
};
const candidateStatusConfig: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-50 text-blue-700 border-blue-200" },
  screening: { label: "Screening", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  in_process: { label: "In Process", color: "bg-purple-50 text-purple-700 border-purple-200" },
  offered: { label: "Offered", color: "bg-amber-50 text-amber-700 border-amber-200" },
  hired: { label: "Hired", color: "bg-green-50 text-green-700 border-green-200" },
  rejected: { label: "Rejected", color: "bg-red-50 text-red-700 border-red-200" },
  withdrawn: { label: "Withdrawn", color: "bg-gray-50 text-gray-500 border-gray-200" },
};
const JOB_TYPE_OPTIONS = ["full_time", "part_time", "contract", "intern"] as const;
const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: "Full Time", part_time: "Part Time", contract: "Contract", intern: "Intern",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
// Backend schema stores the posting's type as `employmentType`; the
// frontend historically read `type` which was always undefined — that's
// why the Type column always rendered as "—". Accept both.
interface Job {
  _id: string; title: string; location?: string;
  type?: string; employmentType?: string;
  description?: string; requirements?: string[]; skills?: string[];
  openings: number;
  // Backend schema field is `filledCount`. Old code read `job.filled`
  // which silently came back as `undefined` → every job dashboard
  // showed `0/N` regardless of actual hires. `filled` kept as an alias
  // for any legacy server response.
  filledCount?: number; filled?: number;
  status: string;
  hiringManager?: string; hiringManagerId?: string; createdAt?: string;
}
interface Candidate {
  _id: string; name: string; email: string; phone?: string;
  stage?: string; source?: string; status: string;
  jobId?: string; jobTitle?: string; createdAt?: string;
  // AI-parsed resume payload (populated when source='ai_parsed').
  // Shown as chips in the candidates list so recruiters can triage
  // without opening each candidate individually — the parsed signals
  // were previously invisible on the list view.
  parsedResume?: {
    skills?: string[];
    totalExperienceYears?: number;
    matchScore?: number; // 0-100 vs the candidate's applied job
    matchedJobId?: string;
  };
}

const INPUT = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400";
const SELECT = `${INPUT} bg-white`;
type TabKey = "jobs" | "candidates";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function RecruitmentPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();
  const isManager = hasOrgRole("manager") || hasOrgRole("admin") || hasOrgRole("hr");

  const [activeTab, setActiveTab] = useState<TabKey>("jobs");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [saving, setSaving] = useState(false);

  // Post Job modal
  const [showJobModal, setShowJobModal] = useState(false);
  const emptyJobForm = { title: "", location: "", type: "full_time", description: "", requirements: "", skills: "", openings: "1", hiringManager: "" };
  const [jobForm, setJobForm] = useState(emptyJobForm);

  // Schedule Interview modal
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [interviewCandidateId, setInterviewCandidateId] = useState("");
  // Interviewer IDs stored as an array — was a CSV string which needed
  // hand-typed user IDs. EmployeeMultiPicker (#17) handles the array
  // shape directly and resolves auth user IDs via the directory.
  const emptyInterviewForm: {
    round: string;
    type: string;
    dateTime: string;
    interviewerIds: string[];
  } = { round: "1", type: "video", dateTime: "", interviewerIds: [] };
  const [interviewForm, setInterviewForm] = useState(emptyInterviewForm);

  // Make Offer modal
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerCandidateId, setOfferCandidateId] = useState("");
  const emptyOfferForm = { ctc: "", joiningDate: "", designation: "" };
  const [offerForm, setOfferForm] = useState(emptyOfferForm);

  // Parse Resume modal (#17). Backend endpoint POST /candidates/parse-and-create
  // takes raw resume text + jobPostingId + email and returns a full
  // Candidate doc with AI-extracted fields (name, phone, skills, etc).
  // The AI call can take several seconds on a cold model load; the
  // `parsing` state toggles a spinner so users don't wonder if the page
  // froze, and failures fall back to a "create manually" toast.
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [parsing, setParsing] = useState(false);
  const emptyResumeForm = { resumeText: "", jobPostingId: "", email: "" };
  const [resumeForm, setResumeForm] = useState(emptyResumeForm);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
    if (!authLoading && user && !isManager) router.push("/dashboard");
  }, [user, authLoading, router, isManager]);

  // Data fetching
  // `GET /jobs` and `/candidates` return `{data: {data: [...], total, page, limit, totalPages}}`.
  // Earlier code looked for `.jobs` / `.candidates` keys that never
  // existed, so both lists stayed empty even when records were created.
  const unwrapList = <T,>(raw: any, legacyKey: string): T[] => {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    if (Array.isArray(raw?.[legacyKey])) return raw[legacyKey];
    return [];
  };

  const fetchJobs = useCallback(async () => {
    if (!user) return;
    try {
      const res: any = await payrollApi.getJobPostings();
      setJobs(unwrapList<Job>(res?.data, "jobs"));
    } catch (err: any) { toast.error(err.message || "Failed to load job postings"); }
  }, [user]);

  const fetchCandidates = useCallback(async () => {
    if (!user) return;
    try {
      const params: Record<string, string> = {};
      if (selectedJobId) params.jobId = selectedJobId;
      if (statusFilter) params.status = statusFilter;
      const res: any = await payrollApi.getCandidates(Object.keys(params).length ? params : undefined);
      setCandidates(unwrapList<Candidate>(res?.data, "candidates"));
    } catch (err: any) { toast.error(err.message || "Failed to load candidates"); }
  }, [user, selectedJobId, statusFilter]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchJobs(), fetchCandidates()]);
    setLoading(false);
  }, [fetchJobs, fetchCandidates]);

  useEffect(() => { if (user) fetchAll(); }, [fetchAll, user]);

  // Stats
  const jobStats = useMemo(() => ({
    openJobs: jobs.filter((j) => j.status === "open").length,
    onHold: jobs.filter((j) => j.status === "on_hold").length,
    totalCandidates: candidates.length,
    filled: jobs.reduce((sum, j) => sum + (j.filledCount ?? j.filled ?? 0), 0),
  }), [jobs, candidates]);

  // Pagination
  const ITEMS_PER_PAGE = 20;
  const [jobsPage, setJobsPage] = useState(1);
  const [candidatesPage, setCandidatesPage] = useState(1);
  const jobsTotalPages = Math.ceil(jobs.length / ITEMS_PER_PAGE);
  const candidatesTotalPages = Math.ceil(candidates.length / ITEMS_PER_PAGE);
  const paginatedJobs = jobs.slice((jobsPage - 1) * ITEMS_PER_PAGE, jobsPage * ITEMS_PER_PAGE);
  const paginatedCandidates = candidates.slice((candidatesPage - 1) * ITEMS_PER_PAGE, candidatesPage * ITEMS_PER_PAGE);

  // Reset pages on filter/tab changes
  useEffect(() => { setJobsPage(1); }, [activeTab]);
  useEffect(() => { setCandidatesPage(1); }, [activeTab, selectedJobId, statusFilter]);

  // Handlers
  const handleCreateJob = async () => {
    if (!jobForm.title.trim()) { toast.error("Job title is required"); return; }
    setSaving(true);
    try {
      const splitCsv = (s: string) => s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];
      // Backend DTO uses `employmentType` (not `type`) and `hiringManagerId`
      // (not `hiringManager`). Earlier code tripped the DTO whitelist with
      // an "unknown property `type`" 400 and a "hiringManagerId must be a
      // string" error when the field was left blank. Omit hiringManagerId
      // entirely if the user didn't fill it so the optional-string DTO
      // passes.
      // hiringManagerId is REQUIRED by the backend DTO (not optional).
      // If the user leaves the field blank, default to the current user
      // so the form isn't blocked — they can reassign later via edit.
      const hiringManagerId = jobForm.hiringManager.trim() || ((user as any)?._id ?? "");
      if (!hiringManagerId) {
        toast.error("Hiring Manager is required");
        setSaving(false);
        return;
      }
      const payload: Record<string, unknown> = {
        title: jobForm.title.trim(),
        location: jobForm.location.trim() || undefined,
        employmentType: jobForm.type,
        description: jobForm.description.trim() || undefined,
        requirements: splitCsv(jobForm.requirements),
        skills: splitCsv(jobForm.skills),
        openings: parseInt(jobForm.openings, 10) || 1,
        hiringManagerId,
      };
      await payrollApi.createJobPosting(payload);
      toast.success("Job posting created");
      setShowJobModal(false);
      setJobForm(emptyJobForm);
      await fetchJobs();
    } catch (err: any) { toast.error(err.message || "Failed to create job posting"); }
    finally { setSaving(false); }
  };

  const handleJobStatus = async (id: string, status: string) => {
    setActionLoading(id);
    try {
      await payrollApi.updateJobStatus(id, status);
      toast.success(`Job status updated to ${jobStatusConfig[status]?.label ?? status}`);
      await fetchJobs();
    } catch (err: any) { toast.error(err.message || "Failed to update job status"); }
    finally { setActionLoading(null); }
  };

  const handleViewCandidates = (jobId: string) => { setSelectedJobId(jobId); setActiveTab("candidates"); };

  const handleAdvance = async (id: string) => {
    setActionLoading(id);
    try {
      await payrollApi.advanceCandidate(id);
      toast.success("Candidate advanced to next stage");
      await fetchCandidates();
    } catch (err: any) { toast.error(err.message || "Failed to advance candidate"); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    setActionLoading(id);
    try {
      await payrollApi.rejectCandidate(id, reason);
      toast.success("Candidate rejected");
      await fetchCandidates();
    } catch (err: any) { toast.error(err.message || "Failed to reject candidate"); }
    finally { setActionLoading(null); }
  };

  const handleScheduleInterview = async () => {
    if (!interviewForm.dateTime) { toast.error("Date/time is required"); return; }
    setSaving(true);
    try {
      const splitCsv = (s: string) => s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];
      await payrollApi.scheduleInterview(interviewCandidateId, {
        round: parseInt(interviewForm.round, 10) || 1, type: interviewForm.type,
        dateTime: interviewForm.dateTime, interviewerIds: interviewForm.interviewerIds,
      });
      toast.success("Interview scheduled");
      setShowInterviewModal(false);
      setInterviewForm(emptyInterviewForm);
      await fetchCandidates();
    } catch (err: any) { toast.error(err.message || "Failed to schedule interview"); }
    finally { setSaving(false); }
  };

  const handleMakeOffer = async () => {
    if (!offerForm.ctc || !offerForm.joiningDate || !offerForm.designation) {
      toast.error("All offer fields are required"); return;
    }
    setSaving(true);
    try {
      await payrollApi.createOffer(offerCandidateId, {
        ctc: parseFloat(offerForm.ctc) * 100,
        joiningDate: offerForm.joiningDate, designation: offerForm.designation.trim(),
      });
      toast.success("Offer created");
      setShowOfferModal(false);
      setOfferForm(emptyOfferForm);
      await fetchCandidates();
    } catch (err: any) { toast.error(err.message || "Failed to create offer"); }
    finally { setSaving(false); }
  };

  // canMakeOffer was matching hardcoded stage names that don't align
  // with the dynamic pipelines a job can define. Moved to the status
  // enum (which IS stable) — any candidate in-process or past
  // interviews is offer-eligible. Terminal states (`hired`, `rejected`,
  // `withdrawn`) are already filtered in the row renderer above.
  const canMakeOffer = (status?: string, stage?: string): boolean => {
    if (["in_process", "offered"].includes(status ?? "")) return true;
    // Legacy stage-name check retained as a safety net for orgs that
    // haven't migrated their pipeline shape yet.
    return ["interview", "final_interview", "in_process", "offered"].includes(stage ?? "");
  };

  // Parse resume → create candidate (#17). Extracts structured fields
  // via ai-service and persists a full Candidate record in one shot.
  // Graceful on AI failure: the backend endpoint will 502/503 if the
  // model is down — we surface a clear toast and keep the modal open
  // so the user can retry or fall back to manual entry.
  const handleParseResume = async () => {
    if (!resumeForm.jobPostingId) { toast.error("Pick a job posting"); return; }
    if (!resumeForm.email.trim()) { toast.error("Candidate email is required (used for dedup)"); return; }
    if (resumeForm.resumeText.trim().length < 50) {
      toast.error("Paste at least the resume body (≥ 50 chars)");
      return;
    }
    setParsing(true);
    try {
      const res: any = await payrollApi.parseAndCreateCandidate({
        resumeText: resumeForm.resumeText.trim(),
        jobPostingId: resumeForm.jobPostingId,
        email: resumeForm.email.trim().toLowerCase(),
      });
      const data = res?.data ?? res;
      toast.success(`Candidate created: ${data?.name || "new entry"}`);
      setShowResumeModal(false);
      setResumeForm(emptyResumeForm);
      await fetchCandidates();
    } catch (err: any) {
      // AI failures can look like a generic 500. Surface the raw
      // message so admins know whether to retry or enter manually.
      toast.error(err.message || "AI resume parser unavailable — add the candidate manually");
    } finally {
      setParsing(false);
    }
  };

  // Loading state
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800" />
      </div>
    );
  }

  const StatusBadge = ({ config, status }: { config: Record<string, { label: string; color: string }>; status: string }) => {
    const sc = config[status] ?? { label: status, color: "bg-gray-100 text-gray-600 border-gray-200" };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${sc.color}`}>{sc.label}</span>;
  };

  const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
    <th className={`${right ? "text-right" : "text-left"} px-4 py-3 font-medium text-gray-500`}>{children}</th>
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user!} onLogout={logout} />
      <main className="flex-1 min-w-0 md:ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recruitment</h1>
            <p className="text-sm text-gray-500 mt-1">Manage job postings and candidates</p>
          </div>
          {activeTab === "jobs" && <Button onClick={() => setShowJobModal(true)}>Post New Job</Button>}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg border border-gray-200 p-1 w-fit">
          {(["jobs", "candidates"] as TabKey[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`}>
              {tab === "jobs" ? "Jobs" : "Candidates"}
            </button>
          ))}
        </div>

        {/* Jobs Tab */}
        {activeTab === "jobs" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Open Jobs", value: jobStats.openJobs, color: "text-green-700" },
                { label: "On Hold", value: jobStats.onHold, color: "text-amber-700" },
                { label: "Total Candidates", value: jobStats.totalCandidates, color: "text-blue-700" },
                { label: "Positions Filled", value: jobStats.filled, color: "text-indigo-700" },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="p-0">
                {loading ? <div className="p-8 text-center text-gray-400">Loading...</div>
                : jobs.length === 0 ? <div className="p-8 text-center text-gray-400">No job postings found</div>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-100 bg-gray-50/50">
                        <TH>Title</TH><TH>Location</TH><TH>Type</TH><TH>Openings / Filled</TH><TH>Status</TH><TH right>Actions</TH>
                      </tr></thead>
                      <tbody>
                        {paginatedJobs.map((job) => (
                          <tr key={job._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-medium text-gray-900">{job.title}</td>
                            <td className="px-4 py-3 text-gray-600">{job.location || "\u2014"}</td>
                            <td className="px-4 py-3 text-gray-600">{(() => { const t = job.employmentType || job.type || ""; return JOB_TYPE_LABELS[t] ?? t ?? "\u2014"; })()}</td>
                            <td className="px-4 py-3 text-gray-600">{job.openings} / {job.filledCount ?? job.filled ?? 0}</td>
                            <td className="px-4 py-3"><StatusBadge config={jobStatusConfig} status={job.status} /></td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {job.status === "draft" && (
                                  <Button variant="outline" size="sm" disabled={actionLoading === job._id} onClick={() => handleJobStatus(job._id, "open")}>Open</Button>
                                )}
                                {job.status === "open" && (
                                  <>
                                    <Button variant="outline" size="sm" disabled={actionLoading === job._id} onClick={() => handleJobStatus(job._id, "on_hold")}>Hold</Button>
                                    <Button variant="outline" size="sm" disabled={actionLoading === job._id} onClick={() => handleJobStatus(job._id, "closed")}>Close</Button>
                                  </>
                                )}
                                <Button variant="outline" size="sm" onClick={() => handleViewCandidates(job._id)}>View Candidates</Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {jobsTotalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0]">
                        <p className="text-[12px] text-[#64748B]">
                          Showing {(jobsPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(jobsPage * ITEMS_PER_PAGE, jobs.length)} of {jobs.length}
                        </p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setJobsPage(p => Math.max(1, p - 1))}
                            disabled={jobsPage === 1}
                            className="px-3 py-1.5 text-[12px] rounded-lg border border-[#E2E8F0] disabled:opacity-40 hover:bg-[#F8FAFC]"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => setJobsPage(p => Math.min(jobsTotalPages, p + 1))}
                            disabled={jobsPage === jobsTotalPages}
                            className="px-3 py-1.5 text-[12px] rounded-lg border border-[#E2E8F0] disabled:opacity-40 hover:bg-[#F8FAFC]"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Candidates Tab */}
        {activeTab === "candidates" && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} className={SELECT}>
                <option value="">All Jobs</option>
                {jobs.map((j) => <option key={j._id} value={j._id}>{j.title}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={SELECT}>
                <option value="">All Statuses</option>
                {Object.entries(candidateStatusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              {/* #17 headline: AI resume parse. Previously the backend
                  endpoint existed but there was no UI wired to it. */}
              <Button
                className="ml-auto"
                onClick={() => {
                  setResumeForm({
                    ...emptyResumeForm,
                    jobPostingId: selectedJobId || (jobs[0]?._id ?? ""),
                  });
                  setShowResumeModal(true);
                }}
              >
                ✨ Parse Resume with AI
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {loading ? <div className="p-8 text-center text-gray-400">Loading...</div>
                : candidates.length === 0 ? <div className="p-8 text-center text-gray-400">No candidates found</div>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-100 bg-gray-50/50">
                        <TH>Name</TH><TH>Email</TH><TH>AI signals</TH><TH>Stage</TH><TH>Source</TH><TH>Status</TH><TH right>Actions</TH>
                      </tr></thead>
                      <tbody>
                        {paginatedCandidates.map((c) => {
                          const isTerminal = ["hired", "rejected", "withdrawn"].includes(c.status);
                          // AI-parsed signals. When a candidate was
                          // created via Parse Resume, backend populates
                          // skills/totalYears/matchScore. Surface them
                          // on the list so recruiters can scan fit
                          // without opening each row.
                          const parsed = c.parsedResume;
                          const topSkills = parsed?.skills?.slice(0, 3) ?? [];
                          const score = parsed?.matchScore;
                          const yrs = parsed?.totalExperienceYears;
                          return (
                            <tr key={c._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                              <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                              <td className="px-4 py-3 text-gray-600">{c.email}</td>
                              <td className="px-4 py-3">
                                {parsed ? (
                                  <div className="flex flex-wrap items-center gap-1">
                                    {typeof score === "number" && (
                                      <span
                                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                          score >= 75 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            : score >= 50 ? "bg-amber-50 text-amber-700 border-amber-200"
                                            : "bg-gray-50 text-gray-600 border-gray-200"
                                        }`}
                                        title="AI match score against the applied job"
                                      >
                                        {score}% match
                                      </span>
                                    )}
                                    {typeof yrs === "number" && yrs > 0 && (
                                      <span className="text-[10px] text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50">
                                        {yrs} yr
                                      </span>
                                    )}
                                    {topSkills.map((s) => (
                                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700">
                                        {s}
                                      </span>
                                    ))}
                                    {(parsed.skills?.length ?? 0) > 3 && (
                                      <span className="text-[10px] text-gray-400">+{(parsed.skills?.length ?? 0) - 3}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-600">{c.stage ?? "\u2014"}</td>
                              <td className="px-4 py-3 text-gray-600">{c.source ?? "\u2014"}</td>
                              <td className="px-4 py-3"><StatusBadge config={candidateStatusConfig} status={c.status} /></td>
                              <td className="px-4 py-3 text-right">
                                {!isTerminal && (
                                  <div className="flex items-center justify-end gap-2">
                                    <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-50" disabled={actionLoading === c._id} onClick={() => handleAdvance(c._id)}>Advance</Button>
                                    <Button variant="outline" size="sm" className="text-red-700 border-red-300 hover:bg-red-50" disabled={actionLoading === c._id} onClick={() => handleReject(c._id)}>Reject</Button>
                                    <Button variant="outline" size="sm" disabled={actionLoading === c._id} onClick={() => { setInterviewCandidateId(c._id); setShowInterviewModal(true); }}>Schedule Interview</Button>
                                    {canMakeOffer(c.status, c.stage) && (
                                      <Button variant="outline" size="sm" className="text-indigo-700 border-indigo-300 hover:bg-indigo-50" disabled={actionLoading === c._id} onClick={() => { setOfferCandidateId(c._id); setShowOfferModal(true); }}>Make Offer</Button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {candidatesTotalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0]">
                        <p className="text-[12px] text-[#64748B]">
                          Showing {(candidatesPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(candidatesPage * ITEMS_PER_PAGE, candidates.length)} of {candidates.length}
                        </p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setCandidatesPage(p => Math.max(1, p - 1))}
                            disabled={candidatesPage === 1}
                            className="px-3 py-1.5 text-[12px] rounded-lg border border-[#E2E8F0] disabled:opacity-40 hover:bg-[#F8FAFC]"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => setCandidatesPage(p => Math.min(candidatesTotalPages, p + 1))}
                            disabled={candidatesPage === candidatesTotalPages}
                            className="px-3 py-1.5 text-[12px] rounded-lg border border-[#E2E8F0] disabled:opacity-40 hover:bg-[#F8FAFC]"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Post New Job Modal */}
        {showJobModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Post New Job</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input type="text" value={jobForm.title} onChange={(e) => setJobForm((f) => ({ ...f, title: e.target.value }))} className={INPUT} placeholder="e.g. Senior Frontend Developer" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input type="text" value={jobForm.location} onChange={(e) => setJobForm((f) => ({ ...f, location: e.target.value }))} className={INPUT} placeholder="e.g. Bangalore" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select value={jobForm.type} onChange={(e) => setJobForm((f) => ({ ...f, type: e.target.value }))} className={SELECT}>
                      {JOB_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{JOB_TYPE_LABELS[t]}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={jobForm.description} onChange={(e) => setJobForm((f) => ({ ...f, description: e.target.value }))} rows={3} className={INPUT} placeholder="Job description..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Requirements (comma-separated)</label>
                  <input type="text" value={jobForm.requirements} onChange={(e) => setJobForm((f) => ({ ...f, requirements: e.target.value }))} className={INPUT} placeholder="e.g. 3+ years React, TypeScript" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma-separated)</label>
                  <input type="text" value={jobForm.skills} onChange={(e) => setJobForm((f) => ({ ...f, skills: e.target.value }))} className={INPUT} placeholder="e.g. React, Node.js, PostgreSQL" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Openings</label>
                    <input type="number" min="1" value={jobForm.openings} onChange={(e) => setJobForm((f) => ({ ...f, openings: e.target.value }))} className={INPUT} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hiring Manager</label>
                    {/* Autocomplete picker — was free-text "Manager user ID".
                        Backend DTO accepts the auth `user._id` as
                        `hiringManagerId`, so the picker returns that shape. */}
                    <EmployeePicker
                      value={jobForm.hiringManager}
                      onChange={(next) => setJobForm((f) => ({ ...f, hiringManager: next }))}
                      valueKind="authUserId"
                      placeholder="Search by name, ID, or email…"
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowJobModal(false)} disabled={saving}>Cancel</Button>
                <Button onClick={handleCreateJob} disabled={saving}>{saving ? "Creating..." : "Create"}</Button>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Interview Modal */}
        {showInterviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Schedule Interview</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Round #</label>
                    <input type="number" min="1" value={interviewForm.round} onChange={(e) => setInterviewForm((f) => ({ ...f, round: e.target.value }))} className={INPUT} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select value={interviewForm.type} onChange={(e) => setInterviewForm((f) => ({ ...f, type: e.target.value }))} className={SELECT}>
                      <option value="phone">Phone</option><option value="video">Video</option>
                      <option value="onsite">On-site</option><option value="technical">Technical</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
                  <input type="datetime-local" value={interviewForm.dateTime} onChange={(e) => setInterviewForm((f) => ({ ...f, dateTime: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interviewers</label>
                  {/* Was a free-text CSV of user IDs — unusable UX.
                      EmployeeMultiPicker pulls from the HR directory
                      and yields the auth `user._id` shape the backend
                      expects. */}
                  <EmployeeMultiPicker
                    value={interviewForm.interviewerIds}
                    onChange={(next) => setInterviewForm((f) => ({ ...f, interviewerIds: next }))}
                    valueKind="authUserId"
                    placeholder="Search by name, ID, or email…"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowInterviewModal(false)} disabled={saving}>Cancel</Button>
                <Button onClick={handleScheduleInterview} disabled={saving}>{saving ? "Scheduling..." : "Schedule"}</Button>
              </div>
            </div>
          </div>
        )}

        {/* Make Offer Modal */}
        {showOfferModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Make Offer</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTC (INR) *</label>
                  <input type="number" min="0" step="0.01" value={offerForm.ctc} onChange={(e) => setOfferForm((f) => ({ ...f, ctc: e.target.value }))} className={INPUT} placeholder="e.g. 1200000" />
                  <p className="text-xs text-gray-400 mt-1">Amount in rupees (stored as paise)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Joining Date *</label>
                  <input type="date" value={offerForm.joiningDate} onChange={(e) => setOfferForm((f) => ({ ...f, joiningDate: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Designation *</label>
                  <input type="text" value={offerForm.designation} onChange={(e) => setOfferForm((f) => ({ ...f, designation: e.target.value }))} className={INPUT} placeholder="e.g. Senior Engineer" />
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowOfferModal(false)} disabled={saving}>Cancel</Button>
                <Button onClick={handleMakeOffer} disabled={saving}>{saving ? "Creating..." : "Create Offer"}</Button>
              </div>
            </div>
          </div>
        )}

        {/* Parse Resume modal — #17 headline feature. Structured-field
            extraction via ai-service → auto-create Candidate. */}
        {showResumeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Parse Resume with AI</h2>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  Paste the raw text of a resume and we'll extract the candidate's
                  name, contact, skills, and experience. Useful for bulk inbox
                  triage — pastes from LinkedIn/Naukri work too.
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job posting *</label>
                  <select
                    value={resumeForm.jobPostingId}
                    onChange={(e) => setResumeForm((f) => ({ ...f, jobPostingId: e.target.value }))}
                    className={SELECT}
                  >
                    <option value="">Select a job…</option>
                    {jobs
                      .filter((j) => j.status !== "closed" && j.status !== "cancelled")
                      .map((j) => (
                        <option key={j._id} value={j._id}>
                          {j.title} ({j.openings} open)
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Drives the match-score computation against the candidate's skills.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Candidate email *</label>
                  <input
                    type="email"
                    value={resumeForm.email}
                    onChange={(e) => setResumeForm((f) => ({ ...f, email: e.target.value }))}
                    className={INPUT}
                    placeholder="candidate@example.com"
                  />
                  <p className="text-xs text-gray-400 mt-1">Used for de-duplication against existing candidates.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Resume text *</label>
                  <textarea
                    value={resumeForm.resumeText}
                    onChange={(e) => setResumeForm((f) => ({ ...f, resumeText: e.target.value }))}
                    rows={14}
                    className={`${INPUT} font-mono text-[12px]`}
                    placeholder="Paste the resume body here…"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {resumeForm.resumeText.length.toLocaleString()} chars
                    {resumeForm.resumeText.length > 100_000 && (
                      <span className="text-red-600"> · exceeds 100,000 char limit</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 flex items-center justify-between gap-3">
                <p className="text-[11px] text-gray-500">
                  ⏱ Cold-model parses can take 15–20s. Stay on this modal.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowResumeModal(false);
                      setResumeForm(emptyResumeForm);
                    }}
                    disabled={parsing}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleParseResume} disabled={parsing}>
                    {parsing ? "Parsing…" : "Parse & Create"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
