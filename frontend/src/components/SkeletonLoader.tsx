"use client";

interface SkeletonLoaderProps {
  variant: "text" | "message" | "conversation" | "rect";
  count?: number;
  className?: string;
  width?: string | number;
  height?: string | number;
}

function SkeletonItem({ variant, className, width, height }: Omit<SkeletonLoaderProps, "count">) {
  const base = "animate-pulse rounded" + " " + "bg-[#E2E8F0]";

  if (variant === "text") {
    return <div className={`${base} h-4 w-full rounded-md ${className || ""}`} />;
  }

  if (variant === "message") {
    return (
      <div className={`flex items-start gap-2.5 px-5 py-2 ${className || ""}`}>
        <div className={`${base} w-8 h-8 rounded-full shrink-0`} />
        <div className="flex-1 space-y-2">
          <div className={`${base} h-3.5 w-24 rounded-md`} />
          <div className={`${base} h-3 w-full rounded-md`} />
          <div className={`${base} h-3 w-3/4 rounded-md`} />
        </div>
      </div>
    );
  }

  if (variant === "conversation") {
    return (
      <div className={`flex items-center gap-2.5 px-3 py-3 ${className || ""}`}>
        <div className={`${base} w-9 h-9 rounded-full shrink-0`} />
        <div className="flex-1 space-y-1.5">
          <div className={`${base} h-3.5 w-28 rounded-md`} />
          <div className={`${base} h-3 w-40 rounded-md`} />
        </div>
        <div className={`${base} h-3 w-8 rounded-md shrink-0`} />
      </div>
    );
  }

  // rect
  return (
    <div
      className={`${base} rounded-lg ${className || ""}`}
      style={{ width: width || "100%", height: height || 40 }}
    />
  );
}

export function SkeletonLoader({ variant, count = 1, className, width, height }: SkeletonLoaderProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonItem key={i} variant={variant} className={className} width={width} height={height} />
      ))}
    </>
  );
}
