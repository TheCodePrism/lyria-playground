"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface PortalTooltipProps {
    content: React.ReactNode;
    isOpen: boolean;
    targetRef: React.RefObject<HTMLElement | null>;
    placement?: "top" | "bottom" | "left" | "right";
}

export function PortalTooltip({ content, isOpen, targetRef, placement = "top" }: PortalTooltipProps) {
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen && targetRef.current) {
            const rect = targetRef.current.getBoundingClientRect();
            const scrollY = window.scrollY;
            const scrollX = window.scrollX;

            let top = 0;
            let left = 0;

            // Basic positioning logic (center alignment)
            if (placement === "top") {
                top = rect.top + scrollY - 10; // 10px offset
                left = rect.left + scrollX + rect.width / 2;
            } else if (placement === "bottom") {
                top = rect.bottom + scrollY + 10;
                left = rect.left + scrollX + rect.width / 2;
            }

            setCoords({ top, left });
        }
    }, [isOpen, targetRef, placement]);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    style={{
                        position: "absolute",
                        top: coords.top,
                        left: coords.left,
                        transform: placement === "top" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
                        zIndex: 9999,
                        pointerEvents: "none",
                    }}
                >
                    {content}
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
