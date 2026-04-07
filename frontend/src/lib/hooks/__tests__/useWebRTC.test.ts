/**
 * Tests for useWebRTC hook
 *
 * Mocks RTCPeerConnection and navigator.mediaDevices to verify
 * call initialization, media toggles, hold/resume, and cleanup.
 */
import { renderHook, act } from "@testing-library/react";
import { useWebRTC } from "../useWebRTC";

// ── Mock helpers ──

function createMockTrack(kind: "audio" | "video", enabled = true) {
  return {
    kind,
    id: `${kind}-${Math.random().toString(36).slice(2)}`,
    enabled,
    readyState: "live" as MediaStreamTrack["readyState"],
    stop: jest.fn(function (this: { readyState: string }) {
      this.readyState = "ended";
    }),
    onmute: null as ((this: MediaStreamTrack, ev: Event) => void) | null,
    onunmute: null as ((this: MediaStreamTrack, ev: Event) => void) | null,
    onended: null as ((this: MediaStreamTrack, ev: Event) => void) | null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    clone: jest.fn(),
    getConstraints: jest.fn(() => ({})),
    getSettings: jest.fn(() => ({})),
    getCapabilities: jest.fn(() => ({})),
    applyConstraints: jest.fn(),
  } as unknown as MediaStreamTrack;
}

function createMockStream(tracks: MediaStreamTrack[]) {
  const stream = {
    id: `stream-${Math.random().toString(36).slice(2)}`,
    active: true,
    getTracks: jest.fn(() => tracks),
    getAudioTracks: jest.fn(() => tracks.filter((t) => t.kind === "audio")),
    getVideoTracks: jest.fn(() => tracks.filter((t) => t.kind === "video")),
    addTrack: jest.fn((t: MediaStreamTrack) => tracks.push(t)),
    removeTrack: jest.fn((t: MediaStreamTrack) => {
      const idx = tracks.indexOf(t);
      if (idx >= 0) tracks.splice(idx, 1);
    }),
    clone: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  } as unknown as MediaStream;
  return stream;
}

function createMockPeerConnection() {
  const pc = {
    connectionState: "new" as RTCPeerConnectionState,
    iceConnectionState: "new" as RTCIceConnectionState,
    localDescription: null as RTCSessionDescription | null,
    remoteDescription: null as RTCSessionDescription | null,
    ontrack: null as ((this: RTCPeerConnection, ev: RTCTrackEvent) => void) | null,
    onicecandidate: null as ((this: RTCPeerConnection, ev: RTCPeerConnectionIceEvent) => void) | null,
    onconnectionstatechange: null as ((this: RTCPeerConnection, ev: Event) => void) | null,
    oniceconnectionstatechange: null as ((this: RTCPeerConnection, ev: Event) => void) | null,
    ondatachannel: null as ((this: RTCPeerConnection, ev: RTCDataChannelEvent) => void) | null,
    addTrack: jest.fn(),
    addTransceiver: jest.fn(),
    createDataChannel: jest.fn(() => ({
      readyState: "open",
      send: jest.fn(),
      onmessage: null,
      close: jest.fn(),
    })),
    createOffer: jest.fn().mockResolvedValue({ type: "offer", sdp: "mock-sdp" }),
    createAnswer: jest.fn().mockResolvedValue({ type: "answer", sdp: "mock-sdp" }),
    setLocalDescription: jest.fn().mockResolvedValue(undefined),
    setRemoteDescription: jest.fn().mockResolvedValue(undefined),
    addIceCandidate: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockResolvedValue(new Map()),
    getSenders: jest.fn(() => []),
    getTransceivers: jest.fn(() => []),
    close: jest.fn(),
    removeTrack: jest.fn(),
  };
  return pc;
}

// ── Global mocks ──

let mockPc: ReturnType<typeof createMockPeerConnection>;
let mockAudioTrack: MediaStreamTrack;
let mockStream: MediaStream;

