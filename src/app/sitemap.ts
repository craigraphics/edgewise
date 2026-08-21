import type { MetadataRoute } from 'next';

/**
 * One page, because there is one page.
 *
 * Kept as a route rather than a static file so that adding a second URL is a
 * line here instead of a thing to remember.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://edgewise.craigraphics.com',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
