"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type QualityLevel = "good" | "acceptable" | "poor";

export interface CallQualityMetrics {
  /** Round-trip time in milliseconds */
  roundTripTime: number;
  /** Jitter in milliseconds */
  jitter: number;
  /** Packet loss percentage (0-100) */
  packetLoss: number;
  /** Inbound bitrate in kbps */
  inboundBitrate: number;
  /** Outbound bitrate in kbps */
  outboundBitrate: number;
  /** Video frame rate (if video active) */
  frameRate: number;
  /** Overall quality assessment */
  quality: QualityLevel;
}

const POLL_INTERVAL_MS = 2000;

const DEFAULT_METRICS: CallQualityMetrics = {
  roundTripTime: 0,
  jitter: 0,
  packetLoss: 0,
  inboundBitrate: 0,
  outboundBitrate: 0,
  frameRate: 0,
  quality: "good",
};

function computeQuality(packetLoss: number, rtt: number, jitter: number): QualityLevel {
  if (packetLoss > 10 || rtt > 500 || jitter > 100) return "poor";
  if (packetLoss > 3 || rtt > 200 || jitter > 50) return "acceptable";
  return "good";
}

export function useCallQuality(
  peerConnection: RTCPeerConnection | null,
  enabled: boolean = true,
): CallQualityMetrics {
  const [metrics, setMetrics] = useState<CallQualityMetrics>(DEFAULT_METRICS);
  const prevStatsRef = useRef<{
    timestamp: number;
    bytesReceived: number;
    bytesSent: number;
    packetsReceived: number;
    packetsLost: number;
  } | null>(null);

  const pollStats = useCallback(async () => {
    if (!peerConnection || peerConnection.connectionState === "closed") return;

    try {
      const stats = await peerConnection.getStats();
      let totalRtt = 0;
      let rttCount = 0;
      let totalJitter = 0;
      let jitterCount = 0;
      let totalPacketsReceived = 0;
      let totalPacketsLost = 0;
      let totalBytesReceived = 0;
      let totalBytesSent = 0;
      let frameRate = 0;
      let currentTimestamp = 0;

      stats.forEach((report) => {
        if (report.type === "candidate-pair" && report.state === "succeeded") {
          if (report.currentRoundTripTime !== undefined) {
            totalRtt += report.currentRoundTripTime * 1000; // Convert to ms
            rttCount++;
          }
          currentTimestamp = report.timestamp;
        }

        if (report.type === "inbound-rtp") {
          if (report.jitter !== undefined) {
            totalJitter += report.jitter * 1000; // Convert to ms
            jitterCount++;
          }
          if (report.packetsReceived !== undefined) {
            totalPacketsReceived += report.packetsReceived;
          }
          if (report.packetsLost !== undefined) {
            totalPacketsLost += report.packetsLost;
          }
          if (report.bytesReceived !== undefined) {
            totalBytesReceived += report.bytesReceived;
          }
          if (report.kind === "video" && report.framesPerSecond !== undefined) {
            frameRate = report.framesPerSecond;
          }
        }

        if (report.type === "outbound-rtp") {
          if (report.bytesSent !== undefined) {
            totalBytesSent += report.bytesSent;
          }
        }
      });

      const prev = prevStatsRef.current;
      let inboundBitrate = 0;
      let outboundBitrate = 0;
      let packetLoss = 0;

      if (prev && currentTimestamp > prev.timestamp) {
        const timeDiffSec = (currentTimestamp - prev.timestamp) / 1000;
        inboundBitrate = Math.round(((totalBytesReceived - prev.bytesReceived) * 8) / timeDiffSec / 1000); // kbps
        outboundBitrate = Math.round(((totalBytesSent - prev.bytesSent) * 8) / timeDiffSec / 1000); // kbps

        const newPacketsReceived = totalPacketsReceived - prev.packetsReceived;
        const newPacketsLost = totalPacketsLost - prev.packetsLost;
        const totalNewPackets = newPacketsReceived + newPacketsLost;
        packetLoss = totalNewPackets > 0 ? Math.round((newPacketsLost / totalNewPackets) * 100 * 10) / 10 : 0;
      }

      prevStatsRef.current = {
        timestamp: currentTimestamp,
        bytesReceived: totalBytesReceived,
        bytesSent: totalBytesSent,
        packetsReceived: totalPacketsReceived,
        packetsLost: totalPacketsLost,
      };

      const roundTripTime = rttCount > 0 ? Math.round(totalRtt / rttCount) : 0;
      const jitter = jitterCount > 0 ? Math.round(totalJitter / jitterCount) : 0;
      const quality = computeQuality(packetLoss, roundTripTime, jitter);

      setMetrics({
        roundTripTime,
        jitter,
        packetLoss,
        inboundBitrate: Math.max(0, inboundBitrate),
        outboundBitrate: Math.max(0, outboundBitrate),
        frameRate,
        quality,
      });
    } catch {
      // Stats polling failed — non-critical
    }
  }, [peerConnection]);

  useEffect(() => {
    if (!enabled || !peerConnection) {
      prevStatsRef.current = null;
      setMetrics(DEFAULT_METRICS);
      return;
    }

    const interval = setInterval(pollStats, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, peerConnection, pollStats]);

  return metrics;
}
