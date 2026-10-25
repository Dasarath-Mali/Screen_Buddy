/**
 * Cloudflare Turnstile Verification (Optional bot protection)
 */

export async function verifyTurnstile(token?: string, remoteIp?: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey || !token) {
    // If not configured, bypass
    return true;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    return !!data.success;
  } catch {
    // If Turnstile service is unreachable, allow request to avoid blocking real users
    return true;
  }
}
