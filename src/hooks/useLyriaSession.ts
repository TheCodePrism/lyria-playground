"use client";

import { useState, useCallback, useRef } from "react";
import { GoogleGenAI } from "@google/genai";

interface LyriaConfig {
    apiKey: string;
    model: string;
    bpm: number;
    temperature: number;
    guidance: number;
    density: number;
    brightness: number;
    mode: string;
}

export function useLyriaSession() {
    const [session, setSession] = useState<any>(null);
    const [status, setStatus] = useState<"idle" | "connecting" | "playing" | "error" | "stopped">("idle");
    const [lastError, setLastError] = useState<string | null>(null);

    const sessionRef = useRef<any>(null);

    const connect = useCallback(async (
        config: LyriaConfig,
        prompts: { text: string; weight: number }[],
        onAudioChunk: (chunk: Float32Array) => void
    ) => {
        try {
            setStatus("connecting");
            setLastError(null);

            const genAI = new (GoogleGenAI as any)({
                apiKey: config.apiKey,
                apiVersion: "v1alpha"
            });

            const newSession = await genAI.live.music.connect({
                model: config.model,
                callbacks: {
                    onmessage: (message: any) => {
                        const chunks = message?.serverContent?.audioChunks;
                        if (chunks) {
                            console.log(`Lyria: Received ${chunks.length} chunks`);
                            chunks.forEach((c: any) => {
                                const f32 = base64PCM16ToFloat32(c.data);

                                // Signal detection
                                let max = 0;
                                for (let i = 0; i < f32.length; i++) {
                                    const abs = Math.abs(f32[i]);
                                    if (abs > max) max = abs;
                                }

                                if (max > 0) {
                                    onAudioChunk(f32);
                                } else {
                                    console.warn("Lyria: Received silent chunk (max amplitude 0)");
                                }
                            });
                        } else {
                            console.log("Lyria: Received non-audio message:", message);
                        }
                    },
                    onerror: (err: any) => {
                        const msg = err?.message || JSON.stringify(err);
                        setLastError(msg);
                        setStatus("error");
                    },
                    onclose: (event: any) => {
                        setStatus("stopped");
                    }
                }
            });

            await newSession.setWeightedPrompts({ weightedPrompts: prompts });
            await newSession.setMusicGenerationConfig({
                musicGenerationConfig: {
                    bpm: config.bpm,
                    temperature: config.temperature,
                    guidance: config.guidance,
                    density: config.density,
                    brightness: config.brightness,
                    musicGenerationMode: config.mode
                }
            });

            await newSession.play();

            sessionRef.current = newSession;
            setSession(newSession);
            setStatus("playing");

        } catch (err: any) {
            setLastError(err.message);
            setStatus("error");
            throw err;
        }
    }, []);

    const stop = useCallback(async () => {
        if (sessionRef.current) {
            try {
                await sessionRef.current.stop();
                await sessionRef.current.close?.();
            } catch (e) { }
            sessionRef.current = null;
            setSession(null);
            setStatus("stopped");
        }
    }, []);

    return {
        session,
        status,
        lastError,
        connect,
        stop,
    };
}

function base64PCM16ToFloat32(b64: string): Float32Array {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    const dv = new DataView(bytes.buffer);
    const out = new Float32Array(len >>> 1);
    for (let i = 0, j = 0; i < len; i += 2, j++) out[j] = dv.getInt16(i, true) / 32768;
    return out;
}
