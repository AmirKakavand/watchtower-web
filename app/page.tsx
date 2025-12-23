"use client";

import { useState, useEffect } from "react";
import { Watchtower } from "@/lib/watchtower";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  UploadCloud,
  Activity,
  Settings,
  Terminal,
  Zap,
  Cpu,
  X,
  Wifi,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// --- Utility for Tailwind classes ---
function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// --- Animation Styles (Injected) ---
// We inject these keyframes here to ensure they work without modifying globals.css
const RETRO_STYLES = `
  @keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100%); }
  }
  @keyframes blink-random {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  @keyframes signal-bounce {
    0%, 100% { height: 10%; }
    50% { height: 90%; }
  }
  @keyframes ticker {
    0% { transform: translateX(100%); }
    100% { transform: translateX(-100%); }
  }
  @keyframes laser-scan {
    0% { top: 0%; opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
  .animate-scanline {
    animation: scanline 8s linear infinite;
  }
  .animate-ticker {
    animation: ticker 20s linear infinite;
  }
  .animate-laser {
    animation: laser-scan 2s ease-in-out infinite;
  }
`;

// --- Micro-Components ---

function SignalVisualizer() {
  return (
    <div className="flex items-end gap-[2px] h-6">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="w-1.5 bg-[#FFFF00] border border-black/20"
          style={{
            animation: `signal-bounce ${
              0.5 + Math.random() * 0.5
            }s infinite ease-in-out`,
            animationDelay: `-${Math.random()}s`,
          }}
        />
      ))}
    </div>
  );
}

function BlinkingLEDs() {
  return (
    <div className="flex gap-1.5">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-2.5 h-2.5 border border-gray-600 rounded-full",
            i === 0 ? "bg-[#ff5555]" : i === 1 ? "bg-[#FFFF00]" : "bg-[#00ff00]"
          )}
          style={{
            animation: `blink-random ${1 + Math.random()}s infinite step-end`,
            animationDelay: `-${Math.random()}s`,
          }}
        />
      ))}
    </div>
  );
}

function RetroCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon?: any;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-[#2dd4bf] border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden",
        className
      )}
    >
      {/* Title Bar */}
      <div className="bg-black text-white px-3 py-2 flex items-center justify-between border-b-2 border-black select-none relative z-10">
        <div className="flex items-center gap-2 font-mono font-bold uppercase tracking-wider text-sm">
          {Icon && <Icon size={16} className="text-[#FFFF00]" />}
          <span>{title}</span>
        </div>
        <BlinkingLEDs />
      </div>
      {/* Content Body */}
      <div className="p-6 font-mono text-black relative z-10">{children}</div>
    </div>
  );
}

function RetroButton({
  onClick,
  disabled,
  children,
  variant = "primary",
  className,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full px-4 py-3 font-mono font-bold text-sm uppercase border-2 border-black transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden group",
        isPrimary
          ? "bg-[#FFFF00] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-[#ffe600]"
          : "bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50",
        className
      )}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}

function StatusBadge({ status }: { status: "ALLOW" | "BLOCK" | "IDLE" }) {
  if (status === "IDLE")
    return (
      <div className="inline-block px-2 py-1 bg-gray-200 border border-black text-xs font-mono text-gray-500 animate-pulse">
        WAITING_FOR_INPUT...
      </div>
    );

  const isSafe = status === "ALLOW";
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1 border-2 border-black text-xs font-mono font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
        isSafe ? "bg-white text-black" : "bg-[#ff5555] text-white"
      )}
    >
      {isSafe ? (
        <>
          <ShieldCheck size={14} /> <span>PERMITTED</span>
        </>
      ) : (
        <>
          <ShieldAlert size={14} /> <span>RESTRICTED</span>
        </>
      )}
    </div>
  );
}

