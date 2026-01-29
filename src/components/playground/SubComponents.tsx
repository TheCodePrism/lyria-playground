"use client";

import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalTooltip } from "@/components/ui/tooltip-portal";

export function FloatingPanel({ children, className, title, sub, icon, action, delay = 0 }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5, ease: "easeOut" }}
            className={cn(
                "bg-[#161b22]/70 backdrop-blur-3xl border border-white/5 rounded-[24px] p-8 shadow-2xl transition-all hover:bg-[#161b22]/80",
                className
            )}
        >
            {(title || icon) && (
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        {icon && <div className="p-2 rounded-lg bg-white/5 border border-white/5">{icon}</div>}
                        <div>
                            {title && <h2 className="text-sm font-bold">{title}</h2>}
                            {sub && <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">{sub}</p>}
                        </div>
                    </div>
                    {action}
                </div>
            )}
            {children}
        </motion.div>
    );
}

export function TagSection({ label, icon, items, activeItems, search, onToggle }: any) {
    const [isExpanded, setIsExpanded] = useState(false);
    const filtered = items.filter((it: string) => it.toLowerCase().includes(search.toLowerCase()));

    if (filtered.length === 0) return null;

    const limit = 12;
    const shown = isExpanded ? filtered : filtered.slice(0, limit);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
                {icon}
                <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">{label}</span>
                <span className="text-[9px] font-mono text-white/10 ml-auto">{filtered.length} TOTAL</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {shown.map((tag: string) => (
                    <button
                        key={tag}
                        onClick={() => onToggle(tag)}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border whitespace-nowrap",
                            activeItems.includes(tag)
                                ? "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                                : "bg-white/[0.03] text-white/40 border-white/5 hover:border-white/20 hover:text-white"
                        )}
                    >
                        {tag}
                    </button>
                ))}
            </div>
            {filtered.length > limit && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-[9px] font-black tracking-widest text-white/20 hover:text-white transition-colors uppercase px-1"
                >
                    {isExpanded ? "SHOW LESS" : `+${filtered.length - limit} MORE`}
                </button>
            )}
        </div>
    );
}

export function ControlSlider({ label, value, min, max, step, icon, onChange, activeColor = "#2f81f7" }: any) {
    return (
        <div className="space-y-4 group">
            <div className="flex justify-between items-center h-5">
                <div className="flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-widest transition-colors group-hover:text-white/40">
                    {icon} {label}
                </div>
                <span className="text-xs font-mono text-white/40 group-hover:text-white transition-colors">{value.toFixed(step < 1 ? 1 : 0)}</span>
            </div>
            <div className="relative h-1.5 flex items-center">
                <input
                    type="range" min={min} max={max} step={step} value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="w-full h-full bg-white/5 rounded-full appearance-none cursor-pointer accent-white hover:accent-white/80 transition-all"
                />
                <div className="absolute h-full pointer-events-none rounded-full" style={{ background: activeColor, width: `${((value - min) / (max - min)) * 100}%`, opacity: 0.3 }} />
            </div>
        </div>
    );
}

export function HelpTrigger({ text }: { text: string }) {
    const triggerRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            ref={triggerRef}
            className="cursor-help text-white/10 hover:text-white/40 transition-colors"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <HelpCircle className="w-3.5 h-3.5" />
            <PortalTooltip
                isOpen={isHovered && !!text}
                targetRef={triggerRef}
                placement="top"
                content={
                    <div className="bg-white text-black text-[10px] font-black uppercase tracking-widest py-2 px-4 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/10 flex items-center gap-2 text-center whitespace-normal max-w-[200px]">
                        <HelpCircle className="w-3 h-3 flex-shrink-0" />
                        {text}
                    </div>
                }
            />
        </div>
    );
}
