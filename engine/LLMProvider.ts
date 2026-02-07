
import { GoogleGenAI, Type } from "@google/genai";

export type AgentPersona = 'EXAMINER' | 'CRITIC' | 'GM';

const OFFICIAL_IELTS_RUBRIC = `
OFFICIAL IELTS BAND DESCRIPTORS:
- FC (Fluency): 9 (Effortless), 7 (Cohesive but hesitates), 5 (Fragmented).
- LR (Lexical): 9 (Nuanced), 7 (Idiomatic), 5 (Basic).
- GRA (Grammar): 9 (Full range), 7 (Complex mix), 5 (Limited).
- PR (Pronunciation): 9 (Nuanced), 7 (Clear), 5 (Frequent errors).
`;

export class LLMProvider {
  private ai: GoogleGenAI;
  
  constructor() {
    // Initializing GoogleGenAI with API key from environment variable as per guidelines
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private getSystemInstruction(persona: AgentPersona): string {
    switch (persona) {
      case 'EXAMINER':
        return `You are a Senior IELTS Examiner. ${OFFICIAL_IELTS_RUBRIC}. 
        You synthesize RAG context and Critic reasoning to provide final band scores and a professional report.`;
      case 'CRITIC':
        return `You are a Linguistic Expert specialized in Agentic RAG. 
        Your task is to analyze user input against retrieved band descriptors and search for idiomatic "Upgrades" to basic speech.`;
      case 'GM':
        return `You are the Game Master. You translate scores into XP, gold, and "vibe" commentary.`;
      default:
        return "You are an IELTS coaching agent.";
    }
  }

  /**
   * Represents a single 'step' in a multi-agent conversation.
   */
  public async step(message: string, persona: AgentPersona, config?: any): Promise<string> {
    // Correct usage of generateContent at the models level
    const response = await this.ai.models.generateContent({
      model: config?.model || 'gemini-3-flash-preview',
      contents: message,
      config: {
        ...config?.params,
        systemInstruction: this.getSystemInstruction(persona)
      }
    });
    // response.text is a property, not a method
    return response.text || "";
  }

  public async stepJSON(message: string, persona: AgentPersona, schema: any): Promise<any> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: message,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        systemInstruction: this.getSystemInstruction(persona)
      }
    });
    try {
      // response.text is a property, not a method
      return JSON.parse(response.text?.trim() || "{}");
    } catch (e) {
      console.error("Agentic step failed to produce JSON:", e);
      return null;
    }
  }
}
