/**
 * Singleton AudioContext instance.
 * We initialize it with a sample rate of 24000Hz which is the standard for Gemini TTS.
 */
export const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
  sampleRate: 24000,
});

/**
 * Decodes a base64 string into a Uint8Array.
 */
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes Base64 encoded raw PCM audio data (16-bit, 24kHz, Mono).
 */
export async function decodeAudioData(
  base64String: string,
  sampleRate: number = 24000
): Promise<AudioBuffer> {
  const data = base64ToBytes(base64String);
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = audioContext.createBuffer(1, dataInt16.length, sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }

  return buffer;
}

/**
 * Plays an AudioBuffer through the shared AudioContext.
 * Returns the AudioBufferSourceNode so it can be stopped manually.
 * 
 * @param buffer The AudioBuffer to play.
 * @param onEnded Callback when audio finishes naturally.
 */
export function playAudio(buffer: AudioBuffer, onEnded?: () => void): AudioBufferSourceNode {
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  
  source.onended = () => {
    if (onEnded) onEnded();
  };
  
  source.start();
  return source;
}

/**
 * Ensures the AudioContext is running.
 */
export async function resumeAudioContext() {
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}
