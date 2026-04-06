"use client";

interface PresenceIndicatorProps {
  status: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  online: "bg-green-500",
  away: "bg-yellow-500",
  busy: "bg-red-500",
  dnd: "bg-red-600",
  in_meeting: "bg-red-500",
  in_call: "bg-red-500",
  presenting: "bg-red-500",
  offline: "bg-slate-400",
  ooo: "bg-slate-400",
};

const SIZE_CLASSES: Record<string, string> = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3 h-3",
};

export function PresenceIndicator({ status, size = "md", className = "" }: PresenceIndicatorProps) {
  const colorClass = STATUS_COLORS[status] || STATUS_COLORS.offline;
  const sizeClass = SIZE_CLASSES[size];
  const isDnd = status === "dnd";

  return (
    <span
      className={`inline-block rounded-full border-2 border-white ${colorClass} ${sizeClass} ${className}`}
      title={status.replace("_", " ")}
    >
      {isDnd && (
        <span className="block w-full h-0.5 bg-white rounded-full mt-[3px]" />
      )}
    </span>
  );
}
