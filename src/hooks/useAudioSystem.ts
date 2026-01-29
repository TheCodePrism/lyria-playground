"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export const TARGET_SR = 48000;
export const CHANNELS = 2;

export interface AudioMetrics {
    bufferSecs: number;
    underruns: number;
}

export function useAudioSystem() {
    const audioCtxRef = useRef<AudioContext | null>(null);
    const playerNodeRef = useRef<AudioWorkletNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const lpFilterRef = useRef<BiquadFilterNode | null>(null);
    const hpFilterRef = useRef<BiquadFilterNode | null>(null);

    const [isInitialized, setIsInitialized] = useState(false);
    const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
    const [ctxState, setCtxState] = useState<string>("none");
    const [playerNode, setPlayerNode] = useState<AudioWorkletNode | null>(null);
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
    const [gainNode, setGainNode] = useState<GainNode | null>(null);
    const [lpFilter, setLpFilter] = useState<BiquadFilterNode | null>(null);
    const [hpFilter, setHpFilter] = useState<BiquadFilterNode | null>(null);

    const [metrics, setMetrics] = useState<AudioMetrics>({ bufferSecs: 0, underruns: 0 });

    const initAudio = useCallback(async () => {
        if (audioCtxRef.current && playerNodeRef.current) {
            return {
                ctx: audioCtxRef.current,
                playerNode: playerNodeRef.current,
                analyser: analyserRef.current,
                gainNode: gainNodeRef.current,
                lpFilter: lpFilterRef.current,
                hpFilter: hpFilterRef.current
            };
        }

        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        let ctx: AudioContext;

        try {
            // Attempt to use system default sample rate first if 48k fails
            // Many consumer devices (Windows default) are 44.1k or 48k.
            ctx = new Ctx({ sampleRate: TARGET_SR });
        } catch (e) {
            console.warn("AudioContext: Failed to use 48000Hz, falling back to system default.", e);
            ctx = new Ctx(); // This will use the OS default (likely 44100 or 48000)
        }

        audioCtxRef.current = ctx;
        setAudioCtx(ctx);
        setCtxState(ctx.state);

        ctx.onstatechange = () => {
            console.log("AudioContext state change:", ctx.state);
            setCtxState(ctx.state);
        };

        try {
            await ctx.audioWorklet.addModule("/worklets/stream-player-processor.js");
        } catch (e) {
            console.error("AudioContext: Worklet module failed to load. Check public path.", e);
            throw e;
        }

        const pNode = new AudioWorkletNode(ctx, "stream-player", {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [CHANNELS],
        });
        playerNodeRef.current = pNode;
        setPlayerNode(pNode);

        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 20000;
        lpFilterRef.current = lp;
        setLpFilter(lp);

        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 20;
        hpFilterRef.current = hp;
        setHpFilter(hp);

        const gain = ctx.createGain();
        gain.gain.value = 1.0;
        gainNodeRef.current = gain;
        setGainNode(gain);

        const an = ctx.createAnalyser();
        an.fftSize = 2048;
        analyserRef.current = an;
        setAnalyser(an);

        pNode.connect(lp);
        lp.connect(hp);
        hp.connect(gain);
        gain.connect(an);
        an.connect(ctx.destination);

        pNode.port.onmessage = (e) => {
            if (e.data.type === "metrics") {
                setMetrics({
                    // Use actual sampleRate from ctx (might be different than TARGET_SR)
                    bufferSecs: e.data.length / (CHANNELS * ctx.sampleRate),
                    underruns: e.data.underruns,
                });
            }
        };

        setIsInitialized(true);
        return {
            ctx,
            playerNode: pNode,
            analyser: an,
            gainNode: gain,
            lpFilter: lp,
            hpFilter: hp
        };
    }, []);

    const resume = useCallback(async () => {
        if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
            try {
                await audioCtxRef.current.resume();
            } catch (e) {
                console.error("AudioContext: Resume failed.", e);
            }
        }
    }, []);

    const closeAudio = useCallback(() => {
        playerNodeRef.current?.disconnect();
        analyserRef.current?.disconnect();
        lpFilterRef.current?.disconnect();
        hpFilterRef.current?.disconnect();
        gainNodeRef.current?.disconnect();
        audioCtxRef.current?.close();

        audioCtxRef.current = null;
        setAudioCtx(null);
        setCtxState("closed");
        playerNodeRef.current = null;
        setPlayerNode(null);
        setAnalyser(null);
        setGainNode(null);
        setLpFilter(null);
        setHpFilter(null);
        setIsInitialized(false);
    }, []);

    return {
        isInitialized,
        metrics,
        initAudio,
        resume,
        closeAudio,
        audioCtx,
        ctxState,
        playerNode,
        analyser,
        gainNode,
        lpFilter,
        hpFilter,
    };
}
