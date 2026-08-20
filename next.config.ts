import type { NextConfig } from 'next';

/**
 * Content-Security-Policy, for one reason above all others.
 *
 * A learner's Google API key lives in this browser's localStorage, which means
 * any script that runs on this page can read it. We cannot prevent that — it is
 * what localStorage is — but `connect-src` decides where a script is allowed to
 * SEND what it reads. Locked to ourselves and Google, an injected script can
 * take the key and have nowhere to put it.
 *
 * That is the difference between an XSS being a defacement and an XSS being a
 * key theft.
 */
const csp = [
  "default-src 'self'",
  // Next injects inline bootstrap and hydration scripts. Nonces would need a
  // proxy on every request; the connect-src lock below is what carries the
  // actual protection here.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Tailwind and next/font emit inline style.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  // The whole point: nowhere to exfiltrate to.
  "connect-src 'self' https://generativelanguage.googleapis.com",
  // Web Speech recognition runs through the browser, not a page connection.
  "media-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // The key is only ever sent over this origin; refuse plain HTTP.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default nextConfig;
