export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  // If the deep link is a password reset link, route to the auth screen
  // so the PASSWORD_RECOVERY handler can pick it up
  if (path.includes('reset-password') || path.includes('type=recovery')) {
    return '/auth';
  }
  return path || '/';
}