import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { createThirdwebClient } from 'thirdweb';
import { getUser } from 'thirdweb/wallets';
import { verifyMessage, type Address, type Hex } from 'viem';
import { verifiedGithubWallet } from '../lib/reward-policy';
import { db, one, query, rpc } from './db';
import { AppError, appOrigin, required } from './env';

const cookieName = 'poc-contributor';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export async function thirdwebIdentity(wallet: string) {
  const user = await getUser({
    client: createThirdwebClient({ secretKey: required('THIRDWEB_SECRET_KEY') }),
    walletAddress: wallet,
  });
  try {
    return verifiedGithubWallet(user, wallet);
  } catch {
    throw new AppError(
      403,
      'FORGE_IDENTITY_REQUIRED',
      'This embedded wallet must have a server-verified numeric GitHub identity',
    );
  }
}

export async function contributorChallenge(wallet: Address) {
  const expiresAt = new Date(Date.now() + 300000).toISOString();
  const message = `Hugo contributor authorization\nDomain: ${appOrigin()}\nWallet: ${wallet}\nNonce: ${randomBytes(32).toString('hex')}\nExpires: ${expiresAt}\nPurpose: Link verified GitHub identity for current and future Arc rewards`;
  const row = await query<any>(
    db()
      .from('claim_challenges')
      .insert({ wallet_address: wallet, message, expires_at: expiresAt })
      .select('id')
      .single(),
  );
  return { challengeId: row.id, message };
}

export async function verifyContributor(
  challengeId: string,
  wallet: Address,
  signature: Hex,
) {
  const challenge = await one('claim_challenges', challengeId);
  if (
    challenge.wallet_address !== wallet ||
    challenge.consumed_at ||
    Date.parse(challenge.expires_at) <= Date.now() ||
    !challenge.message.includes(`Domain: ${appOrigin()}\n`) ||
    !(await verifyMessage({ address: wallet, message: challenge.message, signature }))
  ) {
    throw new AppError(
      403,
      'INVALID_CHALLENGE',
      'Invalid or expired embedded-wallet signature',
    );
  }
  const identity = await thirdwebIdentity(wallet);
  const token = randomBytes(32).toString('hex');
  const linked = await rpc('link_contributor_wallet', {
    p_challenge: challengeId,
    p_wallet: wallet,
    p_identity: identity.providerUserId,
    p_thirdweb: identity.thirdwebUserId,
    p_token_hash: digest(token),
  });
  if (!linked) {
    throw new AppError(409, 'CHALLENGE_CONSUMED', 'Challenge was already used');
  }
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 1800,
  });
  return { linked: true, wallet };
}

export async function contributorSession() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    throw new AppError(401, 'SIGN_IN_REQUIRED', 'Sign in with thirdweb GitHub');
  }
  const session = await query<any>(
    db()
      .from('claim_sessions')
      .select('*')
      .eq('token_hash', digest(token))
      .gt('expires_at', new Date().toISOString())
      .maybeSingle(),
  );
  if (!session) {
    throw new AppError(401, 'SESSION_EXPIRED', 'Sign in again');
  }
  return session;
}
