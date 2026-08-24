// Runs on the audio thread. Has no fetch, and a compiled WebAssembly.Module
// does not reliably survive this port, so raw bytes arrive by postMessage
// instead and are compiled and instantiated synchronously here.

const BLOCK = 128;

class PlaitsProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ready = false;
    this.mix = 0; // 0 = out, 1 = aux
    this.stopped = false;
    this.port.onmessage = (event) => this.onMessage(event.data);
  }

  onMessage(msg) {
    switch (msg.type) {
      case 'wasm': {
        const module = new WebAssembly.Module(msg.bytes);
        const instance = new WebAssembly.Instance(module, {});
        this.x = instance.exports;
        this.memory = this.x.memory;
        this.synth = this.x.plaits_new(BLOCK, sampleRate);
        this.outPtr = this.x.plaits_out_ptr(this.synth);
        this.auxPtr = this.x.plaits_aux_ptr(this.synth);
        this.cachedBuffer = null;
        this.refreshViews();
        this.ready = true;
        this.port.postMessage({ type: 'ready', sampleRate });
        break;
      }
      case 'param':
        if (this.ready) this.x.plaits_set_param(this.synth, msg.id, msg.value);
        break;
      case 'mix':
        this.mix = msg.value;
        break;

      // Local addition (not upstream): without this, a disconnected node keeps
      // rendering Plaits DSP forever, because process() otherwise always
      // returns true. The demo page never removes a voice, so upstream never
      // needed it. Send this before dropping the last reference to a node.
      case 'stop':
        if (this.ready) {
          this.x.plaits_free(this.synth);
          this.ready = false;
        }
        this.stopped = true;
        break;
    }
  }

  // A Float32Array over wasm memory detaches if the memory ever grows, and
  // indexed reads on a detached view return undefined, producing NaN samples
  // rather than throwing. Growth can only happen inside plaits_render, so
  // this must be called AFTER render and before the views are read (the
  // sample-copy loop in process()) to actually guard anything. Everything is
  // allocated up front so this should never fire, but the check is cheap.
  refreshViews() {
    if (this.cachedBuffer !== this.memory.buffer) {
      this.cachedBuffer = this.memory.buffer;
      this.outView = new Float32Array(this.memory.buffer, this.outPtr, BLOCK);
      this.auxView = new Float32Array(this.memory.buffer, this.auxPtr, BLOCK);
    }
  }

  process(_inputs, outputs) {
    const channels = outputs[0];
    const frames = channels[0].length;

    if (!this.ready || frames !== BLOCK) {
      for (const channel of channels) channel.fill(0);
      return !this.stopped;
    }

    this.x.plaits_render(this.synth);
    this.refreshViews();

    const out = this.outView;
    const aux = this.auxView;
    const mix = this.mix;

    for (let i = 0; i < frames; i++) {
      const sample = out[i] * (1 - mix) + aux[i] * mix;
      for (let c = 0; c < channels.length; c++) channels[c][i] = sample;
    }

    return !this.stopped;
  }
}

registerProcessor('plaits', PlaitsProcessor);
