import type { MetadataRoute } from 'next';

/**
 * Crawling rules.
 *
 * `/api/` is disallowed because it is a POST-only turn endpoint that spends
 * against a shared free-tier quota. Nothing under it renders, so there is
 * nothing to index and a crawler poking at it costs real requests.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: 'https://edgewise.craigraphics.com/sitemap.xml',
    host: 'https://edgewise.craigraphics.com',
  };
}