beforeEach(() => {
  mockAudioTrack = createMockTrack("audio");
  mockStream = createMockStream([mockAudioTrack]);
  mockPc = createMockPeerConnection();

  // @ts-expect-error — simplified mock
  global.RTCPeerConnection = jest.fn(() => mockPc);
  // @ts-expect-error — simplified mock
  global.RTCSessionDescription = jest.fn((desc) => desc);

  Object.defineProperty(global.navigator, "mediaDevices", {
    value: {
      getUserMedia: jest.fn().mockResolvedValue(mockStream),
      getDisplayMedia: jest.fn().mockResolvedValue(mockStream),
    },
    configurable: true,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const DEFAULT_CONFIG = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
};

describe("useWebRTC", () => {
  // ── initializeCall ──

  it("initializeCall acquires audio with correct constraints", async () => {
    const { result } = renderHook(() => useWebRTC());

    await act(async () => {
      await result.current.initializeCall(DEFAULT_CONFIG);
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
  });

  it("initializeCall creates an RTCPeerConnection with iceServers", async () => {
    const { result } = renderHook(() => useWebRTC());

    await act(async () => {
      await result.current.initializeCall(DEFAULT_CONFIG);
    });

    expect(RTCPeerConnection).toHaveBeenCalledWith({
      iceServers: DEFAULT_CONFIG.iceServers,
    });
  });

  it("initializeCall stops tracks on previous streams before creating new ones (M06 fix)", async () => {
    const oldTrack = createMockTrack("audio");
    const oldStream = createMockStream([oldTrack]);

    // First call
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValueOnce(oldStream);
    const { result } = renderHook(() => useWebRTC());

    await act(async () => {
      await result.current.initializeCall(DEFAULT_CONFIG);
    });

    // Create a fresh mock PC for the second call
    const mockPc2 = createMockPeerConnection();
    (RTCPeerConnection as unknown as jest.Mock).mockImplementationOnce(() => mockPc2);

    const newTrack = createMockTrack("audio");
    const newStream = createMockStream([newTrack]);
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValueOnce(newStream);

    await act(async () => {
      await result.current.initializeCall(DEFAULT_CONFIG);
    });

    // Old stream tracks should have been stopped
    expect(oldTrack.stop).toHaveBeenCalled();
  });

  // ── toggleAudio ──

  it("toggleAudio mutes audio tracks when false", async () => {
    const { result } = renderHook(() => useWebRTC());

    await act(async () => {
      await result.current.initializeCall(DEFAULT_CONFIG);
    });

    act(() => {
      result.current.toggleAudio(false);
    });

    expect(mockAudioTrack.enabled).toBe(false);
  });

  it("toggleAudio unmutes audio tracks when true", async () => {
    const { result } = renderHook(() => useWebRTC());

    await act(async () => {
      await result.current.initializeCall(DEFAULT_CONFIG);
    });

    act(() => {
      result.current.toggleAudio(false);
    });
    expect(mockAudioTrack.enabled).toBe(false);

    act(() => {
      result.current.toggleAudio(true);
    });
    expect(mockAudioTrack.enabled).toBe(true);
  });

  // ── toggleVideo ──

  it("toggleVideo(true) requests camera media", async () => {
    const videoTrack = createMockTrack("video");
    const camStream = createMockStream([videoTrack]);
    (navigator.mediaDevices.getUserMedia as jest.Mock)
      .mockResolvedValueOnce(mockStream) // initializeCall
      .mockResolvedValueOnce(camStream); // toggleVideo

    const { result } = renderHook(() => useWebRTC());

    await act(async () => {
      await result.current.initializeCall(DEFAULT_CONFIG);
    });

    await act(async () => {
      await result.current.toggleVideo(true);
    });

    // The second getUserMedia call should request video
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: { width: 1280, height: 720 },
    });
  });

  // ── holdCall ──

  it("holdCall disables audio and video tracks", async () => {
    const { result } = renderHook(() => useWebRTC());

    await act(async () => {
      await result.current.initializeCall(DEFAULT_CONFIG);
    });

    act(() => {
      result.current.holdCall();
    });

    expect(mockAudioTrack.enabled).toBe(false);
  });

  // ── resumeCall ──

  it("resumeCall restores audio tracks", async () => {
    const { result } = renderHook(() => useWebRTC());

    await act(async () => {
      await result.current.initializeCall(DEFAULT_CONFIG);
    });

    act(() => {
      result.current.holdCall();
    });
    expect(mockAudioTrack.enabled).toBe(false);

    await act(async () => {
      await result.current.resumeCall(true, false);
    });

    expect(mockAudioTrack.enabled).toBe(true);
  });

  // ── endCall ──

  it("endCall stops all tracks and closes peer connection", async () => {
    const { result } = renderHook(() => useWebRTC());

    await act(async () => {
      await result.current.initializeCall(DEFAULT_CONFIG);
    });

    act(() => {
      result.current.endCall();
    });

    expect(mockAudioTrack.stop).toHaveBeenCalled();
    expect(mockPc.close).toHaveBeenCalled();
    expect(result.current.localStream).toBeNull();
    expect(result.current.remoteStream).toBeNull();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("endCall resets reconnection state to stable", async () => {
    const { result } = renderHook(() => useWebRTC());

    await act(async () => {
      await result.current.initializeCall(DEFAULT_CONFIG);
    });

    act(() => {
      result.current.endCall();
    });

    expect(result.current.reconnectionState).toBe("stable");
  });
});
