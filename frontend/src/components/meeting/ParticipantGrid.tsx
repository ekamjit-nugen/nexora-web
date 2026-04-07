"use client";

interface Participant {
  userId: string;
  displayName: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  handRaised?: boolean;
  isScreenSharing?: boolean;
}

interface ParticipantGridProps {
  participants: Participant[];
  localStream?: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  currentUserId: string;
  speakingUserId?: string;
  pinnedUserId?: string;
  onPinParticipant?: (userId: string | null) => void;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2);
}

function getGridClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-2 grid-rows-2";
  if (count <= 6) return "grid-cols-2 md:grid-cols-3 grid-rows-2";
  if (count <= 9) return "grid-cols-2 md:grid-cols-3 grid-rows-3";
  if (count <= 16) return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 grid-rows-4";
  return "grid-cols-2 md:grid-cols-3 lg:grid-cols-5";
}

export function ParticipantGrid({
  participants,
  localStream,
  remoteStreams,
  currentUserId,
  speakingUserId,
  pinnedUserId,
  onPinParticipant,
}: ParticipantGridProps) {
  const gridClass = getGridClass(participants.length);

  return (
    <div className={`grid ${gridClass} gap-2 h-full w-full p-2`}>
      {participants.map((p) => {
        const isMe = p.userId === currentUserId;
        const stream = isMe ? localStream : remoteStreams.get(p.userId);
        const isSpeaking = speakingUserId === p.userId;
        const isPinned = pinnedUserId === p.userId;

        return (
          <div
            key={p.userId}
            className={`relative bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer ${
              isSpeaking ? "ring-2 ring-green-500 col-span-full sm:col-span-1" : isPinned ? "ring-2 ring-blue-500 col-span-full sm:col-span-1" : ""
            }`}
            onClick={() => onPinParticipant?.(isPinned ? null : p.userId)}
          >
            {stream && p.videoEnabled ? (
              <video
                ref={(el) => {
                  if (el && stream) {
                    el.srcObject = stream;
                    el.muted = isMe;
                  }
                }}
                autoPlay
                playsInline
                muted={isMe}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-600 flex items-center justify-center text-white text-xl font-bold">
                {getInitials(p.displayName)}
              </div>
            )}

            {/* Overlay info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-white text-xs font-medium truncate">
                    {p.displayName}{isMe ? " (You)" : ""}
                  </span>
                  {p.handRaised && <span className="text-sm">✋</span>}
                </div>
                <div className="flex items-center gap-1">
                  {!p.audioEnabled && (
                    <span className="text-red-400" title="Muted">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.36 2.18"/></svg>
                    </span>
                  )}
                  {p.isScreenSharing && (
                    <span className="text-blue-400" title="Screen sharing">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
