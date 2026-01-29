class StreamPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.length = 0;
    this.cur = null;
    this.off = 0;
    this.underruns = 0;
    this.tick = 0;

    this.port.onmessage = (e) => {
      const d = e.data;
      if (d?.type === 'push' && d.samples) {
        if (this.queue.length === 0) {
          console.log("Worklet: Received first samples. Buffer started.");
        }
        this.queue.push(d.samples);
        this.length += d.samples.length;
      } else if (d?.type === 'clear') {
        this.queue.length = 0;
        this.length = 0;
        this.cur = null;
        this.off = 0;
        this.underruns = 0;
        console.log("Worklet: Queue cleared.");
      }
    };
  }

  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length < 2) return true;

    const L = out[0];
    const R = out[1];
    const frames = L.length;

    for (let i = 0; i < frames; i++) {
      let l = 0, r = 0;
      if (this.length >= 2) {
        if (!this.cur || this.off >= this.cur.length) {
          this.cur = this.queue.shift();
          this.off = 0;
        }
        if (this.cur) {
          l = this.cur[this.off++];
          r = this.cur[this.off++];
          this.length -= 2;
        }
      } else {
        this.underruns++;
      }
      L[i] = l;
      R[i] = r;
    }

    this.tick++;
    if (this.tick % 25 === 0) {
      this.port.postMessage({
        type: 'metrics',
        length: this.length,
        underruns: this.underruns
      });
    }

    return true;
  }
}

registerProcessor('stream-player', StreamPlayerProcessor);
