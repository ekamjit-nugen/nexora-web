"use client";

import { useState } from "react";

interface BreakoutRoom {
  id: string;
  name: string;
  participants: string[];
  status: string;
}

interface BreakoutRoomsProps {
  rooms: BreakoutRoom[];
  isHost: boolean;
  currentUserId: string;
  participantNames: Record<string, string>;
  onOpen: () => void;
  onClose: () => void;
  onMoveParticipant: (userId: string, roomId: string) => void;
  onBroadcast: (message: string) => void;
}

export function BreakoutRooms({
  rooms, isHost, currentUserId, participantNames,
  onOpen, onClose, onMoveParticipant, onBroadcast,
}: BreakoutRoomsProps) {
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [showBroadcast, setShowBroadcast] = useState(false);

  const activeRooms = rooms.filter(r => r.status === "active");
  const pendingRooms = rooms.filter(r => r.status === "pending");
  const allPending = rooms.length > 0 && pendingRooms.length === rooms.length;
  const allActive = rooms.length > 0 && activeRooms.length === rooms.length;

  const currentRoom = rooms.find(r => r.participants.includes(currentUserId));

  return (
    <div className="bg-slate-800/95 backdrop-blur-sm rounded-xl border border-slate-700 w-72 shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-white">Breakout Rooms</h3>
        <span className="text-xs text-slate-400">{rooms.length} rooms</span>
      </div>

      {/* Host controls */}
      {isHost && (
        <div className="px-4 py-2 border-b border-slate-700 flex gap-2">
          {allPending && (
            <button onClick={onOpen} className="flex-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">
              Open All
            </button>
          )}
          {allActive && (
            <button onClick={onClose} className="flex-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700">
              Close All
            </button>
          )}
          <button
            onClick={() => setShowBroadcast(!showBroadcast)}
            className="px-3 py-1.5 bg-slate-700 text-white text-xs rounded-lg hover:bg-slate-600"
          >
            Broadcast
          </button>
        </div>
      )}

      {/* Broadcast input */}
      {showBroadcast && isHost && (
        <div className="px-4 py-2 border-b border-slate-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={broadcastMsg}
              onChange={e => setBroadcastMsg(e.target.value)}
              placeholder="Message to all rooms..."
              className="flex-1 text-xs px-2 py-1.5 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => { onBroadcast(broadcastMsg); setBroadcastMsg(""); setShowBroadcast(false); }}
              disabled={!broadcastMsg.trim()}
              className="px-2 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Room list */}
      <div className="max-h-60 overflow-y-auto">
        {rooms.map(room => (
          <div key={room.id} className="px-4 py-2 border-b border-slate-700/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-white">{room.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                room.status === "active" ? "bg-green-600/20 text-green-400" :
                room.status === "closed" ? "bg-red-600/20 text-red-400" :
                "bg-yellow-600/20 text-yellow-400"
              }`}>
                {room.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {room.participants.map(userId => (
                <span key={userId} className={`text-[10px] px-1.5 py-0.5 rounded ${
                  userId === currentUserId ? "bg-blue-600/30 text-blue-300" : "bg-slate-700 text-slate-300"
                }`}>
                  {participantNames[userId] || userId.slice(-6)}
                </span>
              ))}
              {room.participants.length === 0 && (
                <span className="text-[10px] text-slate-500 italic">Empty</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Current room indicator for non-hosts */}
      {!isHost && currentRoom && (
        <div className="px-4 py-2 bg-blue-600/10 border-t border-slate-700">
          <p className="text-xs text-blue-300">
            You are in: <strong>{currentRoom.name}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
