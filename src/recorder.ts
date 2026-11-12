/**
 * Records the microphone as 16 kHz mono WAV, for server-side transcription.
 *
 * WAV rather than MediaRecorder: browsers record different formats (WebM in
 * Chrome, MP4 in Safari) and not all of them are accepted by the
 * transcription model, while plain PCM WAV works everywhere. It also exposes
 * the live loudness for the voice animation.
 */

const TARGET_RATE = 16000
const MAX_SECONDS = 120

/**
 * The audio context must be created inside a tap on iPhone, or it stays
 * silent. Dictation creates it up front, on the mic tap, and hands it here.
 */
export function makeAudioContext() {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const context = new Ctx()
  context.resume().catch(() => undefined)
  return context
}

export interface Recorder {
  pause(): void
  resume(): void
  /** Stop and return the recording as WAV. */
  stop(): Blob
  /** Stop and throw the recording away. */
  cancel(): void
  /** current loudness, 0..1 */
  level(): number
}

export async function startRecorder(context: AudioContext): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  })
  await context.resume().catch(() => undefined)
  const source = context.createMediaStreamSource(stream)
  // ScriptProcessor is deprecated but is the one capture path every browser
  // (including older iOS Safari) supports without extra module files.
  const processor = context.createScriptProcessor(4096, 1, 1)
  const silent = context.createGain()
  silent.gain.value = 0
  source.connect(processor)
  processor.connect(silent)
  silent.connect(context.destination)

  const chunks: Float32Array[] = []
  let samples = 0
  let paused = false
  let loudness = 0
  const limit = MAX_SECONDS * context.sampleRate

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0)
    let sum = 0
    for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
    const target = Math.min(1, Math.max(0, (Math.sqrt(sum / input.length) - 0.008) * 7))
    loudness += (target - loudness) * (target > loudness ? 0.6 : 0.2)
    if (paused || samples >= limit) return
    chunks.push(new Float32Array(input))
    samples += input.length
  }

  const release = () => {
    processor.onaudioprocess = null
    source.disconnect()
    processor.disconnect()
    silent.disconnect()
    stream.getTracks().forEach((t) => t.stop())
  }

  return {
    pause() {
      paused = true
    },
    resume() {
      paused = false
    },
    level: () => (paused ? 0 : loudness),
    cancel: release,
    stop() {
      release()
      return encodeWav(chunks, samples, context.sampleRate)
    },
  }
}

/** Downsample to 16 kHz (box-averaging) and wrap as 16-bit PCM WAV. */
function encodeWav(chunks: Float32Array[], length: number, rate: number) {
  const ratio = rate / TARGET_RATE
  const outLength = Math.floor(length / ratio)
  const pcm = new Int16Array(outLength)
  const all = new Float32Array(length)
  let offset = 0
  for (const chunk of chunks) {
    all.set(chunk, offset)
    offset += chunk.length
  }
  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j++) sum += all[j]
    const value = sum / Math.max(1, end - start)
    pcm[i] = Math.max(-1, Math.min(1, value)) * 0x7fff
  }
  const header = new DataView(new ArrayBuffer(44))
  const text = (at: number, s: string) => [...s].forEach((c, i) => header.setUint8(at + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  header.setUint32(4, 36 + pcm.byteLength, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  header.setUint32(16, 16, true)
  header.setUint16(20, 1, true) // PCM
  header.setUint16(22, 1, true) // mono
  header.setUint32(24, TARGET_RATE, true)
  header.setUint32(28, TARGET_RATE * 2, true)
  header.setUint16(32, 2, true)
  header.setUint16(34, 16, true)
  text(36, 'data')
  header.setUint32(40, pcm.byteLength, true)
  return new Blob([header.buffer, pcm.buffer], { type: 'audio/wav' })
}
