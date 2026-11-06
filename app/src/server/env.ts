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
