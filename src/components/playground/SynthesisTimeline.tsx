"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Scissors, Play, Pause, ChevronLeft, ChevronRight, GripVertical, Download } from "lucide-react";

interface SynthesisTimelineProps {
    chunks: Int16Array[];
    currentTime: number; // in seconds
    onSeek: (time: number) => void;
    onRangeChange: (start: number, end: number) => void;
    isPlaying: boolean;
    onTogglePlayback: () => void;
    onDownload: () => void;
    accentColor?: string;
    sampleRate: number;
}

export default function SynthesisTimeline({
    chunks,
    currentTime,
    onSeek,
    onRangeChange,
    isPlaying,
    onTogglePlayback,
    onDownload,
    accentColor = "#2f81f7",
    sampleRate
}: SynthesisTimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [range, setRange] = useState<[number, number]>([0, 0]);
    const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
    const [isDraggingStart, setIsDraggingStart] = useState(false);
    const [isDraggingEnd, setIsDraggingEnd] = useState(false);

    const [allAmplitudes, setAllAmplitudes] = useState<number[]>([]);

    // Total duration based on chunks and dynamic sample rate
    const totalDuration = useMemo(() => {
        let total = 0;
        for (const c of chunks) total += c.length;
        if (sampleRate <= 0) return 0;
        return total / (2 * sampleRate); // Stereo
    }, [chunks, sampleRate]);

    // Incremental amplitude calculation
    useEffect(() => {
        if (chunks.length > allAmplitudes.length) {
            const newChunks = chunks.slice(allAmplitudes.length);
            const newAmps = newChunks.map(chunk => {
                let sum = 0;
                // Sub-sample for performance
                const step = Math.max(1, Math.floor(chunk.length / 100));
                let count = 0;
                for (let i = 0; i < chunk.length; i += step) {
                    sum += (chunk[i] / 32768) ** 2;
                    count++;
                }
                return Math.sqrt(sum / count);
            });
            setAllAmplitudes(prev => [...prev, ...newAmps]);
        } else if (chunks.length === 0 && allAmplitudes.length > 0) {
            setAllAmplitudes([]);
        }
    }, [chunks]);

    // Map allAmplitudes to a fixed set of bars for the timeline width
    const bars = useMemo(() => {
        const barCount = 150;
        if (allAmplitudes.length === 0) return Array(barCount).fill(0);

        const result = [];
        const samplesPerBar = allAmplitudes.length / barCount;

        for (let i = 0; i < barCount; i++) {
            const start = Math.floor(i * samplesPerBar);
            const end = Math.floor((i + 1) * samplesPerBar);
            let sum = 0;
            let count = 0;
            for (let j = start; j < Math.min(end, allAmplitudes.length); j++) {
                sum += allAmplitudes[j];
                count++;
            }
            result.push(count > 0 ? sum / count : 0);
        }
        return result;
    }, [allAmplitudes]);

    // Update range when total duration grows
    useEffect(() => {
        setRange(currentRange => {
            // If it's the first data or we're roughly at the end
            if (currentRange[1] <= 0.1 || currentRange[1] >= totalDuration - 0.5) {
                const newEnd = totalDuration;
                const newStart = currentRange[1] === 0 ? 0 : currentRange[0];

                // Only trigger callback if values actually changed
                if (newStart !== currentRange[0] || newEnd !== currentRange[1]) {
                    // Defer the callback to avoid "cannot update while rendering"
                    setTimeout(() => onRangeChange(newStart, newEnd), 0);
                }
                return [newStart, newEnd];
            }
            return currentRange;
        });
    }, [totalDuration, onRangeChange]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        const time = percentage * totalDuration;

        if (isDraggingPlayhead) {
            onSeek(time);
        } else if (isDraggingStart) {
            const newStart = Math.max(0, Math.min(time, range[1] - 0.1));
            setRange([newStart, range[1]]);
            onRangeChange(newStart, range[1]);
        } else if (isDraggingEnd) {
            const newEnd = Math.min(totalDuration, Math.max(time, range[0] + 0.1));
            setRange([range[0], newEnd]);
            onRangeChange(range[0], newEnd);
        }
    }, [isDraggingPlayhead, isDraggingStart, isDraggingEnd, range, totalDuration, onSeek, onRangeChange]);

    useEffect(() => {
        const handleGlobalMouseUp = () => {
            setIsDraggingPlayhead(false);
            setIsDraggingStart(false);
            setIsDraggingEnd(false);
        };
        if (isDraggingPlayhead || isDraggingStart || isDraggingEnd) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [isDraggingPlayhead, isDraggingStart, isDraggingEnd, handleMouseMove]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onTogglePlayback}
                        className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-all active:scale-90"
                    >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black tracking-widest text-white/20 uppercase">Timeline Control</span>
                        <span className="text-xs font-mono text-white/60">
                            {formatTime(currentTime)} / {formatTime(totalDuration)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-4 py-2 border border-white/5">
                        <Scissors className="w-3.5 h-3.5 text-white/20" />
                        <span className="text-[10px] font-mono text-white/40">
                            SELECT: {formatTime(range[0])} — {formatTime(range[1])}
                        </span>
                        <span className="text-[10px] font-black text-white/20 ml-2 uppercase tracking-widest">
                            {(range[1] - range[0]).toFixed(1)}s
                        </span>
                    </div>

                    <button
                        onClick={onDownload}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black tracking-widest text-white/40 hover:text-white uppercase transition-all flex items-center gap-2"
                    >
                        <Download className="w-3.5 h-3.5" /> EXPORT
                    </button>
                </div>
            </div>

            <div
                ref={containerRef}
                className="relative h-20 bg-[#0d1117] rounded-2xl border border-white/5 overflow-hidden group cursor-crosshair shadow-inner"
                onMouseDown={(e) => {
                    const rect = containerRef.current!.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    onSeek((x / rect.width) * totalDuration);
                    setIsDraggingPlayhead(true);
                }}
            >
                {/* Waveform Visualization (Full History) */}
                <div className="absolute inset-0 flex items-center justify-between px-1 opacity-40 pointer-events-none">
                    {bars.map((amp, i) => (
                        <div
                            key={i}
                            className="bg-white/80 rounded-full"
                            style={{
                                width: '2px',
                                height: `${Math.max(12, amp * 180)}%`,
                                backgroundColor: i / bars.length > (currentTime / totalDuration) ? 'rgba(255,255,255,0.2)' : accentColor
                            }}
                        />
                    ))}
                </div>

                {/* Range Selection Overlay */}
                <div
                    className="absolute h-full bg-white/[0.04] border-x border-white/10 pointer-events-none"
                    style={{
                        left: `${(range[0] / totalDuration) * 100}%`,
                        width: `${((range[1] - range[0]) / totalDuration) * 100}%`
                    }}
                />

                {/* Playhead */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)] z-20 pointer-events-none"
                    style={{ left: `${(currentTime / totalDuration) * 100}%` }}
                >
                    <div className="absolute top-0 -translate-x-1/2 w-3 h-3 bg-white rounded-full border-2 border-black" />
                </div>

                {/* Range Handles */}
                <div
                    className="absolute top-0 bottom-0 w-8 -ml-4 z-30 cursor-ew-resize flex items-center justify-center group/handle"
                    style={{ left: `${(range[0] / totalDuration) * 100}%` }}
                    onMouseDown={(e) => { e.stopPropagation(); setIsDraggingStart(true); }}
                >
                    <div className="w-1.5 h-12 bg-white/10 group-hover/handle:bg-white/30 transition-all rounded-full flex flex-col items-center justify-center gap-1 border border-white/5">
                        <div className="w-0.5 h-0.5 bg-white/40 rounded-full" />
                        <div className="w-0.5 h-0.5 bg-white/40 rounded-full" />
                    </div>
                </div>

                <div
                    className="absolute top-0 bottom-0 w-8 -ml-4 z-30 cursor-ew-resize flex items-center justify-center group/handle"
                    style={{ left: `${(range[1] / totalDuration) * 100}%` }}
                    onMouseDown={(e) => { e.stopPropagation(); setIsDraggingEnd(true); }}
                >
                    <div className="w-1.5 h-12 bg-white/10 group-hover/handle:bg-white/30 transition-all rounded-full flex flex-col items-center justify-center gap-1 border border-white/5">
                        <div className="w-0.5 h-0.5 bg-white/40 rounded-full" />
                        <div className="w-0.5 h-0.5 bg-white/40 rounded-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function formatTime(secs: number) {
    if (isNaN(secs) || !isFinite(secs)) return "00:00.0";
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
}
