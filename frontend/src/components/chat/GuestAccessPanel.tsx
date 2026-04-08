"use client";

import { useState, useCallback } from "react";
import { chatApi, type Conversation, type Employee } from "@/lib/api";
import { toast } from "sonner";

interface GuestAccessPanelProps {
  conversation: Conversation;
  employeeMap: Record<string, Employee>;
  currentUserId: string;
  onClose: () => void;
  onConversationUpdate: (conversation: Conversation) => void;
}

export function GuestAccessPanel({
  conversation,
  employeeMap,
  currentUserId,
  onClose,
  onConversationUpdate,
}: GuestAccessPanelProps) {
  const [toggling, setToggling] = useState(false);
  const [removingGuestId, setRemovingGuestId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const isEnabled = conversation.guestAccess?.enabled ?? false;
  const inviteLink = conversation.guestAccess?.inviteLink || "";
  const linkExpiresAt = conversation.guestAccess?.linkExpiresAt || "";
  const guestIds = conversation.guestAccess?.guestIds || [];

  // Check if current user is admin/owner in this channel
  const currentParticipant = conversation.participants.find(
    (p) => p.userId === currentUserId
  );
  const isAdminOrOwner =
    currentParticipant?.role === "admin" || currentParticipant?.role === "owner";

  if (conversation.type !== "channel" || !isAdminOrOwner) {
    return null;
  }

  const handleToggle = useCallback(async () => {
    if (toggling) return;
    setToggling(true);
    try {
      if (isEnabled) {
        await chatApi.disableGuestAccess(conversation._id);
        toast.success("Guest access disabled");
        onConversationUpdate({
          ...conversation,
          guestAccess: {
            enabled: false,
            guestIds: conversation.guestAccess?.guestIds || [],
            inviteLink: undefined,
            linkExpiresAt: undefined,
          },
        });
      } else {
        const res = await chatApi.enableGuestAccess(conversation._id);
        const data = res.data;
        toast.success("Guest access enabled");
        onConversationUpdate({
          ...conversation,
          guestAccess: {
            enabled: true,
            guestIds: conversation.guestAccess?.guestIds || [],
            inviteLink: data?.inviteLink || data?.guestAccess?.inviteLink || "",
            linkExpiresAt: data?.linkExpiresAt || data?.guestAccess?.linkExpiresAt || "",
          },
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle guest access");
    } finally {
      setToggling(false);
    }
  }, [toggling, isEnabled, conversation, onConversationUpdate]);

  const handleCopyLink = useCallback(() => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      toast.success("Invite link copied to clipboard");
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  }, [inviteLink]);

  const handleRemoveGuest = useCallback(async (guestId: string) => {
    setRemovingGuestId(guestId);
    try {
      await chatApi.removeGuest(conversation._id, guestId);
      toast.success("Guest removed");
      onConversationUpdate({
        ...conversation,
        guestAccess: {
          ...conversation.guestAccess!,
          guestIds: (conversation.guestAccess?.guestIds || []).filter(
            (id) => id !== guestId
          ),
        },
      });
      setConfirmRemoveId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove guest");
    } finally {
      setRemovingGuestId(null);
    }
  }, [conversation, onConversationUpdate]);

  const formatExpiry = (dateStr: string): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "Expired";
    if (diffDays === 0) return "Expires today";
    if (diffDays === 1) return "Expires tomorrow";
    return `Expires in ${diffDays} days (${date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })})`;
  };

  const getGuestName = (guestId: string): string => {
    const emp = employeeMap[guestId];
    if (emp) return `${emp.firstName} ${emp.lastName}`;
    return `Guest (${guestId.slice(-6)})`;
  };

  const getGuestEmail = (guestId: string): string => {
    const emp = employeeMap[guestId];
    return emp?.email || "";
  };

  const getGuestInitials = (guestId: string): string => {
    const emp = employeeMap[guestId];
    if (emp) {
      return `${(emp.firstName || "")[0] || ""}${(emp.lastName || "")[0] || ""}`.toUpperCase();
    }
    return "G";
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 w-full md:w-[380px] md:min-w-[340px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-slate-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
            />
          </svg>
          <h3 className="text-sm font-semibold text-slate-800">Guest Access</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Toggle section */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">
              Enable guest access
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Allow external users to join via invite link
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 ${
              isEnabled ? "bg-[#2E86C1]" : "bg-slate-300"
            } ${toggling ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
            role="switch"
            aria-checked={isEnabled}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                isEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
            {toggling && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Invite Link section (when enabled) */}
      {isEnabled && (
        <div className="px-4 py-4 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Invite Link
          </p>
          {inviteLink ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 focus:outline-none truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="shrink-0 px-3 py-2 text-xs font-medium bg-[#2E86C1] text-white rounded-lg hover:bg-[#2576AB] transition-colors"
                >
                  Copy Link
                </button>
              </div>
              {linkExpiresAt && (
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {formatExpiry(linkExpiresAt)}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-400">
              Generating invite link...
            </p>
          )}
        </div>
      )}

      {/* Guest List section */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Guests ({guestIds.length})
        </p>
        {guestIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <svg
                className="w-6 h-6 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3 3 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                />
              </svg>
            </div>
            <p className="text-sm text-slate-500">No guests yet</p>
            <p className="text-xs text-slate-400 mt-1">
              {isEnabled
                ? "Share the invite link to add guests"
                : "Enable guest access to invite external users"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {guestIds.map((guestId) => (
              <div
                key={guestId}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {getGuestInitials(guestId)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {getGuestName(guestId)}
                  </p>
                  {getGuestEmail(guestId) && (
                    <p className="text-xs text-slate-400 truncate">
                      {getGuestEmail(guestId)}
                    </p>
                  )}
                </div>
                {confirmRemoveId === guestId ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleRemoveGuest(guestId)}
                      disabled={removingGuestId === guestId}
                      className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {removingGuestId === guestId ? (
                        <span className="inline-block w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        "Remove"
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmRemoveId(null)}
                      className="px-2 py-1 text-xs font-medium text-slate-500 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRemoveId(guestId)}
                    className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove guest"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
