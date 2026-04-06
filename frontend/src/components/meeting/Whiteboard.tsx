"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

// ── Types ──

type ToolType = "pen" | "rectangle" | "circle" | "line" | "arrow" | "text" | "sticky" | "eraser";

interface WhiteboardElement {
  id: string;
  type: "freehand" | "rectangle" | "circle" | "arrow" | "line" | "text" | "sticky";
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: Array<{ x: number; y: number }>;
  text?: string;
  color: string;
  strokeWidth: number;
  createdBy: string;
  createdAt: Date;
}

interface RemoteCursor {
  userId: string;
  userName: string;
  x: number;
  y: number;
  color: string;
}

interface WhiteboardProps {
  meetingId: string;
  userId: string;
  userName: string;
  isHost?: boolean;
  onClose: () => void;
  /** Emit whiteboard events to the meeting WebSocket */
  onEmit?: (event: string, data: unknown) => void;
  /** Subscribe to whiteboard events from the meeting WebSocket — returns unsubscribe fn */
  onSubscribe?: (event: string, handler: (data: unknown) => void) => () => void;
}

// ── Constants ──

const COLORS = [
  { name: "Black", value: "#000000" },
  { name: "Red", value: "#EF4444" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#22C55E" },
  { name: "Orange", value: "#F97316" },
  { name: "Purple", value: "#A855F7" },
  { name: "Pink", value: "#EC4899" },
  { name: "Gray", value: "#6B7280" },
];

const STROKE_WIDTHS = [
  { label: "Thin", value: 2 },
  { label: "Medium", value: 4 },
  { label: "Thick", value: 6 },
];

const STICKY_COLORS = ["#FEF08A", "#BBF7D0", "#BFDBFE", "#FBCFE8", "#FED7AA"];

const CURSOR_COLORS = ["#EF4444", "#3B82F6", "#22C55E", "#F97316", "#A855F7", "#EC4899"];

function generateId(): string {
  return `wb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── Component ──

export function Whiteboard({
  meetingId,
  userId,
  userName,
  isHost = false,
  onClose,
  onEmit,
  onSubscribe,
}: WhiteboardProps) {
  // State
  const [tool, setTool] = useState<ToolType>("pen");
  const [color, setColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState("");
  const [stickyInput, setStickyInput] = useState<{ x: number; y: number; color: string } | null>(null);
  const [stickyText, setStickyText] = useState("");

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentElementRef = useRef<WhiteboardElement | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  // ── Assign a cursor color based on the userId hash ──
  const myCursorColor = CURSOR_COLORS[
    userId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % CURSOR_COLORS.length
  ];

  // ── Canvas Rendering ──

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // White background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render all elements
    for (const el of elements) {
      renderElement(ctx, el);
    }

    // Render element being drawn
    if (currentElementRef.current) {
      renderElement(ctx, currentElementRef.current);
    }

    // Render remote cursors
    for (const cursor of remoteCursors) {
      ctx.save();
      ctx.fillStyle = cursor.color;
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Name label
      ctx.font = "11px sans-serif";
      ctx.fillStyle = cursor.color;
      const textWidth = ctx.measureText(cursor.userName).width;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(cursor.x + 8, cursor.y - 6, textWidth + 8, 16);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(cursor.userName, cursor.x + 12, cursor.y + 5);
      ctx.restore();
    }
  }, [elements, remoteCursors]);

  function renderElement(ctx: CanvasRenderingContext2D, el: WhiteboardElement) {
    ctx.save();
    ctx.strokeStyle = el.color;
    ctx.fillStyle = el.color;
    ctx.lineWidth = el.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (el.type) {
      case "freehand": {
        if (el.points && el.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          for (let i = 1; i < el.points.length; i++) {
            ctx.lineTo(el.points[i].x, el.points[i].y);
          }
          ctx.stroke();
        }
        break;
      }
      case "rectangle": {
        const w = el.width || 0;
        const h = el.height || 0;
        ctx.strokeRect(el.x, el.y, w, h);
        break;
      }
      case "circle": {
        const w = el.width || 0;
        const h = el.height || 0;
        const rx = Math.abs(w) / 2;
        const ry = Math.abs(h) / 2;
        const cx = el.x + w / 2;
        const cy = el.y + h / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "line": {
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x + (el.width || 0), el.y + (el.height || 0));
        ctx.stroke();
        break;
      }
      case "arrow": {
        const endX = el.x + (el.width || 0);
        const endY = el.y + (el.height || 0);
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        // Arrowhead
        const angle = Math.atan2(endY - el.y, endX - el.x);
        const headLen = 12;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLen * Math.cos(angle - Math.PI / 6),
          endY - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLen * Math.cos(angle + Math.PI / 6),
          endY - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
        break;
      }
      case "text": {
        ctx.font = `${Math.max(14, el.strokeWidth * 4)}px sans-serif`;
        ctx.fillText(el.text || "", el.x, el.y);
        break;
      }
      case "sticky": {
        const sw = el.width || 140;
        const sh = el.height || 100;
        ctx.fillStyle = el.color;
        ctx.fillRect(el.x, el.y, sw, sh);
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1;
        ctx.strokeRect(el.x, el.y, sw, sh);
        // Text inside
        if (el.text) {
          ctx.fillStyle = "#000000";
          ctx.font = "13px sans-serif";
          const lines = el.text.split("\n");
          for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], el.x + 8, el.y + 20 + i * 16, sw - 16);
          }
        }
        break;
      }
    }
    ctx.restore();
  }

  // Re-render when elements or cursors change
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // ── Resize canvas to fit container ──

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      renderCanvas();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [renderCanvas]);

  // ── WebSocket subscriptions for remote events ──

  useEffect(() => {
    if (!onSubscribe) return;
    const cleanups: Array<() => void> = [];

    cleanups.push(
      onSubscribe("whiteboard:element:add", (data: unknown) => {
        const el = data as WhiteboardElement;
        setElements((prev) => [...prev, el]);
      })
    );

    cleanups.push(
      onSubscribe("whiteboard:element:remove", (data: unknown) => {
        const { elementId } = data as { elementId: string };
        setElements((prev) => prev.filter((e) => e.id !== elementId));
      })
    );

    cleanups.push(
      onSubscribe("whiteboard:clear", () => {
        setElements([]);
      })
    );

    cleanups.push(
      onSubscribe("whiteboard:cursor", (data: unknown) => {
        const cursor = data as RemoteCursor;
        if (cursor.userId === userId) return;
        setRemoteCursors((prev) => {
          const filtered = prev.filter((c) => c.userId !== cursor.userId);
          return [...filtered, cursor];
        });
      })
    );

    return () => cleanups.forEach((fn) => fn());
  }, [onSubscribe, userId]);

  // ── Drawing helpers ──

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const emitElement = (el: WhiteboardElement) => {
    onEmit?.("whiteboard:element:add", { meetingId, element: el });
  };

  const emitCursor = (x: number, y: number) => {
    onEmit?.("whiteboard:cursor", {
      meetingId,
      userId,
      userName,
      x,
      y,
      color: myCursorColor,
    });
  };

  // ── Pointer event handlers ──

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    const point = getCanvasPoint(e);
    startPointRef.current = point;

    if (tool === "text") {
      setTextInput(point);
      setTextValue("");
      return;
    }

    if (tool === "sticky") {
      const stickyColor = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
      setStickyInput({ ...point, color: stickyColor });
      setStickyText("");
      return;
    }

    setIsDrawing(true);

    if (tool === "eraser") {
      // Find and remove the nearest element
      const threshold = 15;
      setElements((prev) => {
        const toRemove = prev.find((el) => {
          if (el.type === "freehand" && el.points) {
            return el.points.some(
              (p) => Math.abs(p.x - point.x) < threshold && Math.abs(p.y - point.y) < threshold
            );
          }
          const elRight = el.x + (el.width || 20);
          const elBottom = el.y + (el.height || 20);
          return point.x >= el.x - threshold && point.x <= elRight + threshold &&
                 point.y >= el.y - threshold && point.y <= elBottom + threshold;
        });
        if (toRemove) {
          onEmit?.("whiteboard:element:remove", { meetingId, elementId: toRemove.id });
          return prev.filter((e) => e.id !== toRemove.id);
        }
        return prev;
      });
      return;
    }

    const newElement: WhiteboardElement = {
      id: generateId(),
      type: tool === "pen" ? "freehand" : tool,
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      points: tool === "pen" ? [point] : undefined,
      color,
      strokeWidth,
      createdBy: userId,
      createdAt: new Date(),
    };
    currentElementRef.current = newElement;
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    const point = getCanvasPoint(e);

    // Emit cursor position (throttled naturally by animation frames)
    emitCursor(point.x, point.y);

    if (!isDrawing || !currentElementRef.current || !startPointRef.current) return;

    const el = currentElementRef.current;

    if (el.type === "freehand") {
      el.points = [...(el.points || []), point];
    } else {
      el.width = point.x - startPointRef.current.x;
      el.height = point.y - startPointRef.current.y;
    }

    currentElementRef.current = { ...el };
    renderCanvas();
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentElementRef.current) {
      setIsDrawing(false);
      return;
    }

    const el = currentElementRef.current;
    setElements((prev) => [...prev, el]);
    emitElement(el);
    currentElementRef.current = null;
    startPointRef.current = null;
    setIsDrawing(false);
  };

  // ── Text placement ──

  const commitText = () => {
    if (!textInput || !textValue.trim()) {
      setTextInput(null);
      return;
    }
    const el: WhiteboardElement = {
      id: generateId(),
      type: "text",
      x: textInput.x,
      y: textInput.y,
      text: textValue,
      color,
      strokeWidth,
      createdBy: userId,
      createdAt: new Date(),
    };
    setElements((prev) => [...prev, el]);
    emitElement(el);
    setTextInput(null);
    setTextValue("");
  };

  // ── Sticky note placement ──

  const commitSticky = () => {
    if (!stickyInput) {
      return;
    }
    const el: WhiteboardElement = {
      id: generateId(),
      type: "sticky",
      x: stickyInput.x,
      y: stickyInput.y,
      width: 140,
      height: 100,
      text: stickyText,
      color: stickyInput.color,
      strokeWidth: 1,
      createdBy: userId,
      createdAt: new Date(),
    };
    setElements((prev) => [...prev, el]);
    emitElement(el);
    setStickyInput(null);
    setStickyText("");
  };

  // ── Clear all (host only) ──

  const clearAll = () => {
    setElements([]);
    onEmit?.("whiteboard:clear", { meetingId });
  };

  // ── Export as PNG ──

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `whiteboard-${meetingId}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  // ── Tool definitions ──

  const tools: Array<{ id: ToolType; label: string; icon: React.ReactNode }> = [
    {
      id: "pen",
      label: "Pen",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
      ),
    },
    {
      id: "rectangle",
      label: "Rectangle",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="5" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "circle",
      label: "Circle",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      ),
    },
    {
      id: "line",
      label: "Line",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <line x1="4" y1="20" x2="20" y2="4" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "arrow",
      label: "Arrow",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
        </svg>
      ),
    },
    {
      id: "text",
      label: "Text",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      ),
    },
    {
      id: "sticky",
      label: "Sticky Note",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      id: "eraser",
      label: "Eraser",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50">
      {/* Tools sidebar */}
      <div className="w-14 bg-gray-900 flex flex-col items-center py-3 gap-1 border-r border-gray-700">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              tool === t.id
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="h-12 bg-gray-900 border-b border-gray-700 flex items-center px-4 gap-4">
          {/* Colors */}
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  color === c.value ? "border-white scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-gray-700" />

          {/* Stroke widths */}
          <div className="flex items-center gap-1">
            {STROKE_WIDTHS.map((sw) => (
              <button
                key={sw.value}
                onClick={() => setStrokeWidth(sw.value)}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  strokeWidth === sw.value
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                {sw.label}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-gray-700" />

          {/* Clear all (host only) */}
          {isHost && (
            <button
              onClick={clearAll}
              className="px-3 py-1 text-xs text-red-400 hover:bg-red-500/20 rounded transition-colors"
            >
              Clear All
            </button>
          )}

          <div className="flex-1" />

          {/* Export */}
          <button
            onClick={exportPng}
            className="px-3 py-1 text-xs text-gray-300 hover:bg-gray-800 rounded transition-colors"
          >
            Save as PNG
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            title="Close whiteboard"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 relative bg-white cursor-crosshair overflow-hidden">
          <canvas
            ref={canvasRef}
            className="absolute inset-0"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          />

          {/* Text input overlay */}
          {textInput && (
            <div
              className="absolute z-10"
              style={{ left: textInput.x, top: textInput.y }}
            >
              <input
                autoFocus
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitText();
                  if (e.key === "Escape") setTextInput(null);
                }}
                onBlur={commitText}
                className="border border-blue-500 bg-white px-2 py-1 text-sm outline-none min-w-[120px] shadow-lg rounded"
                style={{ color }}
                placeholder="Type text..."
              />
            </div>
          )}

          {/* Sticky note input overlay */}
          {stickyInput && (
            <div
              className="absolute z-10 shadow-lg rounded"
              style={{
                left: stickyInput.x,
                top: stickyInput.y,
                width: 140,
                backgroundColor: stickyInput.color,
              }}
            >
              <textarea
                autoFocus
                value={stickyText}
                onChange={(e) => setStickyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    commitSticky();
                  }
                  if (e.key === "Escape") setStickyInput(null);
                }}
                onBlur={commitSticky}
                className="w-full h-24 p-2 text-xs bg-transparent outline-none resize-none"
                placeholder="Type note..."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
