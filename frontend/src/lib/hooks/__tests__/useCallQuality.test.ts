/**
 * Tests for useCallQuality hook
 *
 * Verifies quality level calculation, polling interval, and cleanup.
 */
import { renderHook, act } from "@testing-library/react";
import { useCallQuality, type QualityLevel } from "../useCallQuality";

// ── Helpers ──

function createMockPeerConnection(statsMap: Map<string, Record<string, unknown>>) {
  return {
    connectionState: "connected" as RTCPeerConnectionState,
    getStats: jest.fn().mockResolvedValue(statsMap),
  } as unknown as RTCPeerConnection;
}

function buildStatsMap(overrides: {
  rtt?: number;
  jitter?: number;
  packetsReceived?: number;
  packetsLost?: number;
  bytesReceived?: number;
  bytesSent?: number;
  framesPerSecond?: number;
}) {
  const map = new Map<string, Record<string, unknown>>();
  map.set("cp1", {
    type: "candidate-pair",
    state: "succeeded",
    currentRoundTripTime: (overrides.rtt ?? 50) / 1000, // stored in seconds
    timestamp: Date.now(),
  });
  map.set("ir1", {
    type: "inbound-rtp",
    kind: "audio",
    jitter: (overrides.jitter ?? 10) / 1000, // stored in seconds
    packetsReceived: overrides.packetsReceived ?? 1000,
    packetsLost: overrides.packetsLost ?? 0,
    bytesReceived: overrides.bytesReceived ?? 50000,
  });
  map.set("or1", {
    type: "outbound-rtp",
    kind: "audio",
    bytesSent: overrides.bytesSent ?? 50000,
  });
  if (overrides.framesPerSecond !== undefined) {
    map.set("ir2", {
      type: "inbound-rtp",
      kind: "video",
      jitter: 0,
      packetsReceived: 500,
      packetsLost: 0,
      bytesReceived: 100000,
      framesPerSecond: overrides.framesPerSecond,
    });
  }
  return map;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useCallQuality", () => {
  // ── Quality level calculation ──

  it('reports "good" quality when RTT < 200, loss < 3%, jitter < 50', async () => {
    const stats = buildStatsMap({ rtt: 50, jitter: 10, packetsReceived: 1000, packetsLost: 0 });
    const pc = createMockPeerConnection(stats);

    const { result } = renderHook(() => useCallQuality(pc));

    // Poll twice so there is a "prev" baseline for bitrate/loss calculation
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.quality).toBe("good");
  });

  it('reports "acceptable" quality when RTT is between 200-500ms', async () => {
    const stats = buildStatsMap({ rtt: 300, jitter: 10, packetsReceived: 1000, packetsLost: 0 });
    const pc = createMockPeerConnection(stats);

    const { result } = renderHook(() => useCallQuality(pc));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.quality).toBe("acceptable");
  });

  it('reports "poor" quality when packet loss > 10%', async () => {
    // First poll (baseline)
    const stats1 = buildStatsMap({ rtt: 50, jitter: 10, packetsReceived: 100, packetsLost: 0 });
    // Second poll (high loss delta)
    const stats2 = buildStatsMap({ rtt: 50, jitter: 10, packetsReceived: 150, packetsLost: 30 });

    const pc = createMockPeerConnection(stats1);
    const { result } = renderHook(() => useCallQuality(pc));

    // First poll — sets baseline
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    // Switch stats for second poll
    (pc.getStats as jest.Mock).mockResolvedValue(stats2);

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.quality).toBe("poor");
  });

  it('reports "poor" quality when jitter > 100ms', async () => {
    const stats = buildStatsMap({ rtt: 50, jitter: 150, packetsReceived: 1000, packetsLost: 0 });
    const pc = createMockPeerConnection(stats);

    const { result } = renderHook(() => useCallQuality(pc));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.quality).toBe("poor");
  });

  // ── Polling interval ──

  it("polls every 2 seconds", async () => {
    const stats = buildStatsMap({});
    const pc = createMockPeerConnection(stats);

    renderHook(() => useCallQuality(pc));

    await act(async () => {
      jest.advanceTimersByTime(6000);
    });

    // 6 seconds / 2s interval = 3 polls
    expect(pc.getStats).toHaveBeenCalledTimes(3);
  });

  // ── Cleanup on unmount ──

  it("clears polling interval on unmount", async () => {
    const stats = buildStatsMap({});
    const pc = createMockPeerConnection(stats);

    const { unmount } = renderHook(() => useCallQuality(pc));

    unmount();

    // Advance time — no more calls should happen after unmount
    const callsBefore = (pc.getStats as jest.Mock).mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    expect(pc.getStats).toHaveBeenCalledTimes(callsBefore);
  });

  // ── Disabled ──

  it("does not poll when enabled is false", async () => {
    const stats = buildStatsMap({});
    const pc = createMockPeerConnection(stats);

    renderHook(() => useCallQuality(pc, false));

    await act(async () => {
      jest.advanceTimersByTime(6000);
    });

    expect(pc.getStats).not.toHaveBeenCalled();
  });

  it("resets metrics to defaults when peerConnection is null", () => {
    const { result } = renderHook(() => useCallQuality(null));

    expect(result.current.quality).toBe("good");
    expect(result.current.roundTripTime).toBe(0);
    expect(result.current.packetLoss).toBe(0);
  });
});
