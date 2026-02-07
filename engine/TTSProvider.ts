
export class TTSProvider {
  private static instance: TTSProvider;
  private apiBase: string = import.meta.env.VITE_API_BASE || "http://localhost:8000";
  private model: string = "qwen3-tts-instruct-flash-realtime-2026-01-22";

  private constructor() {}

  public static getInstance(): TTSProvider {
    if (!TTSProvider.instance) {
      TTSProvider.instance = new TTSProvider();
    }
    return TTSProvider.instance;
  }

  public async speak(text: string, voice: string = "cherry"): Promise<void> {
    try {
      const response = await fetch(`${this.apiBase}/v1/audio/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: text,
          voice,
          format: "wav",
          model: this.model,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Backend TTS error");
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
      console.warn("Backend TTS failed, using native fallback:", err);
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
