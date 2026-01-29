"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAudioSystem } from "@/hooks/useAudioSystem";
import { useLyriaSession } from "@/hooks/useLyriaSession";
import {
    Settings, Play, Square, Mic, Volume2, Activity, Zap,
    Terminal, Download, Filter, MessageSquare, Trash2, RotateCcw,
    Sparkles, Music, Sliders, Waves, Info, VolumeX, Eye, HelpCircle,
    LayoutGrid, Layers, Cpu, Heart, Guitar, Shuffle,
    Clock, FastForward, Rewind, PlayCircle, Scissors
} from "lucide-react";
import AudioVisualizer from "./AudioVisualizer";
import SynthesisTimeline from "./SynthesisTimeline";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { PortalTooltip } from "@/components/ui/tooltip-portal";

// External Modules
import {
    GENRES, MOODS, INSTS, ARCHETYPES, CONTROL_INFO
} from "../../constants/playgroundConstants";
import type { Archetype } from "../../constants/playgroundConstants";
import {
    float32ToInt16Array, makeWavBlobFromInt16
} from "../../services/audioUtils";
import {
    FloatingPanel, TagSection, ControlSlider, HelpTrigger
} from "./SubComponents";

export default function LyriaPlayground() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const {
        isInitialized, initAudio, resume, closeAudio,
        metrics, analyser, playerNode, gainNode,
        lpFilter, hpFilter, audioCtx, ctxState
    } = useAudioSystem();

    const { connect, stop, status } = useLyriaSession();

    // State
    const [apiKey, setApiKey] = useState("");
    const [model, setModel] = useState("models/lyria-realtime-exp");
    const [bpm, setBpm] = useState(90);
    const [temp, setTemp] = useState(1.0);
    const [guidance, setGuidance] = useState(4.0);
    const [density, setDensity] = useState(0.5);
    const [brightness, setBrightness] = useState(0.5);
    const [mode, setMode] = useState("QUALITY");
    const [volume, setVolume] = useState(1.0);
    const [isMuted, setIsMuted] = useState(false);
    const [lpFreq, setLpFreq] = useState(20000);
    const [hpFreq, setHpFreq] = useState(20);

    const [selGenres, setSelGenres] = useState<string[]>([]);
    const [selMoods, setSelMoods] = useState<string[]>([]);
    const [selInsts, setSelInsts] = useState<string[]>([]);

    const [promptText, setPromptText] = useState("Minimal techno with deep bass and atmospheric pads");
    const [negativePrompt, setNegativePrompt] = useState("");
    const [musicKey, setMusicKey] = useState("C");
    const [musicScale, setMusicScale] = useState("Major");
    const [seed, setSeed] = useState<number>(Math.floor(Math.random() * 1000000));

    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const isRecordingRef = useRef(false);
    const [isRecording, setIsRecording] = useState(false);
    const recordedChunksRef = useRef<Int16Array[]>([]);
    const totalSamplesRef = useRef(0);

    // Visualizer State
    const [vizMode, setVizMode] = useState<"oscilloscope" | "spectrum">("oscilloscope");
    const [accentColor, setAccentColor] = useState("#2f81f7");

    const [activeArchetype, setActiveArchetype] = useState<string | null>(null);

    // Voice / Interaction State
    const [isListening, setIsListening] = useState(false);
    const [ttsText, setTtsText] = useState("Ready to synthesize sound.");
    const [sttTranscript, setSttTranscript] = useState("");
    const [tagSearch, setTagSearch] = useState("");

    // Timeline & History State
    const [currentTime, setCurrentTime] = useState(0);
    const [selectedRange, setSelectedRange] = useState<[number, number]>([0, 0]);
    const [isHistoryPlaying, setIsHistoryPlaying] = useState(false);
    const historyPlayerRef = useRef<AudioBufferSourceNode | null>(null);
    const [recordedChunks, setRecordedChunks] = useState<Int16Array[]>([]);

    const addLog = useCallback((msg: string) => {
        setDebugLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`]);
    }, []);

    const applyArchetype = (arch: Archetype) => {
        setActiveArchetype(arch.id);
        setBpm(arch.config.bpm);
        setTemp(arch.config.temp);
        setGuidance(arch.config.guidance);
        setDensity(arch.config.density);
        setBrightness(arch.config.brightness);
        setAccentColor(arch.config.color);
        addLog(`Applied Archetype: ${arch.name}`);
    };

    const handleStart = async () => {
        const cleanKey = apiKey.trim();
        const cleanModel = model.trim();

        if (!cleanKey) return alert("Please enter an API Key");

        if (cleanKey.includes("#") || cleanModel.includes("#")) {
            return alert("Inputs cannot contain '#' character as it breaks WebSocket connections.");
        }

        try {
            addLog("Initializing audio system...");
            const engine = await initAudio();
            if (!engine) throw new Error("Audio Engine failed to initialize");

            const { ctx, playerNode: freshPlayerNode } = engine;

            if (ctx.state === "suspended") {
                addLog("Resuming suspended AudioContext...");
                await ctx.resume();
            }

            addLog(`Audio Engine: ${ctx.state.toUpperCase()} (${ctx.sampleRate}Hz)`);

            // Clear history on new start
            recordedChunksRef.current = [];
            totalSamplesRef.current = 0;
            setRecordedChunks([]);
            setCurrentTime(0);

            const config = {
                apiKey: cleanKey, model: cleanModel, bpm,
                temperature: temp, guidance, density, brightness, mode
            };

            const prompts = [{ text: promptText.trim(), weight: 1.0 }];

            let lastStateUpdate = 0;
            await connect(config, prompts, (f32) => {
                if (freshPlayerNode) {
                    // Always capture to history BEFORE transferring the buffer
                    // Transferring f32.buffer neuters it, making it unreadable here after the call.
                    const chunk = float32ToInt16Array(f32);
                    recordedChunksRef.current.push(chunk);
                    totalSamplesRef.current += chunk.length;

                    freshPlayerNode.port.postMessage({ type: 'push', samples: f32 }, [f32.buffer]);

                    // Throttle state updates for UI performance
                    const now = Date.now();
                    if (now - lastStateUpdate > 100) {
                        setRecordedChunks([...recordedChunksRef.current]);
                        lastStateUpdate = now;
                    }
                }
            });
            addLog("Session active. Monitor signal health below.");

        } catch (err: any) {
            addLog(`Error: ${err.message}`);
        }
    };

    const handleStop = async () => {
        addLog("Stopping session...");
        await stop();
        // NOT closing audio here so history playback still works
        setIsRecording(false);
        addLog("Session stopped.");
    };

    const toggleRecording = () => {
        if (!isRecordingRef.current) {
            isRecordingRef.current = true;
            setIsRecording(true);
            addLog("Now marking session for export...");
        } else {
            isRecordingRef.current = false;
            setIsRecording(false);
            addLog("Recording markers paused.");
        }
    };

    const downloadRecording = () => {
        if (recordedChunksRef.current.length === 0) return alert("Nothing recorded yet");
        addLog(`Preparing export for ${selectedRange[0].toFixed(1)}s - ${selectedRange[1].toFixed(1)}s...`);

        // Slice logic for partial export
        const sr = audioCtx?.sampleRate || 48000;
        const startSample = selectedRange[0] * sr * 2; // *2 for channels
        const endSample = selectedRange[1] * sr * 2;

        // Flatten and slice
        let flatLength = 0;
        for (const a of recordedChunksRef.current) flatLength += a.length;
        const flat = new Int16Array(flatLength);
        let offset = 0;
        for (const a of recordedChunksRef.current) { flat.set(a, offset); offset += a.length; }

        const sliced = flat.slice(startSample, endSample);
        const wav = makeWavBlobFromInt16([sliced], sr, 2);

        const url = URL.createObjectURL(wav);
        const a = document.createElement("a");
        a.href = url;
        a.download = `lyria-edit-${Date.now()}.wav`;
        a.click();
        URL.revokeObjectURL(url);
        addLog("Partial export complete.");
    };

    const stopHistory = useCallback(() => {
        if (historyPlayerRef.current) {
            historyPlayerRef.current.stop();
            historyPlayerRef.current = null;
        }
        setIsHistoryPlaying(false);
    }, []);

    const playHistoryFrom = useCallback((time: number) => {
        if (!audioCtx) {
            // If context was closed or not yet inited, we need to init it.
            // But we can't await here easily in a sync callback.
            // For now, we assume user must have started once.
            addLog("Error: Audio system not initialized. Press START once.");
            return;
        }
        stopHistory();

        // Convert recorded chunks to AudioBuffer
        const sr = audioCtx.sampleRate;
        const totalSamples = recordedChunksRef.current.reduce((acc, c) => acc + c.length, 0);

        if (totalSamples === 0) {
            addLog("No recorded audio to play.");
            setIsHistoryPlaying(false);
            return;
        }

        const buffer = audioCtx.createBuffer(2, Math.floor(totalSamples / 2), sr);

        // Populate channels
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);
        let offset = 0;
        for (const chunk of recordedChunksRef.current) {
            for (let i = 0; i < chunk.length; i += 2) {
                if (offset >= buffer.length) break;
                left[offset] = chunk[i] / 0x7FFF;
                right[offset] = chunk[i + 1] / 0x7FFF;
                offset++;
            }
        }

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;

        // Connect to gainNode instead of destination so volume slider works
        if (gainNode) {
            source.connect(gainNode);
        } else {
            source.connect(audioCtx.destination);
        }

        source.start(0, time);
        historyPlayerRef.current = source;
        setIsHistoryPlaying(true);

        source.onended = () => setIsHistoryPlaying(false);
    }, [audioCtx, gainNode, stopHistory, addLog]);

    const handleSeek = useCallback((time: number) => {
        setCurrentTime(time);
        if (isHistoryPlaying) {
            // Restart playback from new position
            playHistoryFrom(time);
        }
    }, [isHistoryPlaying, audioCtx, playHistoryFrom]);

    const handleRangeChange = useCallback((start: number, end: number) => {
        setSelectedRange([start, end]);
    }, []);

    const handleToggleHistoryPlayback = useCallback(() => {
        if (isHistoryPlaying) {
            stopHistory();
        } else {
            playHistoryFrom(currentTime);
        }
    }, [isHistoryPlaying, stopHistory, playHistoryFrom, currentTime]);
    useEffect(() => {
        let raf: number;
        let lastTime = Date.now();

        const tick = () => {
            if (isHistoryPlaying) {
                const now = Date.now();
                const delta = (now - lastTime) / 1000;
                setCurrentTime(prev => {
                    const next = prev + delta;
                    // Auto-stop if reached end of recorded memory
                    const sr = audioCtx?.sampleRate || 48000;
                    const total = recordedChunksRef.current.reduce((acc, c) => acc + c.length, 0) / (2 * sr);
                    if (next >= total) {
                        stopHistory();
                        return total;
                    }
                    return next;
                });
                lastTime = now;
                raf = requestAnimationFrame(tick);
            }
        };

        if (isHistoryPlaying) {
            lastTime = Date.now();
            raf = requestAnimationFrame(tick);
        }
        return () => cancelAnimationFrame(raf);
    }, [isHistoryPlaying]);

    // Sync Audio Nodes
    useEffect(() => { if (gainNode) gainNode.gain.value = isMuted ? 0 : volume; }, [volume, gainNode, isMuted]);
    useEffect(() => { if (lpFilter) lpFilter.frequency.value = lpFreq; }, [lpFreq, lpFilter]);
    useEffect(() => { if (hpFilter) hpFilter.frequency.value = hpFreq; }, [hpFreq, hpFilter]);

    // Voice Helpers
    const startListening = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return alert("Browser does not support Speech Recognition");

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (e: any) => {
            const text = e.results[0][0].transcript;
            setSttTranscript(text);
            setPromptText(text);
            addLog(`Transcribed: "${text}"`);
        };
        recognition.onend = () => setIsListening(false);
        recognition.start();
    };

    const addTagToPrompt = (tag: string, category: string) => {
        setPromptText(prev => {
            const parts = prev.split(",").map(p => p.trim()).filter(p => p && !p.toLowerCase().includes(tag.toLowerCase()));
            return [...parts, tag].join(", ");
        });
    };

    const removeTagFromPrompt = (tag: string) => {
        setPromptText(prev => prev.split(",").map(p => p.trim()).filter(p => p.toLowerCase() !== tag.toLowerCase()).join(", "));
    };

    const generateMagicInspiration = () => {
        const randomGenre = GENRES[Math.floor(Math.random() * GENRES.length)];
        const randomMood = MOODS[Math.floor(Math.random() * MOODS.length)];
        const randomInst1 = INSTS[Math.floor(Math.random() * INSTS.length)];
        const randomInst2 = INSTS[Math.floor(Math.random() * INSTS.length)];

        setSelGenres([randomGenre]);
        setSelMoods([randomMood]);
        setSelInsts([randomInst1, randomInst2]);

        setPromptText(`${randomGenre} with ${randomMood}, featuring ${randomInst1} and ${randomInst2}`);
        addLog("Magic Inspiration triggered!");
    };

    if (!mounted) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-8 max-w-[1900px] mx-auto min-h-screen font-inter">
            {/* Background Ambience */}
            <div
                className="fixed inset-0 pointer-events-none -z-50 transition-colors duration-1000"
                style={{ background: `radial-gradient(circle at 50% 50%, ${accentColor}08 0%, #0d1117 100%)` }}
            />

            {/* Left Sidebar: Orchestration */}
            <div className="lg:col-span-4 space-y-8 flex flex-col">
                <FloatingPanel delay={0} title="Engine Config" sub="Core Parameters" icon={<Settings className="w-5 h-5 text-white/40" />}>
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Master API Key</label>
                                <HelpTrigger text={CONTROL_INFO.APIKey} />
                            </div>
                            <input
                                type="password"
                                className="input-field bg-[#0d1117] border-white/5 hover:border-white/10"
                                placeholder="Paste key here..."
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                suppressHydrationWarning
                            />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Signal Model</label>
                                <HelpTrigger text={CONTROL_INFO.Model} />
                            </div>
                            <select className="input-field bg-[#0d1117] border-white/5" value={model} onChange={(e) => setModel(e.target.value)}>
                                <option value="models/lyria-realtime-exp">Lyria RealTime (Experimental)</option>
                                <option value="models/lyria-realtime-preview">Lyria RealTime (Preview)</option>
                                <option value="models/lyria-music-realtime">Lyria Music High-Fidelity</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Key</label>
                                <HelpTrigger text={CONTROL_INFO.Key} />
                            </div>
                            <select className="input-field bg-[#0d1117] border-white/5" value={musicKey} onChange={(e) => setMusicKey(e.target.value)}>
                                {["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Scale</label>
                                <HelpTrigger text={CONTROL_INFO.Scale} />
                            </div>
                            <select className="input-field bg-[#0d1117] border-white/5" value={musicScale} onChange={(e) => setMusicScale(e.target.value)}>
                                {["Major", "Minor", "Dorian", "Phrygian", "Lydian", "Mixolydian", "Aeolian", "Locrian"].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                </FloatingPanel>

                <FloatingPanel delay={0.1} title="Prompt Studio" sub="Sonic Definition" icon={<Zap className="w-5 h-5 text-white/40" />}
                    action={
                        <div className="flex items-center gap-2">
                            <HelpTrigger text={CONTROL_INFO.Prompt} />
                            <button onClick={() => { setPromptText(""); setSelGenres([]); setSelMoods([]); setSelInsts([]); }} className="p-2 hover:bg-white/5 rounded-lg transition-all opacity-20 hover:opacity-100"><Trash2 className="w-5 h-5" /></button>
                        </div>
                    }
                >
                    <div className="space-y-6">
                        {/* Search & Inspiration Bar */}
                        <div className="flex gap-2">
                            <div className="relative flex-1 group">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 group-focus-within:text-white transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search vibes..."
                                    className="w-full bg-[#0d1117] border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all outline-none"
                                    value={tagSearch}
                                    onChange={(e) => setTagSearch(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={generateMagicInspiration}
                                className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 border border-white/10 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-2 group"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-purple-400 group-hover:rotate-12 transition-transform" /> MAGIC
                            </button>
                        </div>

                        <div className="space-y-8 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            <TagSection label="Genre" icon={<LayoutGrid className="w-3.5 h-3.5 text-white/10" />} items={GENRES} activeItems={selGenres} search={tagSearch} onToggle={(t: string) => {
                                if (selGenres.includes(t)) { setSelGenres(s => s.filter(x => x !== t)); removeTagFromPrompt(t); }
                                else { setSelGenres(s => [...s, t]); addTagToPrompt(t, "genre"); }
                            }} />
                            <TagSection label="Mood" icon={<Heart className="w-3.5 h-3.5 text-white/10" />} items={MOODS} activeItems={selMoods} search={tagSearch} onToggle={(t: string) => {
                                if (selMoods.includes(t)) { setSelMoods(s => s.filter(x => x !== t)); removeTagFromPrompt(t); }
                                else { setSelMoods(s => [...s, t]); addTagToPrompt(t, "mood"); }
                            }} />
                            <TagSection label="Instruments" icon={<Guitar className="w-3.5 h-3.5 text-white/10" />} items={INSTS} activeItems={selInsts} search={tagSearch} onToggle={(t: string) => {
                                if (selInsts.includes(t)) { setSelInsts(s => s.filter(x => x !== t)); removeTagFromPrompt(t); }
                                else { setSelInsts(s => [...s, t]); addTagToPrompt(t, "instrument"); }
                            }} />
                        </div>

                        <div className="relative">
                            <textarea
                                className="input-field bg-[#0d1117] min-h-[160px] resize-none text-sm p-4 border-white/5 hover:border-white/10 focus:border-white/20"
                                placeholder="Composite prompt..."
                                value={promptText}
                                onChange={(e) => setPromptText(e.target.value)}
                            />

                            {/* Voice Narrative Interface */}
                            <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between bg-gradient-to-t from-[#0d1117] via-[#0d1117]/90 to-transparent pointer-events-none">
                                <div className="flex-1 mr-4 pointer-events-auto">
                                    <AnimatePresence mode="wait">
                                        {isListening ? (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 backdrop-blur-md"
                                            >
                                                <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20">
                                                    <Mic className="w-4 h-4 text-red-400" />
                                                    <span className="absolute inset-0 rounded-full border border-red-500/40 animate-ping" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black tracking-widest text-red-400 uppercase">Listening...</span>
                                                    <span className="text-xs text-red-200/80 italic line-clamp-1">{sttTranscript || "Speak naturally..."}</span>
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-xl p-3 backdrop-blur-md"
                                            >
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black tracking-widest text-white/30 uppercase">Voice Lab</span>
                                                    <span className="text-xs text-white/40 italic line-clamp-1">"Ready to synthesize."</span>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <button
                                    onClick={startListening}
                                    className={cn(
                                        "relative group flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 pointer-events-auto",
                                        isListening
                                            ? "bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.3)]"
                                            : "bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/5 hover:border-white/20"
                                    )}
                                >
                                    <Mic className={cn("w-5 h-5 transition-transform", isListening && "scale-110")} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-2">
                                    <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Neg. Prompt</label>
                                    <HelpTrigger text={CONTROL_INFO["Neg. Prompt"]} />
                                </div>
                                <textarea
                                    className="input-field bg-[#0d1117] min-h-[80px] resize-none text-xs p-3 border-white/5 hover:border-white/10 focus:border-white/20"
                                    placeholder="Exclude elements (e.g. no vocals, no drums)..."
                                    value={negativePrompt}
                                    onChange={(e) => setNegativePrompt(e.target.value)}
                                />
                            </div>

                            <div className="relative">
                                <div className="flex items-center gap-2 mb-2">
                                    <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Seed</label>
                                    <HelpTrigger text={CONTROL_INFO.Seed} />
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        className="input-field bg-[#0d1117] text-xs border-white/5 flex-1"
                                        value={seed}
                                        onChange={(e) => setSeed(parseInt(e.target.value))}
                                    />
                                    <button
                                        onClick={() => setSeed(Math.floor(Math.random() * 1000000))}
                                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 transition-all"
                                        title="Randomize Seed"
                                    >
                                        <Shuffle className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </FloatingPanel>
            </div >

            {/* Main Center Deck */}
            <div className="lg:col-span-8 space-y-8 flex flex-col">
                <FloatingPanel delay={0.2} className="flex-1 bg-gradient-to-br from-[#161b22]/80 to-[#0d1117]/80">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
                        <div className="flex items-center gap-5">
                            <div className={cn("p-4 rounded-2xl transition-all duration-700", status === "playing" ? "bg-white/5 shadow-xl" : "bg-white/[0.02] opacity-30")}>
                                <Activity className={cn("w-8 h-8 transition-colors", status === "playing" ? "text-white" : "text-white/20")} style={{ color: status === "playing" ? accentColor : undefined }} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black italic tracking-tighter leading-tight">MASTER DECK</h1>
                                <div className="flex items-center gap-4 text-[10px] font-black opacity-30 tracking-widest uppercase mt-1">
                                    <div className="flex items-center gap-2">
                                        <span className={cn("w-1.5 h-1.5 rounded-full", status === "playing" ? "bg-white animate-pulse" : "bg-white/20")} style={{ backgroundColor: status === "playing" ? accentColor : undefined }} />
                                        {status}
                                    </div>
                                    <span>HW: {ctxState}</span>
                                    <span>{audioCtx?.sampleRate || 48000}HZ</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl p-1 border border-white/5">
                                <button onClick={toggleRecording} className={cn("p-3 rounded-lg transition-all", isRecording ? "bg-red-500 text-white" : "hover:bg-white/5 text-white/30")}>
                                    <Square className={cn("w-5 h-5", isRecording && "fill-current")} />
                                </button>
                                <button onClick={downloadRecording} className="p-3 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-all">
                                    <Download className="w-5 h-5" />
                                </button>
                                <div className="px-2">
                                    <HelpTrigger text={CONTROL_INFO.Rec} />
                                </div>
                            </div>

                            {status === "playing" ? (
                                <button onClick={handleStop} className="h-14 px-8 rounded-2xl font-black text-xs tracking-widest bg-white/5 border border-white/10 text-white/60 hover:bg-red-500 hover:text-white transition-all group">
                                    <div className="flex items-center gap-2">
                                        <RotateCcw className="w-4 h-4 transition-transform group-hover:rotate-180" /> STOP SIGNAL
                                    </div>
                                </button>
                            ) : (
                                <button onClick={handleStart} disabled={status === "connecting"} className="h-14 px-10 rounded-2xl font-black text-xs tracking-widest bg-white text-black hover:bg-white/80 transition-all active:scale-95 disabled:opacity-20 relative overflow-hidden group">
                                    <span className="relative z-10 flex items-center gap-3">
                                        <Play className="w-4 h-4 fill-current" /> {status === "connecting" ? "SYNCING..." : "IGNITE ENGINE"}
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Archetypes */}
                    <div className="mb-12 grid grid-cols-2 md:grid-cols-4 gap-4">
                        {(ARCHETYPES as Archetype[]).map(arch => (
                            <button
                                key={arch.id}
                                onClick={() => applyArchetype(arch)}
                                style={{
                                    boxShadow: activeArchetype === arch.id ? `${arch.config.color}20` : undefined,
                                    borderColor: activeArchetype === arch.id ? arch.config.color : undefined
                                }}
                                className={cn(
                                    "flex items-center gap-4 p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left group overflow-hidden relative",
                                    activeArchetype === arch.id && "bg-white/[0.05]"
                                )}
                            >
                                <div className="p-2.5 rounded-lg bg-white/5 transition-colors" style={{ color: activeArchetype === arch.id ? arch.config.color : 'rgba(255,255,255,0.2)' }}>
                                    {arch.icon}
                                </div>
                                <div className="flex flex-col">
                                    <span className={cn("text-[10px] font-black transition-colors tracking-widest uppercase", activeArchetype === arch.id ? "text-white" : "text-white/40")}>
                                        {arch.name}
                                    </span>
                                </div>
                                {activeArchetype === arch.id && (
                                    <motion.div layoutId="active-arch-bg" className="absolute inset-0 border border-white/20 pointer-events-none rounded-xl" initial={false} transition={{ type: "spring", duration: 0.5 }} />
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10 mb-12">
                        <ControlSlider label="BPM" value={bpm} min={60} max={200} step={1} icon={<Music className="w-3.5 h-3.5" />} onChange={setBpm} activeColor={accentColor} />
                        <ControlSlider label="Temp" value={temp} min={0} max={3} step={0.1} icon={<Sparkles className="w-3.5 h-3.5" />} onChange={setTemp} activeColor={accentColor} />
                        <ControlSlider label="Guidance" value={guidance} min={0} max={6} step={0.1} icon={<Sliders className="w-3.5 h-3.5" />} onChange={setGuidance} activeColor={accentColor} />
                        <ControlSlider label="Density" value={density} min={0} max={1} step={0.01} icon={<Activity className="w-3.5 h-3.5" />} onChange={setDensity} activeColor={accentColor} />
                        <ControlSlider label="Bright" value={brightness} min={0} max={1} step={0.01} icon={<Zap className="w-3.5 h-3.5" />} onChange={setBrightness} activeColor={accentColor} />

                        <div className="space-y-4">
                            <div className="flex justify-between items-center h-5">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-widest">
                                    <Volume2 className="w-3.5 h-3.5" /> MASTER
                                    <HelpTrigger text={CONTROL_INFO.Volume} />
                                </div>
                                <button onClick={() => setIsMuted(!isMuted)} className="text-white/20 hover:text-white transition-colors">
                                    {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                            <div className="relative h-2 flex items-center">
                                <input
                                    type="range" min={0} max={2} step={0.05} value={volume} disabled={isMuted}
                                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                                    className="w-full h-full bg-white/5 rounded-full appearance-none cursor-pointer accent-white disabled:opacity-5"
                                />
                                {!isMuted && <div className="absolute h-full pointer-events-none rounded-full" style={{ background: accentColor, width: `${(volume / 2) * 100}%`, opacity: 0.3 }} />}
                            </div>
                        </div>
                    </div>

                    {/* Visualization Lab */}
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Eye className="w-4 h-4 text-white/20" />
                                <h3 className="text-[10px] font-black tracking-widest opacity-20 uppercase">Signal Analyzer</h3>
                                <HelpTrigger text={CONTROL_INFO.Visualizer} />
                            </div>
                            <div className="flex bg-white/[0.03] rounded-lg p-1 border border-white/5">
                                <button onClick={() => setVizMode("oscilloscope")} className={cn("px-4 py-1.5 rounded-md text-[9px] font-black tracking-widest transition-all", vizMode === "oscilloscope" ? "bg-white text-black" : "text-white/30")}>WAVE</button>
                                <button onClick={() => setVizMode("spectrum")} className={cn("px-4 py-1.5 rounded-md text-[9px] font-black tracking-widest transition-all", vizMode === "spectrum" ? "bg-white text-black" : "text-white/30")}>BARS</button>
                            </div>
                        </div>

                        <div className="relative h-64 rounded-2xl border border-white/5 bg-[#0d1117] overflow-hidden group/scope shadow-inner">
                            <AudioVisualizer analyser={analyser} mode={vizMode} color={accentColor} className="w-full h-full opacity-80" />
                            <AnimatePresence>
                                {status !== "playing" && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center bg-[#0d1117]/60 backdrop-blur-[1px]">
                                        <span className="text-[9px] font-black text-white/10 tracking-[0.4em] uppercase">No Inbound Audio Signal</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Synthesis Timeline & Scrubbing */}
                        <div className="mt-8 pt-8 border-t border-white/5">
                            <SynthesisTimeline
                                chunks={recordedChunks}
                                currentTime={currentTime}
                                isPlaying={isHistoryPlaying}
                                onSeek={handleSeek}
                                onRangeChange={handleRangeChange}
                                onTogglePlayback={handleToggleHistoryPlayback}
                                onDownload={downloadRecording}
                                accentColor={accentColor}
                                sampleRate={audioCtx?.sampleRate || 48000}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-12 pt-10 border-t border-white/5">
                        <ControlSlider label="Low-pass" value={lpFreq} min={100} max={20000} step={100} icon={<Filter className="w-3.5 h-3.5" />} onChange={setLpFreq} />
                        <ControlSlider label="High-pass" value={hpFreq} min={20} max={5000} step={10} icon={<Filter className="w-3.5 h-3.5" />} onChange={setHpFreq} />
                    </div>
                </FloatingPanel>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FloatingPanel delay={0.3} title="Latency Telemetry" icon={<Activity className="w-4 h-4 text-white/20" />}
                        action={<HelpTrigger text={CONTROL_INFO.Telemetry} />}
                    >
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Buffer Status</span>
                                <span className="text-xs font-mono text-white/60">{metrics.bufferSecs.toFixed(3)}S</span>
                            </div>
                            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                                <motion.div className="h-full bg-white/40" animate={{ width: `${Math.min(100, (metrics.bufferSecs / 2) * 100)}%` }} style={{ backgroundColor: accentColor, opacity: 0.6 }} />
                            </div>
                        </div>
                    </FloatingPanel>

                    <FloatingPanel delay={0.4} title="System Log" icon={<Terminal className="w-4 h-4 text-white/20" />}
                        action={<HelpTrigger text={CONTROL_INFO.Logs} />}
                    >
                        <div className="bg-[#0d1117] h-32 overflow-y-auto p-4 rounded-xl border border-white/5 custom-scrollbar">
                            {debugLogs.map((log, i) => (
                                <div key={i} className="text-[10px] items-start mb-2 font-mono text-white/30 border-b border-white/[0.02] pb-1">
                                    <span className="text-white/10 mr-2">[{i.toString().padStart(2, '0')}]</span> {log}
                                </div>
                            ))}
                        </div>
                    </FloatingPanel>
                </div>
            </div>
        </div>
    );
}

