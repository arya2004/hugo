import { AppError } from './env';

const base = 'https://api.github.com';

export async function github(path: string, init: RequestInit = {}) {
  const token = process.env.GITHUB_READ_TOKEN;
  const response = await fetch(base + path, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ProofOfContribution',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new AppError(
      503,
      'GITHUB_UNAVAILABLE',
      `GitHub request failed (${response.status})`,
    );
  }
  return response;
}
