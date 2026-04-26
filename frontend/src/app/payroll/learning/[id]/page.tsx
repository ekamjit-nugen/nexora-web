"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface QuizQuestion {
  _id?: string;
  questionId?: string;
  question: string;
  type?: "single" | "multiple" | "text";
  options?: string[];
  correctAnswer?: unknown;
  points?: number;
}

interface Lesson {
  _id: string;
  lessonId?: string;
  title: string;
  type: "video" | "article" | "quiz" | string;
  content?: string;
  videoUrl?: string;
  duration?: number;
  questions?: QuizQuestion[];
  order?: number;
  prerequisiteLessonId?: string;
}

interface Course {
  _id: string;
  title: string;
  description?: string;
  category: string;
  level?: string;
  lessons?: Lesson[];
  passingScore?: number;
  instructor?: string;
  durationMinutes?: number;
}

interface LessonProgress {
  lessonId: string;
  status: string;
  completedAt?: string;
  score?: number;
  timeSpent?: number;
}

interface Enrollment {
  _id: string;
  courseId: string | Course;
  course?: Course;
  status: string;
  progressPercentage?: number;
  progress?: number;
  lessonProgress?: LessonProgress[];
  startedAt?: string;
  completedAt?: string;
  dueDate?: string;
  isMandatory?: boolean;
  certificateId?: string;
  finalScore?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const getLessonId = (l: Lesson) => l._id || l.lessonId || "";
const getQuestionId = (q: QuizQuestion, i: number) =>
  q._id || q.questionId || `q_${i}`;

const formatDuration = (minutes?: number) => {
  if (!minutes || minutes <= 0) return "";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const getLessonIcon = (type: string) => {
  if (type === "video") return "\u25B6";
  if (type === "quiz") return "?";
  return "\u2630";
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CoursePlayerPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const enrollmentId = (params?.id as string) || "";

  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLessonId, setActiveLessonId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, unknown>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  // Rate modal
  const [showRate, setShowRate] = useState(false);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // -----------------------------------------------------------------------
  // Fetch enrollment
  // -----------------------------------------------------------------------
  const fetchEnrollment = useCallback(async () => {
    if (!enrollmentId) return;
    setLoading(true);
    try {
      const res = await payrollApi.getEnrollment(enrollmentId);
      const data = res.data as Enrollment;
      setEnrollment(data);
      const c =
        data.course ||
        (typeof data.courseId === "object" ? (data.courseId as Course) : null);
      if (c) setCourse(c);
      else if (typeof data.courseId === "string") {
        const cRes = await payrollApi.getCourse(data.courseId);
        setCourse(cRes.data as Course);
      }

      // Mark as started if just enrolled
      if (data.status === "enrolled" || data.status === "not_started") {
        try {
          await payrollApi.markCourseStarted(enrollmentId);
        } catch {}
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load course");
      router.push("/payroll/learning");
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, router]);

  useEffect(() => {
    if (user) fetchEnrollment();
  }, [user, fetchEnrollment]);

  // -----------------------------------------------------------------------
  // Active lesson + progress helpers
  // -----------------------------------------------------------------------
  const lessons = useMemo(() => {
    const list = course?.lessons || [];
    return [...list].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [course]);

  useEffect(() => {
    if (lessons.length && !activeLessonId) {
      // Pick first incomplete, else first lesson
      const progress = enrollment?.lessonProgress || [];
      const firstIncomplete = lessons.find((l) => {
        const p = progress.find((pp) => pp.lessonId === getLessonId(l));
        return !p || p.status !== "completed";
      });
      setActiveLessonId(getLessonId(firstIncomplete || lessons[0]));
    }
  }, [lessons, activeLessonId, enrollment]);

  // Reset quiz state when lesson changes
  useEffect(() => {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
  }, [activeLessonId]);

  const activeLesson = useMemo(
    () => lessons.find((l) => getLessonId(l) === activeLessonId) || null,
    [lessons, activeLessonId],
  );

  const lessonProgressMap = useMemo(() => {
    const map: Record<string, LessonProgress> = {};
    (enrollment?.lessonProgress || []).forEach((p) => {
      map[p.lessonId] = p;
    });
    return map;
  }, [enrollment]);

  const isLessonCompleted = (lessonId: string) =>
    lessonProgressMap[lessonId]?.status === "completed";

  const isLessonLocked = (lesson: Lesson) => {
    if (!lesson.prerequisiteLessonId) return false;
    return !isLessonCompleted(lesson.prerequisiteLessonId);
  };

  const activeIndex = lessons.findIndex((l) => getLessonId(l) === activeLessonId);
  const prevLesson = activeIndex > 0 ? lessons[activeIndex - 1] : null;
  const nextLesson = activeIndex >= 0 && activeIndex < lessons.length - 1 ? lessons[activeIndex + 1] : null;

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------
  const handleMarkComplete = async () => {
    if (!activeLesson || !enrollment) return;
    setSaving(true);
    try {
      await payrollApi.updateLessonProgress(enrollment._id, {
        lessonId: getLessonId(activeLesson),
        status: "completed",
      });
      toast.success("Lesson marked as complete");
      await fetchEnrollment();
      if (nextLesson) {
        setActiveLessonId(getLessonId(nextLesson));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to mark complete");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!activeLesson || !enrollment || !activeLesson.questions) return;
    setSaving(true);
    try {
      const answers = activeLesson.questions.map((q, i) => ({
        questionId: getQuestionId(q, i),
        answer: quizAnswers[getQuestionId(q, i)] ?? null,
      }));
      const res = await payrollApi.submitQuiz(enrollment._id, { answers });
      const data = res.data as any;
      const score = typeof data?.score === "number" ? data.score : null;
      setQuizScore(score);
      setQuizSubmitted(true);
      toast.success(score !== null ? `Quiz submitted. Score: ${score}%` : "Quiz submitted");
      await fetchEnrollment();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit quiz");
    } finally {
      setSaving(false);
    }
  };

  const handleDropCourse = async () => {
    if (!enrollment) return;
    if (!confirm("Drop this course? Your progress will be lost.")) return;
    try {
      await payrollApi.dropCourse(enrollment._id);
      toast.success("Course dropped");
      router.push("/payroll/learning");
    } catch (err: any) {
      toast.error(err.message || "Failed to drop course");
    }
  };

  const handleRate = async () => {
    if (!course) return;
    setSaving(true);
    try {
      await payrollApi.rateCourse(course._id, { rating, feedback });
      toast.success("Thanks for rating!");
      setShowRate(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit rating");
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex bg-[#F8FAFC]">
        <Sidebar user={user} onLogout={logout} />
        <main className="flex-1 min-w-0 md:ml-[260px] p-6">
          <div className="text-sm text-gray-500">Loading course...</div>
        </main>
      </div>
    );
  }

  if (!enrollment || !course) {
    return (
      <div className="min-h-screen flex bg-[#F8FAFC]">
        <Sidebar user={user} onLogout={logout} />
        <main className="flex-1 min-w-0 md:ml-[260px] p-6">
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-sm text-gray-600 mb-4">Course not found.</p>
            <Button onClick={() => router.push("/payroll/learning")}>
              Back to Learning
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const completedCount = lessons.filter((l) => isLessonCompleted(getLessonId(l))).length;
  const totalCount = lessons.length;
  const overallProgress =
    enrollment.progressPercentage ??
    enrollment.progress ??
    (totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0);

  const isCourseCompleted = enrollment.status === "completed";

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-w-0 md:ml-[260px] flex">
        {/* Lesson sidebar */}
        <aside className="w-[320px] bg-white border-r border-gray-200 flex flex-col sticky top-0 h-screen">
          <div className="p-5 border-b border-gray-200">
            <button
              onClick={() => router.push("/payroll/learning")}
              className="text-xs text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
            >
              {"\u2190"} Back to Learning
            </button>
            <h2 className="text-base font-bold text-gray-900 line-clamp-2">{course.title}</h2>
            {course.instructor && (
              <p className="text-xs text-gray-500 mt-1">By {course.instructor}</p>
            )}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-gray-600 mb-1">
                <span>
                  {completedCount} / {totalCount} completed
                </span>
                <span className="font-semibold">{Math.round(overallProgress)}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                  style={{ width: `${Math.min(100, Math.max(0, overallProgress))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {lessons.length === 0 && (
              <div className="p-4 text-xs text-gray-500">No lessons in this course yet.</div>
            )}
            {lessons.map((lesson, idx) => {
              const id = getLessonId(lesson);
              const completed = isLessonCompleted(id);
              const locked = isLessonLocked(lesson);
              const isActive = id === activeLessonId;
              return (
                <button
                  key={id}
                  disabled={locked}
                  onClick={() => !locked && setActiveLessonId(id)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-gray-100 transition-colors ${
                    isActive
                      ? "bg-blue-50 border-l-4 border-l-blue-600"
                      : "hover:bg-gray-50 border-l-4 border-l-transparent"
                  } ${locked ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                      completed
                        ? "bg-green-500 text-white"
                        : isActive
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {completed ? "\u2713" : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium line-clamp-2 ${isActive ? "text-blue-700" : "text-gray-900"}`}>
                      {lesson.title}
                    </div>
                    <div className="text-[10px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                      <span>{getLessonIcon(lesson.type)}</span>
                      <span className="capitalize">{lesson.type}</span>
                      {lesson.duration ? <span>{"\u00B7 "}{formatDuration(lesson.duration)}</span> : null}
                      {locked && <span>{"\u00B7 Locked"}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-4 border-t border-gray-200 space-y-2">
            {isCourseCompleted && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setShowRate(true)}
              >
                Rate this course
              </Button>
            )}
            {!isCourseCompleted && (
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-red-600 hover:text-red-700"
                onClick={handleDropCourse}
              >
                Drop Course
              </Button>
            )}
          </div>
        </aside>

        {/* Lesson content */}
        <div className="flex-1 overflow-y-auto p-8">
          {!activeLesson ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <p className="text-sm text-gray-500">Select a lesson from the sidebar.</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Lesson header */}
              <div>
                <div className="text-xs text-gray-500 uppercase font-semibold">
                  Lesson {activeIndex + 1} of {totalCount}
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mt-1">{activeLesson.title}</h1>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                  <span className="capitalize">{activeLesson.type}</span>
                  {activeLesson.duration && <span>{formatDuration(activeLesson.duration)}</span>}
                  {isLessonCompleted(getLessonId(activeLesson)) && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">
                      Completed
                    </span>
                  )}
                </div>
              </div>

              {/* Video lesson */}
              {activeLesson.type === "video" && (
                <div className="bg-black rounded-xl overflow-hidden aspect-video">
                  {activeLesson.videoUrl ? (
                    <iframe
                      src={activeLesson.videoUrl}
                      className="w-full h-full"
                      allowFullScreen
                      title={activeLesson.title}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-sm">
                      Video unavailable
                    </div>
                  )}
                </div>
              )}

              {/* Article lesson */}
              {activeLesson.type === "article" && (
                <div className="bg-white border border-gray-200 rounded-xl p-8">
                  <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                    {activeLesson.content || "No content available for this lesson."}
                  </div>
                </div>
              )}

              {/* Quiz lesson */}
              {activeLesson.type === "quiz" && (
                <div className="bg-white border border-gray-200 rounded-xl p-8">
                  {(!activeLesson.questions || activeLesson.questions.length === 0) ? (
                    <p className="text-sm text-gray-500">This quiz has no questions.</p>
                  ) : (
                    <div className="space-y-6">
                      {activeLesson.questions.map((q, i) => {
                        const qid = getQuestionId(q, i);
                        return (
                          <div key={qid}>
                            <div className="text-sm font-semibold text-gray-900 mb-3">
                              {i + 1}. {q.question}
                            </div>
                            {(q.type === "text") ? (
                              <textarea
                                disabled={quizSubmitted}
                                value={(quizAnswers[qid] as string) || ""}
                                onChange={(e) =>
                                  setQuizAnswers({ ...quizAnswers, [qid]: e.target.value })
                                }
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                              />
                            ) : q.type === "multiple" ? (
                              <div className="space-y-2">
                                {(q.options || []).map((opt, oi) => {
                                  const selected = Array.isArray(quizAnswers[qid])
                                    ? (quizAnswers[qid] as string[]).includes(opt)
                                    : false;
                                  return (
                                    <label
                                      key={oi}
                                      className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer ${
                                        selected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                                      } ${quizSubmitted ? "pointer-events-none opacity-75" : ""}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={(e) => {
                                          const current = Array.isArray(quizAnswers[qid])
                                            ? [...(quizAnswers[qid] as string[])]
                                            : [];
                                          if (e.target.checked) current.push(opt);
                                          else {
                                            const idx = current.indexOf(opt);
                                            if (idx >= 0) current.splice(idx, 1);
                                          }
                                          setQuizAnswers({ ...quizAnswers, [qid]: current });
                                        }}
                                        disabled={quizSubmitted}
                                      />
                                      <span className="text-sm text-gray-800">{opt}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {(q.options || []).map((opt, oi) => {
                                  const selected = quizAnswers[qid] === opt;
                                  return (
                                    <label
                                      key={oi}
                                      className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer ${
                                        selected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                                      } ${quizSubmitted ? "pointer-events-none opacity-75" : ""}`}
                                    >
                                      <input
                                        type="radio"
                                        name={qid}
                                        checked={selected}
                                        onChange={() =>
                                          setQuizAnswers({ ...quizAnswers, [qid]: opt })
                                        }
                                        disabled={quizSubmitted}
                                      />
                                      <span className="text-sm text-gray-800">{opt}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {!quizSubmitted && (
                        <div className="pt-4 border-t border-gray-200">
                          <Button onClick={handleSubmitQuiz} disabled={saving}>
                            {saving ? "Submitting..." : "Submit Quiz"}
                          </Button>
                        </div>
                      )}

                      {quizSubmitted && quizScore !== null && (
                        <div
                          className={`p-4 rounded-lg border ${
                            course.passingScore && quizScore >= course.passingScore
                              ? "bg-green-50 border-green-200 text-green-800"
                              : "bg-amber-50 border-amber-200 text-amber-800"
                          }`}
                        >
                          <div className="text-sm font-semibold">Your Score: {quizScore}%</div>
                          {course.passingScore && (
                            <div className="text-xs mt-1">
                              Passing score: {course.passingScore}%.{" "}
                              {quizScore >= course.passingScore
                                ? "You passed!"
                                : "You can try again after reviewing the material."}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Action row */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  disabled={!prevLesson}
                  onClick={() => prevLesson && setActiveLessonId(getLessonId(prevLesson))}
                >
                  {"\u2190"} Previous
                </Button>
                <div className="flex gap-2">
                  {activeLesson.type !== "quiz" && !isLessonCompleted(getLessonId(activeLesson)) && (
                    <Button onClick={handleMarkComplete} disabled={saving}>
                      {saving ? "Saving..." : "Mark as Complete"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled={!nextLesson}
                    onClick={() => nextLesson && setActiveLessonId(getLessonId(nextLesson))}
                  >
                    Next {"\u2192"}
                  </Button>
                </div>
              </div>

              {/* Post-completion banner */}
              {isCourseCompleted && (
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl">{"\uD83C\uDF89"}</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold">Course Completed!</h3>
                      <p className="text-sm opacity-90">
                        Congratulations on finishing {course.title}.
                        {enrollment.finalScore !== undefined && ` Final score: ${enrollment.finalScore}%.`}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="bg-white text-green-700 hover:bg-gray-100"
                      onClick={() => router.push("/payroll/learning")}
                    >
                      View Certificate
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Rate modal */}
      {showRate && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => !saving && setShowRate(false)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-4">Rate this course</h2>
            <div className="flex items-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`text-3xl ${n <= rating ? "text-amber-400" : "text-gray-300"}`}
                >
                  {"\u2605"}
                </button>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Feedback (optional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Share your thoughts about this course..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRate(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleRate} disabled={saving}>
                {saving ? "Submitting..." : "Submit Rating"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
