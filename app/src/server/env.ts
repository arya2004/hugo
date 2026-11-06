import { z } from 'zod';

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function required(name: string) {
  const value = process.env[name];
  if (
    !value ||
    /^(PASTE_|YOUR_|SERVER_ONLY|DEPLOYED_|LONG_RANDOM|DIFFERENT_LONG|TEST_WALLET|ACCESS_KEY_|MODEL_ID_|READ_ONLY_|FINE_GRAINED_)/.test(
      value,
    )
  ) {
    throw new AppError(503, 'CONFIGURATION_REQUIRED', `Missing configured ${name}`);
  }
  return value;
}

export function appOrigin() {
  return new URL(required('NEXT_PUBLIC_APP_URL')).origin;
}

export function secret(name: string) {
  return z.string().min(32).parse(required(name));
}

export function evaluationConfig() {
  const provider = process.env.AI_PROVIDER ?? '0g';
  if (provider !== '0g' && provider !== 'openai') {
    throw new AppError(503, 'INVALID_AI_PROVIDER', 'AI_PROVIDER must be 0g or openai');
  }
  const openai = provider === 'openai';
  return {
    provider,
    baseURL: openai ? 'https://api.openai.com/v1' : 'https://router-api.0g.ai/v1',
    apiKey: required(openai ? 'OPENAI_API_KEY' : 'OG_API_KEY'),
    model: required(openai ? 'OPENAI_MODEL' : 'OG_MODEL'),
  };
}
