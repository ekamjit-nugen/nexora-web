"use client";

interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

interface LinkPreviewProps {
  preview: LinkPreviewData;
  className?: string;
}

export function LinkPreview({ preview, className = "" }: LinkPreviewProps) {
  if (!preview.title && !preview.description) return null;

  const domain = (() => {
    try {
      return new URL(preview.url).hostname.replace("www.", "");
    } catch {
      return preview.siteName || "";
    }
  })();

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      className={`block mt-1.5 border border-slate-200 rounded-lg overflow-hidden hover:bg-slate-50 transition-colors max-w-[340px] ${className}`}
    >
      {preview.imageUrl && (
        <div className="h-36 bg-slate-100 overflow-hidden">
          <img
            src={preview.imageUrl}
            alt={preview.title || ""}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
          />
        </div>
      )}
      <div className="px-3 py-2">
        {domain && (
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{domain}</p>
        )}
        {preview.title && (
          <p className="text-sm font-medium text-slate-800 line-clamp-2">{preview.title}</p>
        )}
        {preview.description && (
          <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{preview.description}</p>
        )}
      </div>
    </a>
  );
}
