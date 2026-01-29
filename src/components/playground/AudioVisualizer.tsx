"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface VisualizerProps {
    analyser: AnalyserNode | null;
    mode: "oscilloscope" | "spectrum";
    className?: string;
    color?: string;
}

export default function AudioVisualizer({
    analyser,
    mode,
    className,
    color = "#12a150"
}: VisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (!analyser || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            rafRef.current = requestAnimationFrame(draw);

            const width = canvas.width;
            const height = canvas.height;

            ctx.clearRect(0, 0, width, height);

            if (mode === "oscilloscope") {
                analyser.getByteTimeDomainData(dataArray);
                ctx.lineWidth = 2;
                ctx.strokeStyle = color;
                ctx.shadowBlur = 4;
                ctx.shadowColor = color;
                ctx.beginPath();

                const sliceWidth = width / bufferLength;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = (v * height) / 2;

                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);

                    x += sliceWidth;
                }

                ctx.lineTo(width, height / 2);
                ctx.stroke();
                ctx.shadowBlur = 0; // Reset shadow
            } else {
                analyser.getByteFrequencyData(dataArray);
                const barWidth = (width / bufferLength) * 2.5;
                let x = 0;

                // Create a vertical gradient for the bars
                const gradient = ctx.createLinearGradient(0, 0, 0, height);
                gradient.addColorStop(0, color);
                gradient.addColorStop(1, `${color}00`); // Fade to transparent

                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = (dataArray[i] / 255) * height;

                    // Draw Bar with Gradient
                    ctx.fillStyle = gradient;
                    ctx.globalAlpha = 0.8;
                    ctx.fillRect(x, height - barHeight, barWidth, barHeight);

                    // Draw "Peak" Cap
                    ctx.fillStyle = "#ffffff";
                    ctx.globalAlpha = 0.5;
                    ctx.fillRect(x, height - barHeight - 2, barWidth, 1);

                    x += barWidth + 1;
                }
                ctx.globalAlpha = 1.0; // Reset alpha
            }
        };

        draw();

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [analyser, mode, color]);

    return (
        <canvas
            ref={canvasRef}
            className={cn("w-full h-full bg-[#0b0f14] rounded-lg border border-[#2d333b]", className)}
            width={800}
            height={200}
        />
    );
}
