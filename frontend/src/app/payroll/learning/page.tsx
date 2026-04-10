"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Category configuration
// ---------------------------------------------------------------------------
const categoryConfig: Record<string, { label: string; color: string; icon: string }> = {
  technical: { label: "Technical", color: "bg-blue-50 text-blue-700", icon: "\uD83D\uDCBB" },
  soft_skills: { label: "Soft Skills", color: "bg-purple-50 text-purple-700", icon: "\uD83D\uDDE3\uFE0F" },
  compliance: { label: "Compliance", color: "bg-red-50 text-red-700", icon: "\uD83D\uDCCB" },
  leadership: { label: "Leadership", color: "bg-amber-50 text-amber-700", icon: "\uD83C\uDFAF" },
  onboarding: { label: "Onboarding", color: "bg-emerald-50 text-emerald-700", icon: "\uD83D\uDC4B" },
  product: { label: "Product", color: "bg-indigo-50 text-indigo-700", icon: "\uD83D\uDCE6" },
  sales: { label: "Sales", color: "bg-pink-50 text-pink-700", icon: "\uD83D\uDCBC" },
  customer_service: { label: "Customer Service", color: "bg-cyan-50 text-cyan-700", icon: "\uD83C\uDFA7" },
  other: { label: "Other", color: "bg-gray-100 text-gray-700", icon: "\uD83D\uDCDA" },
};

