'use client';

import React, { useState, useEffect } from 'react';

interface RecordingConsentBannerProps {
  isRecording: boolean;
  startedByName?: string;
  requireConsent?: boolean;
  onConsent?: () => void;
  onLeave?: () => void;
}

export default function RecordingConsentBanner({
  isRecording,
  startedByName,
  requireConsent = false,
  onConsent,
  onLeave,
}: RecordingConsentBannerProps) {
  const [hasConsented, setHasConsented] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (isRecording) {
      setShowBanner(true);
      setHasConsented(false);
    } else {
      setShowBanner(false);
    }
  }, [isRecording]);

  const handleConsent = () => {
    setHasConsented(true);
    onConsent?.();
  };

  if (!showBanner) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
          </span>
          <span className="font-semibold text-sm">REC</span>
        </div>
        <span className="text-sm">
          This {requireConsent ? 'meeting' : 'call'} is being recorded
          {startedByName ? ` by ${startedByName}` : ''}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {requireConsent && !hasConsented && (
          <>
            <button
              onClick={handleConsent}
              className="px-3 py-1.5 bg-white text-red-600 rounded text-xs font-medium hover:bg-red-50 transition-colors"
            >
              I Consent
            </button>
            <button
              onClick={onLeave}
              className="px-3 py-1.5 bg-red-800 text-white rounded text-xs font-medium hover:bg-red-900 transition-colors"
            >
              Leave
            </button>
          </>
        )}
        {hasConsented && (
          <span className="text-xs text-red-100">Consent acknowledged</span>
        )}
      </div>
    </div>
  );
}
