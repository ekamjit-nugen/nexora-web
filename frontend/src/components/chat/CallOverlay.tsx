"use client";

import React, { useRef } from "react";
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

  // Call chat
  showCallChat: boolean;
  callChatMsg: string;
  messages: ChatMessage[];
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
    showCallChat, callChatMsg, messages, callStartTime,
    onCallChatMsgChange, onCallChatToggle, onCallChatSend,
    onEndCall, onToggleAudio, onToggleVideo,
    onToggleRecording, onToggleScreenShare, onToggleFullscreen,
    onToggleHold, onAddParticipant, onEmojiReaction,
    onAnnotationToggle, onAnnotationColorChange, onAnnotationBrushSizeChange, onAnnotationClear,
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

      {/* Active Call Window (Overlay) */}
      {showCallWindow && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0B1020]/80 via-[#0B1020]/70 to-[#101827]/80 backdrop-blur-sm" />
          <div ref={callWindowRef} className={`relative bg-[#0F172A] shadow-[0_20px_60px_rgba(0,0,0,0.45)] overflow-hidden flex flex-col border border-[#1F2A44] ${isFullscreen ? "w-full h-full" : "w-[92vw] max-w-5xl h-[88vh] rounded-3xl"}`}>
            {/* Call header */}
            <div className="h-16 bg-gradient-to-r from-[#0F172A] via-[#0B1220] to-[#0F172A] border-b border-[#1F2A44] flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-semibold shadow-[0_0_0_3px_rgba(37,99,235,0.2)]">
                  {getInitials(
                    employeeMap[otherUserId]?.firstName || "",
                    employeeMap[otherUserId]?.lastName || ""
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white tracking-wide">{getEmployeeName(otherUserId)}</p>
                  <p className="text-xs text-[#94A3B8]">
                    {isVideoEnabled ? "Video" : "Audio"} Call {isRecording && <span className="text-red-400 ml-1">&#9679; REC</span>} {isScreenSharing && <span className="text-blue-400 ml-1">Sharing</span>} &#8226; {Math.floor(callDuration / 60)}:{String(callDuration % 60).padStart(2, "0")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {getCallStatusLabel()}
                </span>
                {signalingCallStatus === "connected" && (
                  <span className="flex items-center gap-1.5 text-[10px] text-[#CBD5F5]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Encrypted
                  </span>
                )}
              </div>
              <button
                onClick={onEndCall}
                className="w-10 h-10 rounded-full bg-red-500/90 hover:bg-red-500 text-white flex items-center justify-center transition-colors shadow-[0_8px_20px_rgba(239,68,68,0.3)]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
                    screenShareStream={screenShareStream}
                    isScreenSharing={isScreenSharing}
                    isViewerAnnotating={isViewerAnnotating}
                    annotationColor={annotationColor}
                    annotationBrushSize={annotationBrushSize}
                    onAnnotationToggle={onAnnotationToggle}
                    onAnnotationColorChange={onAnnotationColorChange}
                    onAnnotationBrushSizeChange={onAnnotationBrushSizeChange}
                    onAnnotationClear={onAnnotationClear}
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
                    {(() => {
                      const callMessages = callStartTime
                        ? messages.filter((msg) => new Date(msg.createdAt) >= new Date(callStartTime))
                        : [];
                      if (callMessages.length === 0) {
                        return (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-[#64748B] text-xs text-center">No messages during this call yet</p>
                          </div>
                        );
                      }
                      return callMessages.map((msg) => {
                        const isMe = msg.senderId === user._id;
                        return (
                          <div key={msg._id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] px-3 py-1.5 rounded-xl text-xs ${isMe ? "bg-[#2563EB] text-white" : "bg-[#1E293B] text-[#E2E8F0]"}`}>
                              {!isMe && <p className="text-[10px] text-[#60A5FA] font-medium mb-0.5">{getEmployeeName(msg.senderId)}</p>}
                              {msg.type === "file" && msg.fileUrl ? (
                                <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="underline break-all">{msg.fileName || msg.content}</a>
                              ) : (
                                <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                              )}
                              <p className={`text-[9px] mt-0.5 ${isMe ? "text-blue-200" : "text-[#64748B]"}`}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        );
                      });
                    })()}
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
            <div className="h-20 bg-[#0B1220] border-t border-[#1F2A44] flex items-center justify-center gap-3 px-5">
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
              />

              {/* Emoji reactions */}
              <div className="relative group/emoji">
                <button
                  className="w-12 h-12 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white flex items-center justify-center transition-colors text-lg"
                  title="React"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                  </svg>
                </button>
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover/emoji:flex items-center gap-1 bg-[#1E293B] rounded-full px-3 py-2 shadow-xl border border-[#334155]">
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

              {/* Chat toggle */}
              <button
                onClick={onCallChatToggle}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${showCallChat ? "bg-[#2563EB] text-white" : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"}`}
                title="Chat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </button>
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
