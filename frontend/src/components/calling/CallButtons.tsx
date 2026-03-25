"use client";

import React from "react";
import { Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CallButtonsProps {
  recipientName: string;
  onAudioCall: () => void;
  onVideoCall: () => void;
  isLoading?: boolean;
}

export function CallButtons({
  recipientName,
  onAudioCall,
  onVideoCall,
  isLoading = false,
}: CallButtonsProps) {
  return (
    <div className="flex gap-2">
      <Button
        onClick={onAudioCall}
        disabled={isLoading}
        variant="outline"
        size="sm"
        title={`Call ${recipientName}`}
      >
        <Phone className="h-4 w-4" />
      </Button>
      <Button
        onClick={onVideoCall}
        disabled={isLoading}
        variant="outline"
        size="sm"
        title={`Video call ${recipientName}`}
      >
        <Video className="h-4 w-4" />
      </Button>
    </div>
  );
}