const levelConfig: Record<string, { label: string; color: string }> = {
  beginner: { label: "Beginner", color: "bg-green-50 text-green-700" },
  intermediate: { label: "Intermediate", color: "bg-amber-50 text-amber-700" },
  advanced: { label: "Advanced", color: "bg-red-50 text-red-700" },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Course {
  _id: string;
  title: string;
  description?: string;
  category: string;
  level?: string;
  thumbnailUrl?: string;
  coverImageUrl?: string;
  duration?: number;
  durationMinutes?: number;
  lessonsCount?: number;
  lessons?: unknown[];
  isMandatory?: boolean;
  status?: string;
  instructor?: string;
  rating?: number;
  enrollmentCount?: number;
  passingScore?: number;
  dueInDays?: number;
  createdAt?: string;
}

interface Enrollment {
  _id: string;
  courseId: string | Course;
  course?: Course;
  status: string;
  progressPercentage?: number;
  progress?: number;
  startedAt?: string;
  completedAt?: string;
  dueDate?: string;
  isMandatory?: boolean;
  certificateId?: string;
  lastAccessedAt?: string;
}

interface Certificate {
  _id: string;
  certificateNumber?: string;
  courseTitle?: string;
  courseName?: string;
  category?: string;
  issuedAt?: string;
  issuedDate?: string;
  verificationCode: string;
  score?: number;
  revoked?: boolean;
  courseId?: string | Course;
  course?: Course;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatDate = (dateStr?: string) => {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDuration = (minutes?: number) => {
  if (!minutes || minutes <= 0) return "\u2014";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const isOverdue = (dueDate?: string) => {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
};

const resolveCourse = (e: Enrollment): Course | null => {
  if (e.course) return e.course;
  if (typeof e.courseId === "object" && e.courseId) return e.courseId as Course;
  return null;
};

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
type TabKey = "my" | "mandatory" | "catalog" | "certificates" | "admin";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function LearningPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const isAdmin = hasOrgRole("admin") || hasOrgRole("hr");

  const [activeTab, setActiveTab] = useState<TabKey>("my");
  const [loading, setLoading] = useState(true);

  const [myEnrollments, setMyEnrollments] = useState<Enrollment[]>([]);
  const [mandatoryCourses, setMandatoryCourses] = useState<Course[]>([]);
  const [mandatoryEnrollments, setMandatoryEnrollments] = useState<Enrollment[]>([]);
  const [catalog, setCatalog] = useState<Course[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [adminCourses, setAdminCourses] = useState<Course[]>([]);

  // Catalog filters
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [detailCourse, setDetailCourse] = useState<Course | null>(null);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  // Create course modal (admin)
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("technical");
  const [newLevel, setNewLevel] = useState("beginner");
  const [newDuration, setNewDuration] = useState("");
  const [newMandatory, setNewMandatory] = useState(false);
  const [saving, setSaving] = useState(false);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------
  const fetchMy = useCallback(async () => {
    try {
      const res = await payrollApi.getMyActiveCourses();
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.enrollments ?? [];
      setMyEnrollments(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load your courses");
    }
  }, []);

  const fetchMandatory = useCallback(async () => {
    try {
      const res = await payrollApi.getMandatoryCourses();
      const payload = res.data as any;
      if (Array.isArray(payload)) {
        setMandatoryCourses(payload);
        setMandatoryEnrollments([]);
      } else {
        setMandatoryCourses(payload?.courses || []);
        setMandatoryEnrollments(payload?.enrollments || []);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load mandatory courses");
    }
  }, []);

  const fetchCatalog = useCallback(async () => {
    try {
      const params: Record<string, string> = { status: "published" };
      if (filterCategory) params.category = filterCategory;
      if (filterLevel) params.level = filterLevel;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await payrollApi.listCourses(params);
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.courses ?? [];
      setCatalog(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load catalog");
    }
  }, [filterCategory, filterLevel, searchQuery]);

  const fetchCertificates = useCallback(async () => {
    try {
      const res = await payrollApi.getMyCertificates();
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.certificates ?? [];
      setCertificates(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load certificates");
    }
  }, []);

  const fetchAdmin = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await payrollApi.listCourses();
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.courses ?? [];
      setAdminCourses(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load admin courses");
    }
  }, [isAdmin]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchMy(),
      fetchMandatory(),
      fetchCatalog(),
      fetchCertificates(),
      fetchAdmin(),
    ]);
    setLoading(false);
  }, [fetchMy, fetchMandatory, fetchCatalog, fetchCertificates, fetchAdmin]);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, fetchAll]);

  // Refetch catalog on filter change
  useEffect(() => {
    if (activeTab === "catalog" && user) {
      const timer = setTimeout(() => fetchCatalog(), 250);
      return () => clearTimeout(timer);
    }
  }, [filterCategory, filterLevel, searchQuery, activeTab, user, fetchCatalog]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------
  const handleEnroll = async (courseId: string) => {
    setEnrolling(courseId);
    try {
      await payrollApi.enrollInCourse({ courseId });
      toast.success("Successfully enrolled");
      setDetailCourse(null);
      await Promise.all([fetchMy(), fetchCatalog()]);
    } catch (err: any) {
      toast.error(err.message || "Failed to enroll");
    } finally {
      setEnrolling(null);
    }
  };

  const handleOpenCourse = (enrollmentId: string) => {
    router.push(`/payroll/learning/${enrollmentId}`);
  };

  const handlePublish = async (courseId: string) => {
    try {
      await payrollApi.publishCourse(courseId);
      toast.success("Course published");
      await fetchAdmin();
    } catch (err: any) {
      toast.error(err.message || "Failed to publish");
    }
  };

  const handleArchive = async (courseId: string) => {
    try {
      await payrollApi.archiveCourse(courseId);
      toast.success("Course archived");
      await fetchAdmin();
    } catch (err: any) {
      toast.error(err.message || "Failed to archive");
    }
  };

  const handleCreateCourse = async () => {
    if (!newTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      await payrollApi.createCourse({
        title: newTitle.trim(),
        description: newDescription.trim(),
        category: newCategory,
        level: newLevel,
        duration: newDuration ? parseInt(newDuration, 10) : undefined,
        isMandatory: newMandatory,
      });
      toast.success("Course created");
      setShowCreate(false);
      setNewTitle("");
      setNewDescription("");
      setNewCategory("technical");
      setNewLevel("beginner");
      setNewDuration("");
      setNewMandatory(false);
      await fetchAdmin();
    } catch (err: any) {
      toast.error(err.message || "Failed to create course");
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Stats (for header summary)
  // -----------------------------------------------------------------------
  const stats = useMemo(() => {
    const inProgress = myEnrollments.filter((e) => e.status === "in_progress").length;
    const completed = myEnrollments.filter((e) => e.status === "completed").length;
    const overdue = [...myEnrollments, ...mandatoryEnrollments].filter(
      (e) => e.dueDate && isOverdue(e.dueDate) && e.status !== "completed",
    ).length;
    return {
      inProgress,
      completed,
      overdue,
      certificates: certificates.length,
    };
  }, [myEnrollments, mandatoryEnrollments, certificates]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------
  const renderCourseCard = (
    course: Course,
    opts: {
      enrollment?: Enrollment;
      mandatory?: boolean;
      catalog?: boolean;
    } = {},
  ) => {
    const { enrollment, mandatory, catalog: inCatalog } = opts;
    const cat = categoryConfig[course.category] || categoryConfig.other;
    const lvl = course.level ? levelConfig[course.level] : null;
    const progress = enrollment?.progressPercentage ?? enrollment?.progress ?? 0;
    const status = enrollment?.status || "not_enrolled";
    const overdue = enrollment?.dueDate && isOverdue(enrollment.dueDate) && status !== "completed";
    const lessonsCount = course.lessonsCount ?? course.lessons?.length ?? 0;
    const duration = course.duration ?? course.durationMinutes;

    return (
      <div
        key={course._id + (enrollment?._id || "")}
        className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
      >
        {/* Thumbnail */}
        <div className="relative h-40 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center overflow-hidden">
          {course.thumbnailUrl || course.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.thumbnailUrl || course.coverImageUrl}
              alt={course.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-6xl">{cat.icon}</div>
          )}
          {mandatory && (
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase bg-red-600 text-white">
                Mandatory
              </span>
            </div>
          )}
          {overdue && (
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase bg-red-700 text-white">
                Overdue
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1">
              {course.title}
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${cat.color}`}>
              {cat.icon} {cat.label}
            </span>
            {lvl && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${lvl.color}`}>
                {lvl.label}
              </span>
            )}
          </div>

          {course.description && (
            <p className="text-xs text-gray-600 line-clamp-2">{course.description}</p>
          )}

          {/* Progress */}
          {enrollment && status !== "not_enrolled" && (
            <div>
              <div className="flex items-center justify-between text-[11px] text-gray-600 mb-1">
                <span>Progress</span>
                <span className="font-semibold">{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <span>{lessonsCount} lesson{lessonsCount !== 1 ? "s" : ""}</span>
            <span>{formatDuration(duration)}</span>
          </div>

          {enrollment?.dueDate && (
            <div className={`text-[11px] ${overdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
              Due: {formatDate(enrollment.dueDate)}
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-1 flex gap-2">
            {inCatalog && !enrollment && (
              <>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={enrolling === course._id}
                  onClick={() => handleEnroll(course._id)}
                >
                  {enrolling === course._id ? "Enrolling..." : "Enroll"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDetailCourse(course)}
                >
                  Details
                </Button>
              </>
            )}
            {enrollment && status === "in_progress" && (
              <Button
                size="sm"
                className="flex-1"
                onClick={() => handleOpenCourse(enrollment._id)}
              >
                Continue Learning
              </Button>
            )}
            {enrollment && (status === "enrolled" || status === "not_started") && (
              <Button
                size="sm"
                className="flex-1"
                onClick={() => handleOpenCourse(enrollment._id)}
              >
                Start
              </Button>
            )}
            {enrollment && status === "completed" && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setActiveTab("certificates")}
              >
                View Certificate
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // -----------------------------------------------------------------------
  // Tab content
  // -----------------------------------------------------------------------
  const renderMyCourses = () => {
    if (loading) {
      return <div className="text-sm text-gray-500">Loading your courses...</div>;
    }
    if (myEnrollments.length === 0) {
      return (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">{"\uD83D\uDCDA"}</div>
          <p className="text-sm text-gray-600 mb-4">You haven&apos;t enrolled in any courses yet.</p>
          <Button onClick={() => setActiveTab("catalog")}>Browse Catalog</Button>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {myEnrollments.map((e) => {
          const course = resolveCourse(e);
          if (!course) return null;
          return renderCourseCard(course, { enrollment: e, mandatory: e.isMandatory });
        })}
      </div>
    );
  };

  const renderMandatory = () => {
    if (loading) {
      return <div className="text-sm text-gray-500">Loading mandatory courses...</div>;
    }
    const combined: { course: Course; enrollment?: Enrollment }[] = [];
    mandatoryCourses.forEach((c) => {
      const e = mandatoryEnrollments.find((en) => {
        const cid = typeof en.courseId === "string" ? en.courseId : (en.courseId as Course)?._id;
        return cid === c._id;
      });
      combined.push({ course: c, enrollment: e });
    });
    if (combined.length === 0) {
      return (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">{"\u2705"}</div>
          <p className="text-sm text-gray-600">No mandatory courses assigned right now.</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {combined.map(({ course, enrollment }) =>
          renderCourseCard(course, { enrollment, mandatory: true, catalog: !enrollment }),
        )}
      </div>
    );
  };

  const renderCatalog = () => (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <input
          type="text"
          placeholder="Search courses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {Object.entries(categoryConfig).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.label}
            </option>
          ))}
        </select>
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Levels</option>
          {Object.entries(levelConfig).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Loading catalog...</div>
      ) : catalog.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-sm text-gray-600">No courses match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalog.map((c) => {
            const existing = myEnrollments.find((e) => {
              const cid = typeof e.courseId === "string" ? e.courseId : (e.courseId as Course)?._id;
              return cid === c._id;
            });
            return renderCourseCard(c, { enrollment: existing, catalog: !existing });
          })}
        </div>
      )}
    </div>
  );

  const renderCertificates = () => {
    if (loading) {
      return <div className="text-sm text-gray-500">Loading certificates...</div>;
    }
    if (certificates.length === 0) {
      return (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">{"\uD83C\uDFC6"}</div>
          <p className="text-sm text-gray-600">Complete courses to earn certificates.</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {certificates.map((cert) => {
          const courseTitle =
            cert.courseTitle ||
            cert.courseName ||
            (typeof cert.courseId === "object" ? (cert.courseId as Course)?.title : "") ||
            cert.course?.title ||
            "Course";
          const category =
            cert.category ||
            (typeof cert.courseId === "object" ? (cert.courseId as Course)?.category : "") ||
            cert.course?.category ||
            "other";
          const cat = categoryConfig[category] || categoryConfig.other;
          return (
            <div
              key={cert._id}
              className={`bg-white border rounded-xl p-5 flex items-center gap-4 ${
                cert.revoked ? "border-red-200 opacity-75" : "border-gray-200"
              }`}
            >
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl">
                {"\uD83C\uDFC6"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-gray-900">{courseTitle}</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${cat.color}`}>
                    {cat.label}
                  </span>
                  {cert.revoked && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">
                      Revoked
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-gray-500 flex items-center gap-3 flex-wrap">
                  <span>Issued: {formatDate(cert.issuedAt || cert.issuedDate)}</span>
                  {typeof cert.score === "number" && <span>Score: {cert.score}%</span>}
                  <span>Cert #: {cert.certificateNumber || cert._id.slice(-8)}</span>
                </div>
                <div className="mt-1 text-[11px] text-gray-400">
                  Verification code:{" "}
                  <span className="font-mono text-gray-600">{cert.verificationCode}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toast("Download coming soon")}
                >
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(`/verify/${cert.verificationCode}`, "_blank")}
                >
                  Verify
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderAdmin = () => {
    if (!isAdmin) return null;
    if (loading) {
      return <div className="text-sm text-gray-500">Loading...</div>;
    }
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setShowCreate(true)}>+ Create Course</Button>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-600 uppercase">Title</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-600 uppercase">Category</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-600 uppercase">Level</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-600 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-600 uppercase">Enrollments</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {adminCourses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    No courses yet. Create one to get started.
                  </td>
                </tr>
              )}
              {adminCourses.map((c) => {
                const cat = categoryConfig[c.category] || categoryConfig.other;
                return (
                  <tr key={c._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.title}</div>
                      {c.isMandatory && (
                        <span className="text-[10px] text-red-600 font-semibold">MANDATORY</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${cat.color}`}>
                        {cat.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.level || "\u2014"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700">
                        {c.status || "draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.enrollmentCount ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        {c.status !== "published" && (
                          <Button size="sm" variant="outline" onClick={() => handlePublish(c._id)}>
                            Publish
                          </Button>
                        )}
                        {c.status !== "archived" && (
                          <Button size="sm" variant="ghost" onClick={() => handleArchive(c._id)}>
                            Archive
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Learning & Development</h1>
            <p className="text-sm text-gray-500 mt-1">
              Grow your skills with courses, certifications, and learning paths.
            </p>
          </div>
          <Button onClick={() => setActiveTab("catalog")}>Browse Catalog</Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[11px] uppercase text-gray-500 font-semibold">In Progress</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.inProgress}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[11px] uppercase text-gray-500 font-semibold">Completed</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.completed}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[11px] uppercase text-gray-500 font-semibold">Certificates</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.certificates}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[11px] uppercase text-gray-500 font-semibold">Overdue</div>
            <div className={`text-2xl font-bold mt-1 ${stats.overdue > 0 ? "text-red-600" : "text-gray-900"}`}>
              {stats.overdue}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6 flex gap-6 overflow-x-auto">
          {([
            { key: "my" as TabKey, label: "My Courses" },
            { key: "mandatory" as TabKey, label: "Mandatory" },
            { key: "catalog" as TabKey, label: "Browse Catalog" },
            { key: "certificates" as TabKey, label: "Certificates" },
            ...(isAdmin ? [{ key: "admin" as TabKey, label: "Admin" }] : []),
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "my" && renderMyCourses()}
        {activeTab === "mandatory" && renderMandatory()}
        {activeTab === "catalog" && renderCatalog()}
        {activeTab === "certificates" && renderCertificates()}
        {activeTab === "admin" && renderAdmin()}
      </main>

      {/* Course detail modal */}
      {detailCourse && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setDetailCourse(null)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-48 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center relative">
              {detailCourse.thumbnailUrl || detailCourse.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={detailCourse.thumbnailUrl || detailCourse.coverImageUrl}
                  alt={detailCourse.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-7xl">
                  {(categoryConfig[detailCourse.category] || categoryConfig.other).icon}
                </div>
              )}
              <button
                onClick={() => setDetailCourse(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-gray-700 hover:bg-white"
              >
                {"\u2715"}
              </button>
            </div>
            <div className="p-6 space-y-4">
              <h2 className="text-xl font-bold text-gray-900">{detailCourse.title}</h2>
              <div className="flex gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    (categoryConfig[detailCourse.category] || categoryConfig.other).color
                  }`}
                >
                  {(categoryConfig[detailCourse.category] || categoryConfig.other).label}
                </span>
                {detailCourse.level && (
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      (levelConfig[detailCourse.level] || levelConfig.beginner).color
                    }`}
                  >
                    {(levelConfig[detailCourse.level] || levelConfig.beginner).label}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {detailCourse.description || "No description provided."}
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-[11px] uppercase text-gray-500 font-semibold">Duration</div>
                  <div className="text-gray-900">{formatDuration(detailCourse.duration)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-gray-500 font-semibold">Lessons</div>
                  <div className="text-gray-900">
                    {detailCourse.lessonsCount ?? detailCourse.lessons?.length ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-gray-500 font-semibold">Passing Score</div>
                  <div className="text-gray-900">
                    {detailCourse.passingScore ? `${detailCourse.passingScore}%` : "\u2014"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-gray-500 font-semibold">Enrolled</div>
                  <div className="text-gray-900">{detailCourse.enrollmentCount ?? 0}</div>
                </div>
              </div>
              <div className="flex gap-2 pt-3 border-t border-gray-200">
                <Button
                  className="flex-1"
                  disabled={enrolling === detailCourse._id}
                  onClick={() => handleEnroll(detailCourse._id)}
                >
                  {enrolling === detailCourse._id ? "Enrolling..." : "Enroll Now"}
                </Button>
                <Button variant="outline" onClick={() => setDetailCourse(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create course modal */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => !saving && setShowCreate(false)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Create Course</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Introduction to React"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm"
                  >
                    {Object.entries(categoryConfig).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Level</label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm"
                  >
                    {Object.entries(levelConfig).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm"
                  placeholder="60"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newMandatory}
                  onChange={(e) => setNewMandatory(e.target.checked)}
                />
                <span className="text-sm text-gray-700">Mark as mandatory</span>
              </label>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCreate(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleCreateCourse} disabled={saving}>
                {saving ? "Creating..." : "Create Course"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
