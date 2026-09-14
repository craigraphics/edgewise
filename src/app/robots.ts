import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/seo';

/**
 * `/api` is a POST-only turn endpoint that spends against a shared free-tier
 * quota, and nothing under it renders. A crawler poking at it costs real
 * requests and gets nothing back.
 *
 * `/lab` is the motion harness. It is deliberately unlinked — a testing
 * harness in the main navigation is a mistake this project has already made
 * once — and an indexed one is the same mistake by another route.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/lab'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
