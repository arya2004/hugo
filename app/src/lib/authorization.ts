import { AppError } from '../server/env';

export function authorizeOwner(
  program: { owner_auth_user_id: string; owner_github_id: string },
  principal: { authUserId: string; githubUserId: string },
) {
  if (
    program.owner_auth_user_id !== principal.authUserId ||
    program.owner_github_id !== principal.githubUserId
  ) {
    throw new AppError(403, 'OWNER_REQUIRED', 'Project admin required');
  }
}
