import { TTSProvider } from "../engine/TTSProvider";

const tts = TTSProvider.getInstance();
// 使用相对路径，在开发环境通过Vite proxy代理，在生产环境（魔搭）前后端同源
const API_BASE = "";

export const speakWithAliyun = (text: string, voice?: string) => tts.speak(text, voice);

/**
 * Interface for evaluation results matching backend choices[0].message
 */
export interface PronunciationItem {
  word: string;
  status: "correct" | "mispronounced" | "missing";
  recognized_as?: string | null;
  ipa?: string;
  hint?: string;
}

export interface DetectedError {
  type: "grammar" | "lexical" | "pronunciation" | "fluency";
  original: string;
  correction: string;
  explanation: string;
}

export interface EvaluationResult {
  transcription: string;
  scores: { fluency: number; lexical: number; grammar: number; pronunciation: number };
  agent_thoughts: string[];
  feedback: string;
  xpReward: number;
  pronunciationFeedback?: PronunciationItem[];
  detectedErrors?: DetectedError[];
}

/**
 * Unified API Agent Caller.
 * Calls the local FastAPI backend (/v1/ielts/evaluate) with multipart form data.
 */
export const callIELTSAgent = async (audioBlob: Blob, part: string, question: string, userLevel: string = "6.0-6.5", anchorWords: string[] = []): Promise<EvaluationResult> => {
  try {
    const formData = new FormData();
    formData.append("audio", audioBlob, "response.wav");
    formData.append("part", part);
    formData.append("question", question);
    formData.append("level", userLevel);
    if (anchorWords.length > 0) {
      formData.append("anchor_words", JSON.stringify(anchorWords));
    }

    const response = await fetch(`${API_BASE}/v1/ielts/evaluate`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorJson = await response.json();
      throw new Error(errorJson.detail || "Backend failure");
    }

    const openaiResponse = await response.json();
    const assistantMessage = openaiResponse.choices[0].message;
    const metadata = assistantMessage.metadata;

    return {
      transcription: metadata.transcription,
      scores: metadata.scores,
      agent_thoughts: metadata.agent_thoughts,
      feedback: assistantMessage.content,
      xpReward: metadata.xp_reward,
      pronunciationFeedback: metadata.pronunciation_feedback || [],
      detectedErrors: metadata.detected_errors || [],
    };
  } catch (error: any) {
    console.error("Agentic Link Error:", error);
    return {
      transcription: "Transmission lost.",
      scores: { fluency: 0, lexical: 0, grammar: 0, pronunciation: 0 },
      agent_thoughts: [`Connection lost to ${API_BASE}`],
      feedback: "The examiner has disconnected. Please verify your backend server is active.",
      xpReward: 0,
    };
  }
};

interface P1AnswerRequest {
  question: string;
  band: string;
  profile: Record<string, unknown>;
}

export const generateP1Answer = async (payload: P1AnswerRequest): Promise<string> => {
  const response = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "myielts-multi-agent",
      messages: [{ role: "user", content: payload.question }],
      metadata: {
        task: "p1_answer",
        band: payload.band,
        question: payload.question,
        profile: payload.profile,
      },
    }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.detail || "Failed to generate Part 1 answer.");
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || "";
};
