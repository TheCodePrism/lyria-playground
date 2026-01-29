/**
 * Converts Float32 audio samples to Int16 PCM.
 */
export function float32ToInt16Array(f32: Float32Array): Int16Array {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
        let s = Math.max(-1, Math.min(1, f32[i]));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
}

/**
 * Creates a WAV file blob from a list of Int16 sample chunks.
 */
export function makeWavBlobFromInt16(int16List: Int16Array[], sampleRate: number, channels: number): Blob {
    let total = 0;
    for (const a of int16List) total += a.length;

    const bytesPerSample = 2;
    const dataSize = total * bytesPerSample;
    const headerSize = 44;
    const buf = new ArrayBuffer(headerSize + dataSize);
    const dv = new DataView(buf);
    let p = 0;

    const wrs = (s: string) => {
        for (let i = 0; i < s.length; i++) dv.setUint8(p++, s.charCodeAt(i));
    };
    const w32 = (v: number) => {
        dv.setUint32(p, v, true);
        p += 4;
    };
    const w16 = (v: number) => {
        dv.setUint16(p, v, true);
        p += 2;
    };

    wrs('RIFF');
    w32(36 + dataSize);
    wrs('WAVE');
    wrs('fmt ');
    w32(16);
    w16(1); // PCM
    w16(channels);
    w32(sampleRate);
    w32(sampleRate * channels * bytesPerSample);
    w16(channels * bytesPerSample);
    w16(16); // Bits per sample
    wrs('data');
    w32(dataSize);

    const out = new Int16Array(buf, headerSize);
    let o = 0;
    for (const a of int16List) {
        out.set(a, o);
        o += a.length;
    }

    return new Blob([buf], { type: 'audio/wav' });
}
