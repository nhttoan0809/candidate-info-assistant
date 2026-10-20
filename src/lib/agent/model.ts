import 'server-only';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { getEnv } from '../env';

export function getModel(classifier = false) {
  const env = getEnv();
  const provider = createOpenAICompatible({
    name: 'ollama',
    baseURL: env.MODEL_URL,
    apiKey: env.MODEL_API_KEY || undefined,
    includeUsage: true,
    supportsStructuredOutputs: true,
    // Ollama's OpenAI endpoint uses reasoning_effort rather than the native think field.
    transformRequestBody: (body) =>
      classifier
        ? { ...body, reasoning_effort: 'none' }
        : env.MODEL_REASONING_EFFORT === 'provider-default'
          ? body
          : { ...body, reasoning_effort: env.MODEL_REASONING_EFFORT },
  });
  return provider.chatModel(
    classifier ? env.CLASSIFIER_MODEL_NAME || env.MODEL_NAME : env.MODEL_NAME,
  );
}
