"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import type { Conversation, ChatMessage, Employee } from "@/lib/api";
import { CallControls, VideoCallWindow, PreCallPreview, CallFeedback } from "@/components/calling";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";

export interface CallOverlayProps {
  // Pre-call
  showPreCallPreview: boolean;
  preCallRecipientName: string;
  onPreCallConfirm: (settings: {
    audioEnabled: boolean;
    videoEnabled: boolean;
    selectedAudioDeviceId?: string;
    selectedVideoDeviceId?: string;
  }) => void;
  onPreCallCancel: () => void;

  // Call window
  showCallWindow: boolean;
  callConversation: Conversation | null;
  user: { _id: string; firstName?: string; lastName?: string };
  employeeMap: Record<string, Employee>;
  callType: "audio" | "video" | null;
  callDuration: number;
  callDisconnected: boolean;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isRecording: boolean;
  isScreenSharing: boolean;
  isFullscreen: boolean;
  isOnHold: boolean;
  isViewerAnnotating: boolean;
  annotationColor: string;
  annotationBrushSize: number;
  screenShareStream: MediaStream | null;
  floatingEmojis: Array<{ id: string; emoji: string; x: number; startTime: number }>;
  remoteHasVideo: boolean;

  // WebRTC
  webrtcLocalStream: MediaStream | null;
  webrtcRemoteStream: MediaStream | null;
  webrtcError: string | null;

  // Signaling
  signalingCallStatus: string | undefined;

  // Call chat (ephemeral — not persisted to main conversation)
  showCallChat: boolean;
  callChatMsg: string;
  callChatMessages: Array<{ id: string; senderId: string; content: string; createdAt: string }>;
  callChatUnread: number;
  callStartTime: string | null;
  onCallChatMsgChange: (val: string) => void;
  onCallChatToggle: () => void;
  onCallChatSend: (msg: string) => void;

  // Handlers
  onEndCall: () => void;
  onToggleAudio: (enabled: boolean) => void;
  onToggleVideo: (enabled: boolean) => void;
  onToggleRecording: () => void;
  onToggleScreenShare: () => void;
  onToggleFullscreen: () => void;
  onToggleHold: () => void;
  onAddParticipant: () => void;
  onEmojiReaction: (emoji: string) => void;
  onAnnotationToggle: () => void;
  onAnnotationColorChange: (c: string) => void;
  onAnnotationBrushSizeChange: (s: number) => void;
  onAnnotationClear: () => void;
  onAnnotationStroke: (stroke: { fromX: number; fromY: number; toX: number; toY: number; color: string; brushSize: number }) => void;
  remotePointers: Array<{ userId: string; name: string; x: number; y: number; color: string }>;
  onPointerMove: (x: number, y: number) => void;
  onPointerLeave: () => void;

  // Add participant modal
  showAddParticipantModal: boolean;
  onCloseAddParticipant: () => void;
  filteredEmployees: Employee[];
  employeeSearch: string;
  onEmployeeSearchChange: (val: string) => void;
  onInviteToCall: (userId: string) => void;

  // Call feedback
  showCallFeedback: boolean;
  feedbackCallId: string | null;
  feedbackCallDuration: number;
  onCloseCallFeedback: () => void;

  // Refs
  callWindowRef: React.RefObject<HTMLDivElement>;
  remoteAudioRef: React.RefObject<HTMLAudioElement>;
}

