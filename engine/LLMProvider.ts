
import { GoogleGenAI, Type } from "@google/genai";

export type AgentPersona = 'EXAMINER' | 'CRITIC' | 'GM';

const OFFICIAL_IELTS_RUBRIC = `
OFFICIAL IELTS BAND DESCRIPTORS:
- FC (Fluency 流利度): 9 (Effortless 轻松自如), 7 (Cohesive but hesitates 连贯但有停顿), 5 (Fragmented 支离破碎).
- LR (Lexical 词汇): 9 (Nuanced 细致入微), 7 (Idiomatic 地道习语), 5 (Basic 基础词汇).
- GRA (Grammar 语法): 9 (Full range 全面掌握), 7 (Complex mix 复杂句式混用), 5 (Limited 有限句型).
- PR (Pronunciation 发音): 9 (Nuanced 细致入微), 7 (Clear 清晰), 5 (Frequent errors 频繁错误).
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
        return `你是一名资深雅思考官。${OFFICIAL_IELTS_RUBRIC}. 
        你需要综合 RAG 上下文和评论家的推理，提供最终的 Band 分数和专业的报告。`;
      case 'CRITIC':
        return `你是一名专注于 Agentic RAG 的语言专家。
        你的任务是根据检索到的评分标准分析用户的输入，并寻找将基础口语升级为地道表达的"升级点"。`;
      case 'GM':
        return `你是游戏管理员 (Game Master)。你需要将分数转化为 XP (经验值)、金币和"氛围感"点评。`;
      default:
        return "你是一名雅思辅导智能体。";
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