export default function WatchtowerDashboard() {
  const [isInitialized, setIsInitialized] = useState(false);

  // Text State
  const [textInput, setTextInput] = useState("");
  const [textStatus, setTextStatus] = useState<"IDLE" | "ALLOW" | "BLOCK">(
    "IDLE"
  );
  const [isCheckingText, setIsCheckingText] = useState(false);

  // Image State
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageStatus, setImageStatus] = useState<"IDLE" | "ALLOW" | "BLOCK">(
    "IDLE"
  );
  const [imageDetails, setImageDetails] = useState<any>(null);
  const [isCheckingImage, setIsCheckingImage] = useState(false);

  // -- Initialization --
  useEffect(() => {
    Watchtower.init("mock-api-key", {
      apiBaseUrl: "/api/watchtower",
      policyRefreshSeconds: 300,
    });
    Watchtower.refreshPolicy().then(() => setIsInitialized(true));
  }, []);

  // -- Handlers --
  const handleTextCheck = async () => {
    if (!textInput.trim()) return;
    setIsCheckingText(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      const allowed = await Watchtower.checkText(textInput, {
        userId: "demo-user",
      });
      setTextStatus(allowed ? "ALLOW" : "BLOCK");
    } finally {
      setIsCheckingText(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);
    setImageStatus("IDLE");
    setImageDetails(null);
    setIsCheckingImage(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      await new Promise((r) => setTimeout(r, 1500)); // Longer delay to show off laser
      const result = await Watchtower.checkImageJpeg(uint8Array, {
        contentId: file.name,
      });
      setImageStatus(result.decision);
      setImageDetails(result);
    } finally {
      setIsCheckingImage(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-[#008080] flex items-center justify-center font-mono">
        <style>{RETRO_STYLES}</style>
        <div className="bg-white border-2 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center max-w-sm relative overflow-hidden">
          <div className="absolute inset-0 bg-black/5 animate-scanline pointer-events-none h-[200%]" />
          <Loader2 className="animate-spin mx-auto mb-4 text-black" size={48} />
          <h2 className="text-xl font-bold uppercase mb-2">System Boot</h2>
          <p className="text-sm text-gray-600 animate-pulse">
            Loading Modules...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#404040] p-4 md:p-8 font-mono selection:bg-[#FFFF00] selection:text-black overflow-hidden relative">
      <style>{RETRO_STYLES}</style>

      {/* --- CRT Overlay Effects --- */}
      {/* 1. Grid Background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      {/* 2. Scanline moving down */}
      <div className="fixed inset-0 pointer-events-none bg-gradient-to-b from-transparent via-black/5 to-transparent h-[20px] w-full animate-scanline z-50 opacity-30" />
      {/* 3. Vignette */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle,transparent_60%,rgba(0,0,0,0.4)_100%)] z-40" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Ticker Tape */}
        <div className="w-full bg-black border-2 border-black text-[#00ff00] text-xs py-1 overflow-hidden whitespace-nowrap font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="animate-ticker inline-block w-full">
            System_Check: OK // Node_01: Connected // Latency: 24ms //
            Security_Protocol: ACTIVE // Watchtower_SDK: Ready...
          </div>
        </div>

        {/* Header Block */}
        <header className="bg-white border-2 border-black p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-black text-[#FFFF00] flex items-center justify-center border-2 border-black shadow-[inset_0_0_10px_rgba(255,255,0,0.3)]">
              <Terminal size={32} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight leading-none">
                Watchtower
              </h1>
              <p className="text-xs font-bold text-gray-500 mt-1 uppercase flex items-center gap-2">
                <span>Console V2.4</span>
                <span className="w-1 h-1 bg-black rounded-full" />
                <span className="animate-pulse text-emerald-600">LIVE</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-3 bg-gray-100 border-2 border-black px-3 py-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="w-3 h-3 bg-[#00ff00] border border-black animate-[blink-random_0.5s_infinite]" />
              <span className="text-xs font-bold uppercase">System Online</span>
            </div>
            <div className="text-[10px] uppercase font-bold text-gray-400">
              Mem_Usage: 14%
            </div>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Text Moderation Card */}
          <RetroCard title="Text_Analysis.exe" icon={Activity}>
            <div className="flex justify-between items-start mb-4 border-b-2 border-black pb-4 border-dashed">
              <div>
                <h3 className="font-bold text-lg uppercase">Input Buffer</h3>
                <p className="text-xs text-gray-700 max-w-[200px] leading-tight mt-1">
                  Enter text string for toxicity evaluation.
                </p>
              </div>
              <StatusBadge status={textStatus} />
            </div>

            <div className="space-y-4">
              <div className="relative group">
                {/* Blinking Cursor Fake Overlay if empty */}
                {!textInput && (
                  <div className="absolute top-4 left-4 pointer-events-none text-sm text-gray-400">
                    &gt; WAITING_FOR_INPUT
                    <span className="animate-pulse">_</span>
                  </div>
                )}
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="w-full h-40 bg-[#fffae0] border-2 border-black p-4 text-sm focus:outline-none focus:bg-[#fff9d6] resize-none font-mono shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.1)] uppercase"
                />
              </div>

              <div className="flex gap-4">
                <RetroButton
                  onClick={handleTextCheck}
                  disabled={isCheckingText || !textInput}
                >
                  {isCheckingText ? (
                    <span className="animate-pulse">PROCESSING...</span>
                  ) : (
                    <>
                      Run_Scan <Zap size={16} fill="black" />
                    </>
                  )}
                </RetroButton>
                <RetroButton
                  variant="secondary"
                  onClick={() => {
                    setTextInput("");
                    setTextStatus("IDLE");
                  }}
                  disabled={!textInput}
                >
                  <X size={16} /> RESET
                </RetroButton>
              </div>
            </div>
          </RetroCard>

          {/* Image Moderation Card */}
          <RetroCard title="Visual_Rec.sys" icon={UploadCloud}>
            <div className="flex justify-between items-start mb-4 border-b-2 border-black pb-4 border-dashed">
              <div>
                <h3 className="font-bold text-lg uppercase">Visual Buffer</h3>
                <p className="text-xs text-gray-700 max-w-[200px] leading-tight mt-1">
                  Upload JPEG bitmap for NSFW classification.
                </p>
              </div>
              <StatusBadge status={imageStatus} />
            </div>

            <div className="space-y-4">
              {/* Image Input Area */}
              <div className="relative w-full h-64 bg-white border-2 border-black flex flex-col items-center justify-center group overflow-hidden shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                {imagePreview ? (
                  <>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className={cn(
                        "w-full h-full object-contain p-2 transition-opacity",
                        isCheckingImage ? "opacity-80 grayscale" : ""
                      )}
                    />

                    {/* THE SCANNING LASER EFFECT */}
                    {isCheckingImage && (
                      <div className="absolute inset-0 z-30 pointer-events-none">
                        <div className="w-full h-1 bg-[#00ff00] shadow-[0_0_15px_#00ff00] animate-laser absolute" />
                        <div className="absolute top-2 right-2 bg-black text-[#00ff00] text-xs px-2 py-1 font-bold animate-pulse border border-[#00ff00]">
                          SCANNING...
                        </div>
                      </div>
                    )}

                    {/* Grid overlay on image */}
                    <div
                      className="absolute inset-0 pointer-events-none opacity-20"
                      style={{
                        backgroundImage:
                          "linear-gradient(rgba(0,255,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,0,0.5) 1px, transparent 1px)",
                        backgroundSize: "40px 40px",
                      }}
                    />
                  </>
                ) : (
                  <div className="text-center p-6 space-y-2 border-2 border-dashed border-gray-300 m-4 w-[90%] h-[80%] flex flex-col items-center justify-center hover:border-black transition-colors">
                    <UploadCloud
                      size={48}
                      className="text-gray-300 mb-2 group-hover:text-black"
                    />
                    <p className="font-bold text-sm uppercase">
                      Insert Tape / File
                    </p>
                    <p className="text-xs text-gray-500">
                      FORMAT: JPEG // MAX: 5MB
                    </p>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/jpeg"
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                />
              </div>

              {/* Analysis Details - Retro Console Style */}
              {imageDetails && (
                <div className="bg-black text-[#00ff00] p-3 text-xs font-mono border-2 border-gray-700 shadow-[inset_0px_2px_4px_rgba(0,0,0,0.5)] h-24 overflow-y-auto">
                  <div className="mb-1 border-b border-gray-700 pb-1 text-gray-400 flex justify-between">
                    <span>RESULTS.LOG</span>
                    <span>{new Date().toLocaleTimeString()}</span>
                  </div>
                  <div className="space-y-1 mt-2">
                    <div className="flex justify-between">
                      <span className="opacity-70">&gt; NSFW_PROBABILITY:</span>
                      <span
                        className={
                          imageDetails.nsfwScore > 0.85
                            ? "text-red-500 font-bold bg-red-900/30 px-1 blink"
                            : "text-[#00ff00]"
                        }
                      >
                        {(imageDetails.nsfwScore * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-70">&gt; DETECTED_FLAGS:</span>
                      <span>
                        {imageDetails.reasons.length
                          ? `[${imageDetails.reasons.join(", ").toUpperCase()}]`
                          : "NULL"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </RetroCard>
        </div>

        {/* Configuration Footer with Signal Waves */}
        <footer className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-300 border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-xs font-black uppercase mb-2 flex items-center gap-2 border-b border-black pb-1">
              <Settings size={12} /> Policy_Config
            </h3>
            <div className="space-y-1 text-xs font-mono font-bold">
              <div className="flex justify-between items-center">
                <span>TOXICITY_FILTER:</span>
                <span className="w-2 h-2 bg-[#00ff00] rounded-full animate-pulse shadow-[0_0_5px_#00ff00]"></span>
              </div>
              <div className="flex justify-between items-center">
                <span>NSFW_FILTER:</span>
                <span className="w-2 h-2 bg-[#00ff00] rounded-full animate-pulse shadow-[0_0_5px_#00ff00]"></span>
              </div>
            </div>
          </div>

          <div className="bg-gray-300 border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-xs font-black uppercase mb-2 flex items-center gap-2 border-b border-black pb-1">
              <Wifi size={12} /> Network_Activity
            </h3>
            <div className="flex justify-between items-end h-10 pb-1">
              <div
                className="text-[10px] font-bold self-center mr-2 rotate-180"
                style={{ writingMode: "vertical-rl" }}
              >
                dB Gain
              </div>
              {/* The fake signal wave */}
              <SignalVisualizer />
            </div>
          </div>

          <div className="bg-gray-300 border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
            <div className="text-[10px] uppercase font-bold text-gray-600 leading-tight">
              Secure connection established via HTTPS. Data encryption active.
            </div>
            <div className="mt-2 text-right">
              <span className="bg-[#FFFF00] text-black border border-black px-2 py-0.5 text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                V 1.0.4
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