function CallOverlayInner(props: CallOverlayProps) {
  const {
    showPreCallPreview, preCallRecipientName, onPreCallConfirm, onPreCallCancel,
    showCallWindow, callConversation, user, employeeMap,
    callType, callDuration, callDisconnected,
    isAudioEnabled, isVideoEnabled, isRecording, isScreenSharing,
    isFullscreen, isOnHold, isViewerAnnotating,
    annotationColor, annotationBrushSize,
    screenShareStream, floatingEmojis, remoteHasVideo,
    webrtcLocalStream, webrtcRemoteStream, webrtcError,
    signalingCallStatus,
    showCallChat, callChatMsg, callChatMessages, callChatUnread, callStartTime,
    onCallChatMsgChange, onCallChatToggle, onCallChatSend,
    onEndCall, onToggleAudio, onToggleVideo,
    onToggleRecording, onToggleScreenShare, onToggleFullscreen,
    onToggleHold, onAddParticipant, onEmojiReaction,
    onAnnotationToggle, onAnnotationColorChange, onAnnotationBrushSizeChange, onAnnotationClear, onAnnotationStroke,
    remotePointers, onPointerMove, onPointerLeave,
    showAddParticipantModal, onCloseAddParticipant,
    filteredEmployees, employeeSearch, onEmployeeSearchChange, onInviteToCall,
    showCallFeedback, feedbackCallId, feedbackCallDuration, onCloseCallFeedback,
    callWindowRef, remoteAudioRef,
  } = props;

  const getEmployeeName = (userId: string): string => {
    const emp = employeeMap[userId];
    if (emp) return `${emp.firstName} ${emp.lastName}`;
    return userId.slice(-6);
  };

  const getCallStatusLabel = () => {
    if (signalingCallStatus === "connected") return "Live";
    if (signalingCallStatus === "initiated") return "Calling";
    if (signalingCallStatus === "ringing") return "Ringing";
    return "Connecting";
  };

  const otherUserId = callConversation?.participants.find((p) => p.userId !== user._id)?.userId || "";

  const [isMinimized, setIsMinimized] = useState(false);

  // ── Drag support for minimized PiP ──
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const pipRef = useRef<HTMLDivElement>(null);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    // Only drag from the header area, not buttons
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const el = pipRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      let newX = dragRef.current.origX + dx;
      let newY = dragRef.current.origY + dy;
      // Clamp to viewport
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      newX = Math.max(0, Math.min(window.innerWidth - w, newX));
      newY = Math.max(0, Math.min(window.innerHeight - h, newY));
      setDragPos({ x: newX, y: newY });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  // Reset drag position when switching between minimized/expanded or call ends
  useEffect(() => {
    setDragPos(null);
  }, [isMinimized, showCallWindow]);

  // Auto-minimize when screen sharing starts
  useEffect(() => {
    if (isScreenSharing && !isFullscreen) {
      setIsMinimized(true);
    }
  }, [isScreenSharing, isFullscreen]);

  // Reset minimize when call window hides
  useEffect(() => {
    if (!showCallWindow) setIsMinimized(false);
  }, [showCallWindow]);

  const durationStr = `${Math.floor(callDuration / 60)}:${String(callDuration % 60).padStart(2, "0")}`;

  return (
    <>
      {/* Pre-Call Preview Modal */}
      {showPreCallPreview && (
        <PreCallPreview
          recipientName={preCallRecipientName}
          callType="audio"
          onStartCall={onPreCallConfirm}
          onCancel={onPreCallCancel}
        />
      )}

      {/* Active Call Window */}
      {showCallWindow && isMinimized && !isFullscreen && (
        /* ── Minimized PiP (draggable) ── */
        <div
          ref={pipRef}
          className="fixed z-[200] w-[280px] bg-[#0F172A] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] border border-[#1F2A44] overflow-hidden cursor-grab active:cursor-grabbing select-none"
          style={dragPos ? { left: dragPos.x, top: dragPos.y } : { bottom: 16, left: 16 }}
          onMouseDown={onDragStart}
        >
          <audio ref={remoteAudioRef} autoPlay playsInline />
          {/* Mini video / avatar */}
          <div className="h-[120px] bg-gradient-to-br from-[#0B1220] to-[#0F172A] relative flex items-center justify-center">
            {(isVideoEnabled || remoteHasVideo) && webrtcRemoteStream ? (
              <VideoCallWindow
                localStream={webrtcLocalStream}
                remoteStream={webrtcRemoteStream}
                localUserName={user ? `${user.firstName} ${user.lastName}` : "You"}
                remoteUserName={getEmployeeName(otherUserId)}
                isAudioMuted={!isAudioEnabled}
                remoteHasVideo={remoteHasVideo}
                localHasVideo={isVideoEnabled}
                floatingEmojis={[]}
              />
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] flex items-center justify-center text-white text-lg font-bold">
                  {getInitials(employeeMap[otherUserId]?.firstName || "", employeeMap[otherUserId]?.lastName || "")}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{getEmployeeName(otherUserId)}</p>
                  <p className="text-[10px] text-[#94A3B8]">{durationStr}</p>
                </div>
              </div>
            )}
            {/* Expand button */}
            <button
              onClick={() => setIsMinimized(false)}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
              title="Expand"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            </button>
          </div>
          {/* Mini controls */}
          <div className="flex items-center justify-center gap-2 px-3 py-2 bg-[#0B1220] border-t border-[#1F2A44]">
            <button
              onClick={() => onToggleAudio(!isAudioEnabled)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isAudioEnabled ? "bg-white/10 text-white" : "bg-red-500/20 text-red-400"}`}
              title={isAudioEnabled ? "Mute" : "Unmute"}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </button>
            <button
              onClick={() => onToggleVideo(!isVideoEnabled)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isVideoEnabled ? "bg-white/10 text-white" : "bg-red-500/20 text-red-400"}`}
              title={isVideoEnabled ? "Camera off" : "Camera on"}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </button>
            <button
              onClick={onEndCall}
              className="w-10 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
              title="End call"
            >
              <svg className="w-4 h-4 rotate-[135deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>
            <button
              onClick={() => setIsMinimized(false)}
              className="w-8 h-8 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-colors"
              title="Expand"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {showCallWindow && (!isMinimized || isFullscreen) && (
        <div className={`fixed z-[200] ${isFullscreen ? "inset-0" : "inset-0 flex items-center justify-center"}`}>
          {/* Backdrop — only in centered mode, click to minimize */}
          {!isFullscreen && (
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
              onClick={() => setIsMinimized(true)}
            />
          )}
          <div ref={callWindowRef} className={`relative bg-[#0F172A] shadow-[0_20px_60px_rgba(0,0,0,0.45)] overflow-hidden flex flex-col border border-[#1F2A44] ${isFullscreen ? "w-full h-full" : "w-[92vw] max-w-5xl h-[88vh] rounded-3xl"}`}>
            {/* Call header */}
            <div className="h-14 bg-gradient-to-r from-[#0F172A] via-[#0B1220] to-[#0F172A] border-b border-[#1F2A44] flex items-center justify-between px-5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-semibold shadow-[0_0_0_3px_rgba(37,99,235,0.2)]">
                  {getInitials(
                    employeeMap[otherUserId]?.firstName || "",
                    employeeMap[otherUserId]?.lastName || ""
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white tracking-wide">{getEmployeeName(otherUserId)}</p>
                  <p className="text-[11px] text-[#94A3B8]">
                    {isVideoEnabled ? "Video" : "Audio"} Call {isRecording && <span className="text-red-400 ml-1">&#9679; REC</span>} {isScreenSharing && <span className="text-blue-400 ml-1">Sharing</span>} &#8226; {durationStr}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {getCallStatusLabel()}
                </span>
                {/* Minimize button */}
                {!isFullscreen && (
                  <button
                    onClick={() => setIsMinimized(true)}
                    className="w-8 h-8 rounded-lg text-[#94A3B8] hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors"
                    title="Minimize"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={onEndCall}
                  className="w-8 h-8 rounded-lg bg-red-500/90 hover:bg-red-500 text-white flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Video/Audio + Chat row */}
            <div className="flex-1 flex min-h-0">
              <div className="flex-1 bg-gradient-to-br from-[#0B1220] via-[#0F172A] to-[#0B1220] relative">
                <audio ref={remoteAudioRef} autoPlay playsInline />
                {/* On Hold Overlay */}
                {isOnHold && signalingCallStatus === "connected" && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0F172A]/80 backdrop-blur-sm">
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
                          <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
                        </svg>
                      </div>
                      <p className="text-white text-lg font-semibold">Call on Hold</p>
                      <p className="text-[#94A3B8] text-sm mt-1">Click Resume to continue</p>
                      <button
                        onClick={onToggleHold}
                        className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium text-white transition-colors"
                      >
                        Resume
                      </button>
                    </div>
                  </div>
                )}
                {callDisconnected ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="relative w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      </div>
                      <p className="text-white text-lg font-semibold">Call Disconnected</p>
                      <p className="text-[#94A3B8] text-sm mt-1">{callDuration > 0 ? `Duration: ${Math.floor(callDuration / 60)}:${String(callDuration % 60).padStart(2, "0")}` : "Call ended"}</p>
                    </div>
                  </div>
                ) : webrtcError ? (
                  <div className="flex items-center justify-center h-full px-8">
                    <div className="text-center max-w-sm">
                      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                      </div>
                      <p className="text-white text-base font-semibold mb-2">Call Failed</p>
                      <p className="text-[#94A3B8] text-sm leading-relaxed">{webrtcError}</p>
                      <button onClick={onEndCall} className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors">
                        Close
                      </button>
                    </div>
                  </div>
                ) : (signalingCallStatus === "initiated" || signalingCallStatus === "ringing") ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="relative mx-auto mb-6">
                        <div className="absolute inset-0 w-28 h-28 rounded-full bg-[#2563EB]/20 animate-ping" style={{ animationDuration: "2s" }} />
                        <div className="absolute inset-0 w-28 h-28 rounded-full bg-[#2563EB]/10 animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.5s" }} />
                        <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] flex items-center justify-center text-white text-3xl font-bold shadow-[0_0_60px_rgba(37,99,235,0.4)]">
                          {getInitials(
                            employeeMap[otherUserId]?.firstName || "",
                            employeeMap[otherUserId]?.lastName || ""
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-1 mt-4">
                        <span className="text-white/80 text-sm font-medium">Calling</span>
                        <span className="flex gap-0.5 ml-0.5">
                          <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "200ms" }} />
                          <span className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: "400ms" }} />
                        </span>
                      </div>
                    </div>
                  </div>
                ) : isVideoEnabled || isScreenSharing || remoteHasVideo ? (
                  <VideoCallWindow
                    localStream={webrtcLocalStream}
                    remoteStream={webrtcRemoteStream}
                    localUserName={user ? `${user.firstName} ${user.lastName}` : "You"}
                    remoteUserName={getEmployeeName(otherUserId)}
                    isAudioMuted={!isAudioEnabled}
                    remoteHasVideo={remoteHasVideo}
                    localHasVideo={isVideoEnabled}
                    screenShareStream={screenShareStream}
                    isScreenSharing={isScreenSharing}
                    isViewerAnnotating={isViewerAnnotating}
                    annotationColor={annotationColor}
                    annotationBrushSize={annotationBrushSize}
                    onAnnotationToggle={onAnnotationToggle}
                    onAnnotationColorChange={onAnnotationColorChange}
                    onAnnotationBrushSizeChange={onAnnotationBrushSizeChange}
                    onAnnotationClear={onAnnotationClear}
                    onAnnotationStroke={onAnnotationStroke}
                    remotePointers={remotePointers}
                    onPointerMove={onPointerMove}
                    onPointerLeave={onPointerLeave}
                    floatingEmojis={floatingEmojis}
                  />
                ) : (
                  /* Audio-only call view */
                  <div className="flex items-center justify-center h-full relative">
                    {(() => {
                      const remoteParticipants = (callConversation?.participants || []).filter((p) => p.userId !== user._id);
                      const totalRemote = remoteParticipants.length;
                      const gridClass = totalRemote <= 1 ? "" : totalRemote === 2 ? "grid grid-cols-2 gap-6" : totalRemote <= 4 ? "grid grid-cols-2 gap-5" : "grid grid-cols-3 gap-4";
                      const avatarSize = totalRemote <= 1 ? "w-28 h-28" : totalRemote <= 3 ? "w-20 h-20" : "w-16 h-16";
                      const textSize = totalRemote <= 1 ? "text-4xl" : totalRemote <= 3 ? "text-2xl" : "text-xl";
                      const nameSize = totalRemote <= 1 ? "text-lg" : "text-sm";

                      if (totalRemote === 0) {
                        return (
                          <div className="text-center">
                            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(37,99,235,0.35)]">
                              <span className="text-4xl font-bold text-white">?</span>
                            </div>
                            <p className="text-[#94A3B8] text-sm">Connecting...</p>
                          </div>
                        );
                      }

                      return (
                        <div className={totalRemote <= 1 ? "text-center" : gridClass}>
                          {remoteParticipants.map((p) => {
                            const emp = employeeMap[p.userId];
                            const firstName = emp?.firstName || "";
                            const lastName = emp?.lastName || "";
                            const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";
                            const name = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";
                            return (
                              <div key={p.userId} className="flex flex-col items-center">
                                <div className={`relative ${avatarSize} rounded-full bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] flex items-center justify-center mb-3 shadow-[0_0_40px_rgba(37,99,235,0.25)]`}>
                                  <span className="absolute inset-0 rounded-full border border-white/10 animate-pulse" />
                                  <span className={`${textSize} font-bold text-white relative z-10`}>{initials}</span>
                                </div>
                                <p className={`text-white font-semibold ${nameSize}`}>{name}</p>
                                <p className="text-[#94A3B8] text-xs mt-0.5">{Math.floor(callDuration / 60)}:{String(callDuration % 60).padStart(2, "0")}</p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {/* Floating emojis overlay */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                      {floatingEmojis.map((e) => (
                        <div
                          key={e.id}
                          className="absolute text-4xl"
                          style={{
                            left: `${e.x}%`,
                            bottom: "10%",
                            animation: "float-up 3s ease-out forwards",
                          }}
                        >
                          {e.emoji}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* In-call chat panel */}
              {showCallChat && callConversation && (
                <div className="w-80 bg-[#111827] border-l border-[#1F2A44] flex flex-col">
                  <div className="h-12 px-4 flex items-center justify-between border-b border-[#1F2A44] shrink-0">
                    <span className="text-sm font-semibold text-white">Call Chat</span>
                    <button onClick={onCallChatToggle} className="p-1 rounded hover:bg-white/10 text-[#94A3B8]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                    {callChatMessages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-[#64748B] text-xs text-center">No messages in this call session</p>
                      </div>
                    ) : (
                      callChatMessages.map((msg) => {
                        const isMe = msg.senderId === user._id;
                        return (
                          <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] px-3 py-1.5 rounded-xl text-xs ${isMe ? "bg-[#2563EB] text-white" : "bg-[#1E293B] text-[#E2E8F0]"}`}>
                              {!isMe && <p className="text-[10px] text-[#60A5FA] font-medium mb-0.5">{getEmployeeName(msg.senderId)}</p>}
                              <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                              <p className={`text-[9px] mt-0.5 ${isMe ? "text-blue-200" : "text-[#64748B]"}`}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="p-2 border-t border-[#1F2A44] shrink-0">
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (!callChatMsg.trim()) return;
                      onCallChatSend(callChatMsg.trim());
                      onCallChatMsgChange("");
                    }} className="flex gap-1.5">
                      <input
                        value={callChatMsg}
                        onChange={(e) => onCallChatMsgChange(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 h-8 px-3 bg-[#1E293B] border border-[#334155] rounded-lg text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#2563EB]"
                      />
                      <button type="submit" disabled={!callChatMsg.trim()} className="h-8 w-8 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 flex items-center justify-center text-white shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>

            {/* Controls bar */}
            <div className="shrink-0 bg-[#0B1220] border-t border-[#1F2A44] flex items-center justify-center gap-2 px-5 py-3">
              <CallControls
                isAudioEnabled={isAudioEnabled}
                isVideoEnabled={isVideoEnabled}
                isRecording={isRecording}
                isScreenSharing={isScreenSharing}
                isFullscreen={isFullscreen}
                onToggleAudio={onToggleAudio}
                onToggleVideo={onToggleVideo}
                onToggleRecording={onToggleRecording}
                onToggleScreenShare={onToggleScreenShare}
                onToggleFullscreen={onToggleFullscreen}
                onAddParticipant={onAddParticipant}
                onEndCall={onEndCall}
                isOnHold={isOnHold}
                onToggleHold={onToggleHold}
                isAnnotating={isViewerAnnotating}
                onToggleAnnotation={onAnnotationToggle}
              />

              {/* Emoji reactions */}
              <div className="relative group/emoji shrink-0">
                <button
                  className="w-10 h-10 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white flex items-center justify-center transition-colors text-lg"
                  title="React"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                  </svg>
                </button>
                {/* pb-3 bridges the gap so hover stays active when moving to the popup */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 hidden group-hover/emoji:block pb-3">
                  <div className="flex items-center gap-1 bg-[#1E293B] rounded-full px-3 py-2 shadow-xl border border-[#334155]">
                    {["\uD83D\uDC4D", "\u2764\uFE0F", "\uD83D\uDE02", "\uD83D\uDE2E", "\uD83C\uDF89", "\uD83D\uDC4F", "\uD83D\uDD25", "\uD83D\uDE22"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => onEmojiReaction(emoji)}
                        className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center text-xl transition-all hover:scale-125"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chat toggle */}
              <div className="relative shrink-0">
                <button
                  onClick={onCallChatToggle}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${showCallChat ? "bg-[#2563EB] text-white" : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"}`}
                  title="Chat"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                </button>
                {callChatUnread > 0 && !showCallChat && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce" style={{ animationIterationCount: 3 }}>
                    {callChatUnread > 9 ? "9+" : callChatUnread}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Add Participant Modal (in-call) */}
          {showAddParticipantModal && (
            <div className="fixed inset-0 z-[250] flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={onCloseAddParticipant} />
              <div className="relative bg-[#1E293B] rounded-2xl shadow-2xl w-full max-w-sm max-h-[60vh] flex flex-col border border-[#334155]">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#334155] shrink-0">
                  <h2 className="text-sm font-bold text-white">Add to Call</h2>
                  <button
                    onClick={onCloseAddParticipant}
                    className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-white/10 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="px-4 py-3 border-b border-[#334155] shrink-0">
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={employeeSearch}
                    onChange={(e) => onEmployeeSearchChange(e.target.value)}
                    autoFocus
                    className="w-full h-9 px-3 text-[13px] bg-[#0F172A] border border-[#334155] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2563EB] text-white placeholder:text-[#64748B]"
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {filteredEmployees
                    .filter((e) => !callConversation?.participants.some((p) => p.userId === e.userId))
                    .map((emp) => (
                      <button
                        key={emp._id}
                        onClick={() => {
                          onInviteToCall(emp.userId);
                          toast.success(`${emp.firstName} invited to call`);
                          onCloseAddParticipant();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
                          {getInitials(emp.firstName, emp.lastName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-white truncate">{emp.firstName} {emp.lastName}</p>
                          <p className="text-[11px] text-[#64748B] truncate">{emp.email}</p>
                        </div>
                        <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Call Quality Feedback */}
      {showCallFeedback && feedbackCallId && (
        <CallFeedback
          callId={feedbackCallId}
          duration={feedbackCallDuration}
          onClose={onCloseCallFeedback}
        />
      )}

      {/* Float-up keyframe for emoji animation */}
      <style jsx global>{`
        @keyframes float-up {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          50% { transform: translateY(-200px) scale(1.3); opacity: 0.8; }
          100% { transform: translateY(-400px) scale(0.8); opacity: 0; }
        }
      `}</style>
    </>
  );
}

export const CallOverlay = React.memo(CallOverlayInner);
