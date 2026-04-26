"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { meetingApi, Meeting } from "@/lib/api";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";

// ── Types ──

interface Participant {
  socketId: string;
  userId?: string;
  displayName: string;
  isAnonymous?: boolean;
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing?: boolean;
}

interface ChatMsg {
  socketId: string;
  displayName: string;
  text: string;
  timestamp: string;
}

interface TranscriptEntry {
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: string;
}

type Panel = "participants" | "chat" | "transcript" | null;

const CALL_SOCKET_URL =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_CALL_SOCKET_URL || "http://192.168.29.218:3051"
    : "http://192.168.29.218:3051";

// ── Helpers ──

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Video Tile ──

function VideoTile({
  participant,
  isLocal,
  isSelf,
}: {
  participant: Participant;
  isLocal?: boolean;
  isSelf?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  const showVideo = participant.videoEnabled && participant.stream;

  return (
    <div className="relative rounded-xl overflow-hidden bg-[#1C2333] flex items-center justify-center aspect-video border border-white/10 group">
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-xl font-semibold">
            {getInitials(participant.displayName)}
          </div>
          <span className="text-white text-sm font-medium">{participant.displayName}</span>
        </div>
      )}

      {/* Overlay info */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <span className="text-xs text-white bg-black/50 px-2 py-0.5 rounded-full truncate max-w-[120px]">
          {participant.displayName}
          {isSelf && " (You)"}
        </span>
        <div className="flex items-center gap-1">
          {!participant.audioEnabled && (
            <span className="bg-red-500/80 rounded-full p-0.5">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
                <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />
              </svg>
            </span>
          )}
          {participant.isScreenSharing && (
            <span className="bg-[#2E86C1]/80 rounded-full p-0.5">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──

export default function MeetingPage() {
  const { id: meetingId } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Join state
  const [joinStep, setJoinStep] = useState<"loading" | "name" | "preview" | "meeting">("loading");
  const [displayName, setDisplayName] = useState("");
  const [meetingInfo, setMeetingInfo] = useState<Partial<Meeting> | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Media
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Meeting
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

  // Panels
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  // Socket & WebRTC
  const socketRef = useRef<Socket | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const mySocketId = useRef<string>("");

  // Speech recognition
  const recognitionRef = useRef<any>(null);
  const [speechActive, setSpeechActive] = useState(false);

  // ── Load public meeting info ──
  useEffect(() => {
    if (!meetingId) return;
    meetingApi.getPublic(meetingId)
      .then((res) => {
        setMeetingInfo(res.data || null);
        if (!authLoading) {
          if (user) {
            setDisplayName(`${user.firstName} ${user.lastName}`.trim());
            setIsAnonymous(false);
            setJoinStep("preview");
          } else {
            setIsAnonymous(true);
            setJoinStep("name");
          }
        }
      })
      .catch(() => {
        toast.error("Meeting not found");
        router.push("/");
      });
  }, [meetingId, authLoading, user, router]);

  useEffect(() => {
    if (authLoading) return;
    if (joinStep === "loading" && meetingInfo) {
      if (user) {
        setDisplayName(`${user.firstName} ${user.lastName}`.trim());
        setJoinStep("preview");
      } else {
        setIsAnonymous(true);
        setJoinStep("name");
      }
    }
  }, [authLoading, user, meetingInfo, joinStep]);

  // ── Get camera/mic for preview ──
  useEffect(() => {
    if (joinStep !== "preview" && joinStep !== "meeting") return;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      })
      .catch(() => {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            setLocalStream(stream);
            setVideoEnabled(false);
          })
          .catch(() => setVideoEnabled(false));
      });
  }, [joinStep]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      localStream?.getTracks().forEach((t) => t.stop());
      screenStream?.getTracks().forEach((t) => t.stop());
      peerConnections.current.forEach((pc) => pc.close());
      socketRef.current?.disconnect();
      recognitionRef.current?.stop();
    };
  }, []); // eslint-disable-line

  // ── WebRTC helpers ──
  const getIceConfig = (): RTCConfiguration => ({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  });

  const createPeerConnection = useCallback(
    (targetSocketId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(getIceConfig());

      // Add local tracks
      if (localStream) {
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
      }

      // ICE candidates
      pc.onicecandidate = (e) => {
        if (e.candidate && socketRef.current) {
          socketRef.current.emit("meeting:ice-candidate", {
            meetingId,
            targetSocketId,
            candidate: e.candidate,
          });
        }
      };

      // Remote stream
      pc.ontrack = (e) => {
        const stream = e.streams[0];
        setParticipants((prev) => {
          const next = new Map(prev);
          const p = next.get(targetSocketId);
          if (p) next.set(targetSocketId, { ...p, stream });
          return next;
        });
      };

      peerConnections.current.set(targetSocketId, pc);
      return pc;
    },
    [localStream, meetingId],
  );

  // ── Join meeting ──
  const joinMeeting = useCallback(async () => {
    setJoinStep("meeting");

    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

    const socket = io(`${CALL_SOCKET_URL}/meetings`, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      auth: token ? { token } : {},
    });

    socketRef.current = socket;

    socket.on("meeting:connected", () => {
      socket.emit("meeting:join", { meetingId, displayName });
    });

    socket.on("meeting:joined", async (data) => {
      mySocketId.current = data.yourSocketId;
      setIsRecording(data.meeting.isRecording);

      // For each existing participant, create a peer connection and send offer
      for (const existing of data.participants) {
        const pc = createPeerConnection(existing.socketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("meeting:offer", {
          meetingId,
          targetSocketId: existing.socketId,
          sdp: offer.sdp,
        });

        setParticipants((prev) => {
          const next = new Map(prev);
          next.set(existing.socketId, {
            socketId: existing.socketId,
            userId: existing.userId,
            displayName: existing.displayName,
            isAnonymous: existing.isAnonymous,
            audioEnabled: true,
            videoEnabled: false,
          });
          return next;
        });
      }

      // Add self
      setParticipants((prev) => {
        const next = new Map(prev);
        next.set(data.yourSocketId, {
          socketId: data.yourSocketId,
          displayName,
          audioEnabled,
          videoEnabled,
          stream: localStream || undefined,
        });
        return next;
      });
    });

    // New participant joined — they will send us an offer
    socket.on("meeting:participant-joined", (data) => {
      setParticipants((prev) => {
        const next = new Map(prev);
        next.set(data.socketId, {
          socketId: data.socketId,
          userId: data.userId,
          displayName: data.displayName,
          isAnonymous: data.isAnonymous,
          audioEnabled: true,
          videoEnabled: false,
        });
        return next;
      });
      toast(`${data.displayName} joined the meeting`);
    });

    // Participant left
    socket.on("meeting:participant-left", (data) => {
      setParticipants((prev) => {
        const next = new Map(prev);
        next.delete(data.socketId);
        return next;
      });
      const pc = peerConnections.current.get(data.socketId);
      if (pc) { pc.close(); peerConnections.current.delete(data.socketId); }
      toast(`${data.displayName} left the meeting`);
    });

    // WebRTC: receive offer
    socket.on("meeting:offer", async (data) => {
      const pc = createPeerConnection(data.from);
      await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: data.sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("meeting:answer", { meetingId, targetSocketId: data.from, sdp: answer.sdp });
    });

    // WebRTC: receive answer
    socket.on("meeting:answer", async (data) => {
      const pc = peerConnections.current.get(data.from);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: data.sdp }));
    });

    // ICE candidate
    socket.on("meeting:ice-candidate", async (data) => {
      const pc = peerConnections.current.get(data.from);
      if (pc && data.candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
      }
    });

    // Media state
    socket.on("meeting:media-state", (data) => {
      setParticipants((prev) => {
        const next = new Map(prev);
        const p = next.get(data.socketId);
        if (p) next.set(data.socketId, { ...p, audioEnabled: data.audioEnabled, videoEnabled: data.videoEnabled });
        return next;
      });
    });

    // Recording toggle
    socket.on("meeting:recording-toggled", (data) => {
      setIsRecording(data.isRecording);
      toast(data.isRecording ? "Recording started" : "Recording stopped");
    });

    // Chat
    socket.on("meeting:chat", (data: ChatMsg) => {
      setChatMessages((prev) => [...prev, data]);
    });

    // Transcript
    socket.on("meeting:transcript-entry", (entry: TranscriptEntry) => {
      setTranscript((prev) => [...prev, entry]);
    });

    // Meeting ended
    socket.on("meeting:ended", () => {
      toast("Meeting has ended");
      endAndLeave();
    });

    // Screen share
    socket.on("meeting:screen-share-started", (data) => {
      setParticipants((prev) => {
        const next = new Map(prev);
        const p = next.get(data.socketId);
        if (p) next.set(data.socketId, { ...p, isScreenSharing: true });
        return next;
      });
    });
    socket.on("meeting:screen-share-stopped", (data) => {
      setParticipants((prev) => {
        const next = new Map(prev);
        const p = next.get(data.socketId);
        if (p) next.set(data.socketId, { ...p, isScreenSharing: false });
        return next;
      });
    });
  }, [meetingId, displayName, localStream, audioEnabled, videoEnabled, createPeerConnection]);

  // ── Controls ──

  const toggleAudio = useCallback(() => {
    if (!localStream) return;
    const next = !audioEnabled;
    localStream.getAudioTracks().forEach((t) => (t.enabled = next));
    setAudioEnabled(next);
    socketRef.current?.emit("meeting:media-state", { meetingId, audioEnabled: next, videoEnabled });
    setParticipants((prev) => {
      const next2 = new Map(prev);
      const self = next2.get(mySocketId.current);
      if (self) next2.set(mySocketId.current, { ...self, audioEnabled: next });
      return next2;
    });
  }, [localStream, audioEnabled, videoEnabled, meetingId]);

  const toggleVideo = useCallback(() => {
    if (!localStream) return;
    const next = !videoEnabled;
    localStream.getVideoTracks().forEach((t) => (t.enabled = next));
    setVideoEnabled(next);
    socketRef.current?.emit("meeting:media-state", { meetingId, audioEnabled, videoEnabled: next });
    setParticipants((prev) => {
      const next2 = new Map(prev);
      const self = next2.get(mySocketId.current);
      if (self) next2.set(mySocketId.current, { ...self, videoEnabled: next });
      return next2;
    });
  }, [localStream, videoEnabled, audioEnabled, meetingId]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      screenStream?.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
      socketRef.current?.emit("meeting:screen-share-stop", { meetingId });

      // Replace screen track with camera track in all PCs
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender && videoTrack) sender.replaceTrack(videoTrack);
        });
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(stream);
        setIsScreenSharing(true);
        socketRef.current?.emit("meeting:screen-share-start", { meetingId });

        const screenTrack = stream.getVideoTracks()[0];
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(screenTrack);
        });

        screenTrack.onended = () => {
          setIsScreenSharing(false);
          setScreenStream(null);
          socketRef.current?.emit("meeting:screen-share-stop", { meetingId });
        };
      } catch {
        toast.error("Screen share cancelled or not supported");
      }
    }
  }, [isScreenSharing, screenStream, meetingId, localStream]);

  // ── Recording ──

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorder?.stop();
      setIsRecording(false);
      try {
        await meetingApi.toggleRecording(meetingId as string, false);
      } catch {}
    } else {
      // Start local recording (combined stream)
      const streams: MediaStream[] = [];
      if (localStream) streams.push(localStream);

      if (streams.length === 0) {
        toast.error("No media stream to record");
        return;
      }

      try {
        const combined = new MediaStream(streams.flatMap((s) => s.getTracks()));
        const recorder = new MediaRecorder(combined, { mimeType: "video/webm" });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `meeting-${meetingId}-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
        };
        recorder.start(1000);
        setMediaRecorder(recorder);
        setRecordedChunks([]);
        setIsRecording(true);
        await meetingApi.toggleRecording(meetingId as string, true);
      } catch (err) {
        toast.error("Failed to start recording");
      }
    }
  }, [isRecording, mediaRecorder, localStream, meetingId]);

  // ── Speech-to-Text ──

  const toggleSpeech = useCallback(() => {
    if (speechActive) {
      recognitionRef.current?.stop();
      setSpeechActive(false);
    } else {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast.error("Speech recognition not supported in this browser");
        return;
      }
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "en-US";
      rec.onresult = (e: any) => {
        const text = Array.from(e.results)
          .slice(e.resultIndex)
          .map((r: any) => r[0].transcript)
          .join(" ")
          .trim();
        if (text && socketRef.current) {
          socketRef.current.emit("meeting:transcript", {
            meetingId,
            text,
            speakerName: displayName,
          });
        }
      };
      rec.onerror = () => setSpeechActive(false);
      rec.onend = () => setSpeechActive(false);
      rec.start();
      recognitionRef.current = rec;
      setSpeechActive(true);
    }
  }, [speechActive, displayName, meetingId]);

  // ── Chat ──

  const sendChat = useCallback(() => {
    if (!chatInput.trim() || !socketRef.current) return;
    socketRef.current.emit("meeting:chat", { meetingId, text: chatInput.trim() });
    setChatInput("");
  }, [chatInput, meetingId]);

  // ── End ──

  const endAndLeave = useCallback(() => {
    localStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    recognitionRef.current?.stop();
    mediaRecorder?.stop();
    socketRef.current?.emit("meeting:leave", { meetingId });
    socketRef.current?.disconnect();
    peerConnections.current.forEach((pc) => pc.close());
    router.push("/");
  }, [localStream, screenStream, mediaRecorder, meetingId, router]);

  const copyMeetingLink = useCallback(() => {
    const link = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(link).then(() => toast.success("Meeting link copied!"));
  }, [meetingId]);

  // ── Render: Loading ──

  if (joinStep === "loading") {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-[#94A3B8] text-sm">Loading meeting...</p>
        </div>
      </div>
    );
  }

  // ── Render: Name input (anonymous) ──

  if (joinStep === "name") {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center p-4">
        <div className="bg-[#1E293B] rounded-2xl p-8 w-full max-w-sm shadow-2xl border border-white/10">
          <div className="mb-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[#2E86C1]/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-1">{meetingInfo?.title || "Meeting"}</h1>
            <p className="text-[#94A3B8] text-sm">Hosted by {meetingInfo?.hostName}</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#CBD5E1] mb-1.5">Your name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && displayName.trim() && setJoinStep("preview")}
                placeholder="Enter your name"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F172A] border border-white/10 text-white placeholder-[#475569] focus:outline-none focus:border-[#2E86C1] text-sm"
              />
            </div>
            <button
              onClick={() => displayName.trim() && setJoinStep("preview")}
              disabled={!displayName.trim()}
              className="w-full py-2.5 rounded-xl bg-[#2E86C1] hover:bg-[#2574a9] text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Preview (camera/mic check) ──

  if (joinStep === "preview") {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white">{meetingInfo?.title || "Meeting"}</h1>
            <p className="text-[#94A3B8] text-sm mt-1">Hosted by {meetingInfo?.hostName}</p>
          </div>

          {/* Camera preview */}
          <div className="relative rounded-2xl overflow-hidden bg-[#1C2333] aspect-video mb-4 flex items-center justify-center border border-white/10">
            {videoEnabled && localStream ? (
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-2xl font-semibold">
                  {getInitials(displayName)}
                </div>
                <p className="text-[#94A3B8] text-sm">Camera is off</p>
              </div>
            )}
            {/* Toggle buttons overlay */}
            <div className="absolute bottom-4 flex items-center gap-3">
              <button
                onClick={() => {
                  if (!localStream) return;
                  const next = !audioEnabled;
                  localStream.getAudioTracks().forEach((t) => (t.enabled = next));
                  setAudioEnabled(next);
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${audioEnabled ? "bg-white/20 hover:bg-white/30 text-white" : "bg-red-500 hover:bg-red-600 text-white"}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {audioEnabled ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
                  ) : (
                    <><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" /><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" /></>
                  )}
                </svg>
              </button>
              <button
                onClick={() => {
                  if (!localStream) return;
                  const next = !videoEnabled;
                  localStream.getVideoTracks().forEach((t) => (t.enabled = next));
                  setVideoEnabled(next);
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${videoEnabled ? "bg-white/20 hover:bg-white/30 text-white" : "bg-red-500 hover:bg-red-600 text-white"}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={copyMeetingLink}
              className="flex-1 py-2.5 rounded-xl border border-white/20 text-[#CBD5E1] hover:bg-white/5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy link
            </button>
            <button
              onClick={joinMeeting}
              className="flex-1 py-2.5 rounded-xl bg-[#2E86C1] hover:bg-[#2574a9] text-white font-medium text-sm transition-colors"
            >
              Join now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Active Meeting Room ──

  const participantList = Array.from(participants.values());
  const otherParticipants = participantList.filter((p) => p.socketId !== mySocketId.current);
  const selfParticipant = participantList.find((p) => p.socketId === mySocketId.current);

  // Grid layout based on participant count
  const totalCount = participantList.length;
  const gridCols = totalCount <= 1 ? 1 : totalCount <= 4 ? 2 : totalCount <= 9 ? 3 : 4;

  return (
    <div className="min-h-screen bg-[#111827] flex flex-col">
      {/* Top bar */}
      <div className="h-14 flex items-center justify-between px-4 bg-[#0F172A] border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2E86C1]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-none">{meetingInfo?.title || "Meeting"}</p>
            <p className="text-[#64748B] text-xs mt-0.5">{totalCount} participant{totalCount !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-1.5 bg-red-500/20 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 text-xs font-medium">Recording</span>
            </div>
          )}
          <button
            onClick={copyMeetingLink}
            title="Copy meeting link"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video grid */}
        <div className="flex-1 p-4 overflow-auto">
          <div
            className="grid gap-3 h-full"
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
            {selfParticipant && (
              <VideoTile participant={{ ...selfParticipant, stream: localStream || undefined, audioEnabled, videoEnabled }} isLocal isSelf />
            )}
            {otherParticipants.map((p) => (
              <VideoTile key={p.socketId} participant={p} />
            ))}
            {participantList.length === 0 && (
              <div className="flex items-center justify-center text-[#64748B] col-span-full">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-sm">Waiting for others to join...</p>
                  <button onClick={copyMeetingLink} className="mt-3 text-[#2E86C1] text-sm hover:underline">
                    Copy invite link
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        {activePanel && (
          <div className="w-80 bg-[#1E293B] border-l border-white/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-white text-sm font-semibold capitalize">{activePanel}</h3>
              <button
                onClick={() => setActivePanel(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-white/10"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Participants */}
            {activePanel === "participants" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {participantList.map((p) => (
                  <div key={p.socketId} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5">
                    <div className="w-8 h-8 rounded-full bg-[#2E86C1] flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {getInitials(p.displayName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {p.displayName}
                        {p.socketId === mySocketId.current && <span className="text-[#64748B] ml-1">(You)</span>}
                      </p>
                      {p.isAnonymous && <p className="text-[#64748B] text-xs">Guest</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      {!p.audioEnabled && (
                        <span className="text-red-400">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                            <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Chat */}
            {activePanel === "chat" && (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {chatMessages.length === 0 && (
                    <p className="text-[#64748B] text-xs text-center py-8">No messages yet</p>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`${msg.socketId === mySocketId.current ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                      <span className="text-[#64748B] text-xs px-1">{msg.displayName}</span>
                      <div className={`px-3 py-2 rounded-xl text-sm max-w-[90%] ${msg.socketId === mySocketId.current ? "bg-[#2E86C1] text-white" : "bg-white/10 text-white"}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-white/10 flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendChat()}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 rounded-xl bg-white/10 text-white placeholder-[#475569] text-sm focus:outline-none focus:bg-white/15"
                  />
                  <button onClick={sendChat} className="w-9 h-9 rounded-xl bg-[#2E86C1] flex items-center justify-center text-white hover:bg-[#2574a9]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </>
            )}

            {/* Transcript */}
            {activePanel === "transcript" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[#64748B] text-xs">
                    {speechActive ? "Listening..." : "Speech-to-text off"}
                  </p>
                  <button
                    onClick={toggleSpeech}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${speechActive ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-[#2E86C1]/20 text-[#2E86C1] hover:bg-[#2E86C1]/30"}`}
                  >
                    {speechActive ? "Stop" : "Start"}
                  </button>
                </div>
                {transcript.length === 0 && (
                  <p className="text-[#64748B] text-xs text-center py-8">
                    No transcript yet. Enable speech-to-text above.
                  </p>
                )}
                {transcript.map((entry, i) => (
                  <div key={i} className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#2E86C1] text-xs font-medium">{entry.speakerName}</span>
                      <span className="text-[#475569] text-xs">{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-[#CBD5E1] text-sm leading-relaxed">{entry.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="h-20 bg-[#0F172A] border-t border-white/10 flex items-center justify-center gap-3 px-6">
        {/* Mute */}
        <button
          onClick={toggleAudio}
          title={audioEnabled ? "Mute" : "Unmute"}
          className={`flex flex-col items-center gap-1 group`}
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${audioEnabled ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500 hover:bg-red-600 text-white"}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {audioEnabled ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
              ) : (
                <><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" /><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.5" /></>
              )}
            </svg>
          </div>
          <span className="text-[10px] text-[#94A3B8]">{audioEnabled ? "Mute" : "Unmute"}</span>
        </button>

        {/* Video */}
        <button
          onClick={toggleVideo}
          title={videoEnabled ? "Stop video" : "Start video"}
          className="flex flex-col items-center gap-1"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${videoEnabled ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500 hover:bg-red-600 text-white"}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-[10px] text-[#94A3B8]">{videoEnabled ? "Stop" : "Start"}</span>
        </button>

        {/* Screen share */}
        <button
          onClick={toggleScreenShare}
          title={isScreenSharing ? "Stop sharing" : "Share screen"}
          className="flex flex-col items-center gap-1"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isScreenSharing ? "bg-[#2E86C1] text-white" : "bg-white/10 hover:bg-white/20 text-white"}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-[10px] text-[#94A3B8]">Screen</span>
        </button>

        {/* Record */}
        <button
          onClick={toggleRecording}
          title={isRecording ? "Stop recording" : "Start recording"}
          className="flex flex-col items-center gap-1"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isRecording ? "bg-red-500 text-white" : "bg-white/10 hover:bg-white/20 text-white"}`}>
            {isRecording ? (
              <span className="w-4 h-4 rounded-sm bg-white" />
            ) : (
              <span className="w-4 h-4 rounded-full bg-red-400" />
            )}
          </div>
          <span className="text-[10px] text-[#94A3B8]">{isRecording ? "Stop rec" : "Record"}</span>
        </button>

        {/* Speech-to-text */}
        <button
          onClick={toggleSpeech}
          title={speechActive ? "Stop transcription" : "Transcribe speech"}
          className="flex flex-col items-center gap-1"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${speechActive ? "bg-emerald-500 text-white" : "bg-white/10 hover:bg-white/20 text-white"}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
          <span className="text-[10px] text-[#94A3B8]">Transcript</span>
        </button>

        {/* Separator */}
        <div className="w-px h-10 bg-white/10 mx-1" />

        {/* Participants */}
        <button
          onClick={() => setActivePanel(activePanel === "participants" ? null : "participants")}
          className="flex flex-col items-center gap-1"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${activePanel === "participants" ? "bg-[#2E86C1] text-white" : "bg-white/10 hover:bg-white/20 text-white"}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="text-[10px] text-[#94A3B8]">People</span>
        </button>

        {/* Chat */}
        <button
          onClick={() => setActivePanel(activePanel === "chat" ? null : "chat")}
          className="flex flex-col items-center gap-1"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${activePanel === "chat" ? "bg-[#2E86C1] text-white" : "bg-white/10 hover:bg-white/20 text-white"}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="text-[10px] text-[#94A3B8]">Chat</span>
        </button>

        {/* Separator */}
        <div className="w-px h-10 bg-white/10 mx-1" />

        {/* Leave / End */}
        <button
          onClick={endAndLeave}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </div>
          <span className="text-[10px] text-red-400">Leave</span>
        </button>
      </div>
    </div>
  );
}
