
/**
 * Alibaba Cloud DashScope TTS Provider
 * Model: qwen3-tts-instruct-flash-realtime-2026-01-22
 */
export class TTSProvider {
  private static instance: TTSProvider;
  private apiKey: string = "sk-784cbf391952467882f20b1eebfa6fcd";
  private model: string = "qwen3-tts-instruct-flash-realtime-2026-01-22";
  private apiEndpoint: string = "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/text-to-audio";

  private constructor() {}

  public static getInstance(): TTSProvider {
    if (!TTSProvider.instance) {
      TTSProvider.instance = new TTSProvider();
    }
    return TTSProvider.instance;
  }

  /**
   * Main method to speak text.
   * Encapsulates the logic for Aliyun API call and audio playback.
   */
  public async speak(text: string, voice: string = "cherry"): Promise<void> {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-Data-Inspection": "enable"
        },
        body: JSON.stringify({
          model: this.model,
          input: { text },
          parameters: {
            voice,
            format: "wav",
            sample_rate: 24000,
            volume: 50,
            rate: 1.0,
            pitch: 1.0
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Aliyun TTS Error");
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);

      return new Promise((resolve, reject) => {
        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
        };
        audio.play().catch(reject);
      });
    } catch (err) {
      console.warn("Aliyun TTS failed, using native fallback:", err);
      return this.fallbackSpeak(text);
    }
  }

  private fallbackSpeak(text: string): Promise<void> {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-GB';
      utterance.onend = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }
}
