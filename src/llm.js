import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { AnalysisError } from "./errors.js";

export const DEFAULT_MODEL = "gemini-3.1-flash-lite";

const KEY_HINT = "Add GEMINI_API_KEY=<your key> to a .env file in the current directory (see .env.example).";

/** Attempts per request, including the first. The SDK retries 408, 429 and 5xx with exponential backoff. */
const RETRY_ATTEMPTS = 4;

/**
 * An LLM client is any object with this method. extraction.js and matching.js
 * depend only on this shape, so tests can pass in a fake.
 *
 * @typedef {object} Llm
 * @property {(request: {system: string, user: string, schema: import("zod").ZodType}) => Promise<any>} parse
 *   Returns the model's output validated against `schema`, or throws an AnalysisError.
 */

/**
 * @param {{apiKey?: string, model?: string, client?: GoogleGenAI}} [options]
 *   `client` replaces the SDK client in tests; the API key is then not needed.
 * @returns {Llm}
 */
export function createGeminiLlm({
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.JOBPILOT_MODEL || DEFAULT_MODEL,
  client,
} = {}) {
  if (!client) {
    if (!apiKey?.trim()) {
      throw new AnalysisError(`No Gemini API key was found. ${KEY_HINT}`);
    }
    client = new GoogleGenAI({ apiKey: apiKey.trim(), httpOptions: { retryOptions: { attempts: RETRY_ATTEMPTS } } });
  }

  return {
    async parse({ system, user, schema }) {
      let response;
      try {
        response = await client.models.generateContent({
          model,
          contents: user,
          config: {
            systemInstruction: system,
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(schema),
          },
        });
      } catch (error) {
        throw toAnalysisError(error, model);
      }

      const blockReason = response.promptFeedback?.blockReason;
      if (blockReason) {
        throw new AnalysisError(`Gemini blocked the request (${blockReason}).`);
      }
      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason === "MAX_TOKENS") {
        throw new AnalysisError("Gemini's response was cut off before it finished.");
      }
      if (finishReason !== "STOP") {
        throw new AnalysisError(`Gemini stopped without finishing its response (${finishReason ?? "no response"}).`);
      }

      let data;
      try {
        data = JSON.parse(response.text ?? "");
      } catch {
        throw new AnalysisError("Gemini's response was not valid JSON.");
      }
      const result = schema.safeParse(data);
      if (!result.success) {
        throw new AnalysisError(`Gemini's response did not match the expected format: ${z.prettifyError(result.error)}`);
      }
      return result.data;
    },
  };
}

/** Map an SDK failure to a readable AnalysisError. The key is never included. */
export function toAnalysisError(error, model) {
  if (!(error instanceof ApiError)) {
    return new AnalysisError(`Could not reach the Gemini API: ${error.message}`, { cause: error });
  }

  const detail = apiErrorDetail(error);
  const { status } = error;
  let message;
  if ((status === 400 && /API.?KEY/i.test(error.message)) || status === 401 || status === 403) {
    message = `The Gemini API rejected the API key: ${detail}\n${KEY_HINT}`;
  } else if (status === 404) {
    message = `The Gemini API could not find model "${model}". Check the JOBPILOT_MODEL environment variable.`;
  } else if (status === 429) {
    message = `The Gemini API rate limit or quota was reached, even after retrying. Try again later. (${detail})`;
  } else if (status >= 500) {
    message = `The Gemini API is unavailable right now (${status}), even after retrying. Try again in a few minutes.`;
  } else {
    message = `The Gemini API returned an error (${status}): ${detail}`;
  }
  return new AnalysisError(message, { cause: error });
}

/** ApiError messages hold the raw JSON body; pull out the human-readable part when there is one. */
function apiErrorDetail(error) {
  try {
    return JSON.parse(error.message).error?.message ?? error.message;
  } catch {
    return error.message;
  }
}
