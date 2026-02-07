import { TTSProvider } from "../engine/TTSProvider";

const tts = TTSProvider.getInstance();

export const speakWithAliyun = (text: string, voice?: string) => tts.speak(text, voice);

/**
 * Interface for evaluation results matching backend choices[0].message
 */
export interface EvaluationResult {
  transcription: string;
  scores: { fluency: number; lexical: number; grammar: number; pronunciation: number };
  agent_thoughts: string[];
  feedback: string;
  xpReward: number;
}

/**
 * Unified API Agent Caller.
 * Calls the local FastAPI backend (/v1/ielts/evaluate) with multipart form data.
 */
export const callIELTSAgent = async (audioBlob: Blob, part: string, question: string, userLevel: string = "6.0-6.5"): Promise<EvaluationResult> => {
  try {
    const formData = new FormData();
    formData.append("audio", audioBlob, "response.wav");
    formData.append("part", part);
    formData.append("question", question);
    formData.append("level", userLevel);

    const response = await fetch("http://localhost:8000/v1/ielts/evaluate", {
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
    };
  } catch (error: any) {
    console.error("Agentic Link Error:", error);
    return {
      transcription: "Transmission lost.",
      scores: { fluency: 0, lexical: 0, grammar: 0, pronunciation: 0 },
      agent_thoughts: ["Connection lost to http://localhost:8000"],
      feedback: "The examiner has disconnected. Please verify your backend server is active.",
      xpReward: 0,
    };
  }
};
