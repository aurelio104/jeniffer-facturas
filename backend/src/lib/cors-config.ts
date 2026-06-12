import type cors from 'cors';

function normalizeOrigin(url: string) {
  return url.replace(/\/$/, '');
}

/** Orígenes permitidos: FRONTEND_URL, CORS_ORIGINS, localhost y túneles trycloudflare. */
export function buildCorsOptions(): cors.CorsOptions {
  const allowed = new Set<string>();
  const frontend = process.env.FRONTEND_URL?.trim();
  if (frontend) allowed.add(normalizeOrigin(frontend));

  if (process.env.VERCEL_URL) {
    allowed.add(`https://${process.env.VERCEL_URL}`);
  }

  for (const raw of process.env.CORS_ORIGINS?.split(',') ?? []) {
    const o = raw.trim();
    if (o) allowed.add(normalizeOrigin(o));
  }

  const allowTunnel =
    process.env.ALLOW_CLOUDFLARE_TUNNEL === '1' ||
    process.env.NODE_ENV !== 'production';

  const localhostRe = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  const tunnelRe = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;
  const vercelAppRe = /^https:\/\/[a-z0-9-]+(-[a-z0-9-]+)*\.vercel\.app$/i;

  return {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowed.size === 0) return cb(null, true);
      const o = normalizeOrigin(origin);
      if (allowed.has(o)) return cb(null, true);
      if (localhostRe.test(o)) return cb(null, true);
      if (process.env.VERCEL && vercelAppRe.test(o)) return cb(null, true);
      if (allowTunnel && tunnelRe.test(o)) return cb(null, true);
      cb(null, false);
    }
  };
}
