"use client";

interface UnreadBannerProps {
  unreadCount: number;
  onJumpToUnread: () => void;
  showScrollToBottom: boolean;
  onScrollToBottom: () => void;
}

/**
 * Banner shown above the chat when there are unread messages below the scroll position.
 * Also shows a "scroll to bottom" FAB when scrolled up.
 */
export function UnreadBanner({ unreadCount, onJumpToUnread, showScrollToBottom, onScrollToBottom }: UnreadBannerProps) {
  return (
    <>
      {/* Unread banner at top */}
      {unreadCount > 0 && (
        <button
          onClick={onJumpToUnread}
          className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-full shadow-lg hover:bg-blue-600 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          {unreadCount} new {unreadCount === 1 ? "message" : "messages"}
        </button>
      )}

      {/* Scroll to bottom FAB */}
      {showScrollToBottom && (
        <button
          onClick={onScrollToBottom}
          className="absolute bottom-20 right-4 z-20 w-9 h-9 bg-white border border-slate-200 rounded-full shadow-lg flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
          title="Scroll to bottom"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      )}
    </>
  );
}
