import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/seo';

/**
 * One entry, because there is one page worth arriving at.
 *
 * `/intro` is left out on purpose. It is the argument as a sequence and it is
 * not linked from anywhere yet; whether it is somewhere to send a stranger is a
 * product decision the owner has not made, and a sitemap entry would make it
 * for them.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, changeFrequency: 'monthly', priority: 1 }];
}
