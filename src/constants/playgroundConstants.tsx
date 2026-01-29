import React, { JSX } from "react";
import { Zap, Layers, Music, Waves } from "lucide-react";

export const GENRES = [
    "Acid Jazz", "Afrobeat", "Alternative Country", "Baroque", "Bengal Baul", "Bhangra", "Bluegrass", "Blues Rock",
    "Bossa Nova", "Breakbeat", "Celtic Folk", "Chillout", "Chiptune", "Classic Rock", "Contemporary R&B", "Cumbia",
    "Deep House", "Disco Funk", "Drum & Bass", "Dubstep", "EDM", "Electro Swing", "Funk Metal", "G-funk",
    "Garage Rock", "Glitch Hop", "Grime", "Hyperpop", "Indian Classical", "Indie Electronic", "Indie Folk",
    "Indie Pop", "Irish Folk", "Jam Band", "Jamaican Dub", "Jazz Fusion", "Latin Jazz", "Lo-Fi Hip Hop",
    "Marching Band", "Merengue", "New Jack Swing", "Minimal Techno", "Moombahton", "Neo-Soul", "Orchestral Score",
    "Piano Ballad", "Polka", "Post-Punk", "60s Psychedelic Rock", "Psytrance", "R&B", "Reggae", "Reggaeton",
    "Renaissance Music", "Salsa", "Shoegaze", "Ska", "Surf Rock", "Synthpop", "Techno", "Trance", "Trap Beat",
    "Trip Hop", "Vaporwave", "Witch house"
];

export const MOODS = [
    "Acoustic Instruments", "Ambient", "Bright Tones", "Chill", "Crunchy Distortion", "Danceable", "Dreamy", "Echo",
    "Emotional", "Ethereal Ambience", "Experimental", "Fat Beats", "Funky", "Glitchy Effects", "Huge Drop",
    "Live Performance", "Lo-fi", "Ominous Drone", "Psychedelic", "Rich Orchestration", "Saturated Tones",
    "Subdued Melody", "Sustained Chords", "Swirling Phasers", "Tight Groove", "Unsettling", "Upbeat", "Virtuoso", "Weird Noises"
];

export const INSTS = [
    "303 Acid Bass", "808 Hip Hop Beat", "Accordion", "Alto Saxophone", "Bagpipes", "Balalaika Ensemble", "Banjo",
    "Bass Clarinet", "Bongos", "Boomy Bass", "Bouzouki", "Buchla Synths", "Cello", "Charango", "Clavichord",
    "Conga Drums", "Didgeridoo", "Dirty Synths", "Djembe", "Drumline", "Dulcimer", "Fiddle", "Flamenco Guitar",
    "Funk Drums", "Glockenspiel", "Guitar", "Hang Drum", "Harmonica", "Harp", "Harpsichord", "Hurdy-gurdy",
    "Kalimba", "Koto", "Lyre", "Mandolin", "Maracas", "Marimba", "Mbira", "Mellotron", "Metallic Twang",
    "Moog Oscillations", "Ocarina", "Persian Tar", "Pipa", "Precision Bass", "Ragtime Piano", "Rhodes Piano",
    "Shamisen", "Shredding Guitar", "Sitar", "Slide Guitar", "Smooth Pianos", "Spacey Synths", "Steel Drum",
    "Synth Pads", "Tabla", "TR-909 Drum Machine", "Trumpet", "Tuba", "Vibraphone", "Viola Ensemble", "Warm Acoustic Guitar", "Woodwinds"
];

export interface Archetype {
    id: string;
    name: string;
    icon: JSX.Element;
    config: {
        bpm: number;
        temp: number;
        guidance: number;
        density: number;
        brightness: number;
        color: string;
    };
}

export const ARCHETYPES: Archetype[] = [
    { id: "techno", name: "Techno Master", icon: <Zap />, config: { bpm: 128, temp: 1.2, guidance: 5.0, density: 0.8, brightness: 0.4, color: "#12a150" } },
    { id: "cinematic", name: "Epic Score", icon: <Layers />, config: { bpm: 80, temp: 1.5, guidance: 6.0, density: 0.4, brightness: 0.7, color: "#2f81f7" } },
    { id: "lofi", name: "Chill Beats", icon: <Music />, config: { bpm: 85, temp: 0.9, guidance: 3.5, density: 0.5, brightness: 0.3, color: "#f78166" } },
    { id: "ambient", name: "Void Drift", icon: <Waves />, config: { bpm: 60, temp: 1.8, guidance: 4.0, density: 0.2, brightness: 0.6, color: "#d2a8ff" } }
];

export const CONTROL_INFO: Record<string, string> = {
    BPM: "Beats Per Minute. Determines the generated rhythm speed.",
    Temp: "Temperature. Higher values (1.5+) increase sonic chaos.",
    Guidance: "Prompt adherence. How strictly the AI follows your text.",
    Density: "Note density. Controls how 'busy' the musical texture is.",
    Bright: "Timbral brightness. Results in sharper, high-frequency sounds.",
    Volume: "Master output level. Avoid clipping (>1.5).",
    "Low-pass": "Cuts highs. Use for muffled or 'underwater' effects.",
    "High-pass": "Cuts lows. Use for thin, ethereal sounds.",
    APIKey: "Google AI Studio key. Processed securely in-memory.",
    Model: "Select the Lyria model optimized for your latency and fidelity needs.",
    Prompt: "Combine Genre, Mood, and Instruments to guide the AI synthesis.",
    Rec: "Capture and export the high-fidelity output as a WAV file.",
    Visualizer: "Switch between Waveform (time domain) and Spectrum (frequency domain) views.",
    Telemetry: "Monitor real-time buffer health and system performance.",
    Logs: "Raw system event stream for troubleshooting.",
    "Neg. Prompt": "Negative Prompting. Define elements to exclude from the generation (e.g. 'no drums').",
    Key: "Musical Key alignment. Ground the generation in a specific tonal center.",
    Scale: "Scale/Mode selection. Determines the harmonic character (e.g. Major, Minor, Dorian).",
    Seed: "Reproduction Seed. Use a specific number to recreate the exact same sonic texture."
};
