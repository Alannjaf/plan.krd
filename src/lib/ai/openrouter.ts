/**
 * OpenRouter API Client
 * Uses the google/gemini-3-flash-preview model for AI features
 */

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionResponse = {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type StreamChunk = {
  id: string;
  choices: Array<{
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
};

/**
 * Send a chat completion request to OpenRouter
 */
export async function chatCompletion(
  messages: Message[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<{ success: boolean; content?: string; error?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return { success: false, error: "OpenRouter API key not configured" };
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Plan.krd",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenRouter API error:", errorData);
      return {
        success: false,
        error: errorData.error?.message || `API error: ${response.status}`,
      };
    }

    const data: ChatCompletionResponse = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return { success: false, error: "No response content from AI" };
    }

    return { success: true, content };
  } catch (error) {
    console.error("OpenRouter request failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect to AI service",
    };
  }
}

/**
 * Send a streaming chat completion request to OpenRouter
 * Returns an async generator that yields content chunks
 */
export async function* streamChatCompletion(
  messages: Message[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): AsyncGenerator<{ content?: string; error?: string; done?: boolean }> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    yield { error: "OpenRouter API key not configured" };
    return;
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Plan.krd",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      yield { error: errorData.error?.message || `API error: ${response.status}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { error: "No response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine === "data: [DONE]") continue;
        if (!trimmedLine.startsWith("data: ")) continue;

        try {
          const json: StreamChunk = JSON.parse(trimmedLine.slice(6));
          const content = json.choices[0]?.delta?.content;
          if (content) {
            yield { content };
          }
          if (json.choices[0]?.finish_reason) {
            yield { done: true };
          }
        } catch {
          // Skip malformed JSON chunks
        }
      }
    }

    yield { done: true };
  } catch (error) {
    console.error("OpenRouter streaming failed:", error);
    yield {
      error: error instanceof Error ? error.message : "Failed to connect to AI service",
    };
  }
}

/**
 * Parse JSON from AI response, handling markdown code blocks
 */
export function parseJsonResponse<T>(content: string): T | null {
  try {
    // Try direct parse first
    return JSON.parse(content);
  } catch {
    // Try extracting JSON from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        return null;
      }
    }
    return null;
  }
}
