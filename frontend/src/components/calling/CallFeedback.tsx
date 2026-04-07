"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { callApi } from "@/lib/api";
import { toast } from "sonner";

interface CallFeedbackProps {
  callId: string;
  duration: number;
  onClose: () => void;
}

export function CallFeedback({ callId, duration, onClose }: CallFeedbackProps) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const autoDismissRef = useRef<NodeJS.Timeout | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    autoDismissRef.current = setTimeout(() => {
      onClose();
    }, 30000);

    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    setSubmitting(true);
    try {
      const notesContent = [
        `Quality Rating: ${rating}/5`,
        feedback ? `Feedback: ${feedback}` : "",
      ].filter(Boolean).join("\n");

      await callApi.updateNotes(callId, notesContent);
      toast.success("Thank you for your feedback!");
      onClose();
    } catch {
      toast.error("Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  }, [callId, rating, feedback, onClose]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const starLabels = ["Terrible", "Poor", "Okay", "Good", "Excellent"];

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="px-6 pt-6 pb-2 text-center">
          <div className="w-12 h-12 rounded-full bg-[#EBF5FF] flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#0F172A]">How was the call quality?</h3>
          <p className="text-xs text-[#94A3B8] mt-1">Call duration: {formatDuration(duration)}</p>
        </div>

        {/* Star Rating */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                onClick={() => setRating(star)}
                className="p-1 transition-transform hover:scale-110"
              >
                <svg
                  className={`w-8 h-8 transition-colors ${
                    star <= (hoveredStar || rating)
                      ? "text-amber-400 fill-amber-400"
                      : "text-[#CBD5E1] fill-none"
                  }`}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </button>
            ))}
          </div>
          {(hoveredStar > 0 || rating > 0) && (
            <p className="text-center text-xs text-[#64748B] mt-1 font-medium">
              {starLabels[(hoveredStar || rating) - 1]}
            </p>
          )}
        </div>

        {/* Optional feedback */}
        <div className="px-6 pb-4">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Any additional feedback? (optional)"
            rows={3}
            className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2E86C1] focus:ring-1 focus:ring-[#2E86C1]/20 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-[#64748B] bg-[#F1F5F9] rounded-lg hover:bg-[#E2E8F0] transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#2E86C1] rounded-lg hover:bg-[#2471A3] transition-colors disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
