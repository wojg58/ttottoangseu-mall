/**
 * @file lib/gemini/server.ts
 * @description Gemini(Google AI Studio) 서버 전용 래퍼
 *
 * 목적:
 * - `GEMINI_API_KEY`를 **서버에서만** 사용해 Gemini 모델을 호출합니다.
 * - 스트리밍 응답을 AsyncIterable로 제공하여 API Route(SSE)에서 그대로 흘려보낼 수 있게 합니다.
 *
 * 주의:
 * - 이 파일은 서버에서만 import 하세요. (클라이언트 컴포넌트에서 사용 금지)
 *
 * @dependencies
 * - @google/generative-ai
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ChatMessageForModel {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface StreamGeminiOptions {
  model: string;
  messages: ChatMessageForModel[];
}

function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Please set it in your .env file.");
  }
  return apiKey;
}

function toGeminiContents(messages: ChatMessageForModel[]) {
  // @google/generative-ai uses roles: 'user' | 'model'
  // We'll map:
  // - user -> user
  // - assistant -> model
  // - system -> user (prefixed)  (MVP: keep it simple)
  return messages.map((m) => {
    if (m.role === "assistant") {
      return { role: "model" as const, parts: [{ text: m.content }] };
    }
    if (m.role === "system") {
      return { role: "user" as const, parts: [{ text: `[SYSTEM]\n${m.content}` }] };
    }
    return { role: "user" as const, parts: [{ text: m.content }] };
  });
}

/**
 * Gemini 스트리밍 호출
 * - 토큰(텍스트 조각)을 순서대로 yield 합니다.
 */
export async function* streamGeminiText(options: StreamGeminiOptions): AsyncGenerator<string> {
  const { model, messages } = options;

  console.group("[Gemini] streamGeminiText");
  console.log("model:", model);
  console.log("messagesCount:", messages.length);

  const genAI = new GoogleGenerativeAI(getGeminiApiKey());
  const generativeModel = genAI.getGenerativeModel({ model });

  const contents = toGeminiContents(messages);

  // generateContentStream returns { stream, response }
  const result = await generativeModel.generateContentStream({
    contents,
  });

  let chunkCount = 0;
  try {
    for await (const chunk of result.stream) {
      chunkCount += 1;
      const text = chunk.text();
      if (text) yield text;
    }
  } finally {
    console.log("chunkCount:", chunkCount);
    console.groupEnd();
  }
}


