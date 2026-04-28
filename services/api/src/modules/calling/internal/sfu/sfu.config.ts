/**
 * mediasoup configuration.
 * These settings control Worker, Router, and Transport behavior.
 */
export const mediasoupConfig = {
  // Worker settings (one worker per CPU core recommended)
  worker: {
    rtcMinPort: parseInt(process.env.MEDIASOUP_RTC_MIN_PORT || '10000'),
    rtcMaxPort: parseInt(process.env.MEDIASOUP_RTC_MAX_PORT || '10100'),
    logLevel: (process.env.MEDIASOUP_LOG_LEVEL || 'warn') as any,
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'] as any[],
  },

  // Router media codecs
  routerMediaCodecs: [
    {
      kind: 'audio' as const,
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
    },
    {
      kind: 'video' as const,
      mimeType: 'video/VP8',
      clockRate: 90000,
      parameters: {
        'x-google-start-bitrate': 1000,
      },
    },
    {
      kind: 'video' as const,
      mimeType: 'video/H264',
      clockRate: 90000,
      parameters: {
        'packetization-mode': 1,
        'profile-level-id': '42e01f',
        'level-asymmetry-allowed': 1,
        'x-google-start-bitrate': 1000,
      },
    },
  ],

  // WebRTC transport settings
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || undefined,
      },
    ],
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
    maxSctpMessageSize: 262144,
    maxIncomingBitrate: 1500000,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  },
};
