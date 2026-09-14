import type { MetadataRoute } from 'next';

import { DESCRIPTION, SITE_NAME } from '@/lib/seo';

/**
 * The icons point at files in `public/` rather than at the app-directory icon.
 * Those are served on a hashed path that changes between builds, and a manifest
 * naming one would break every time the file did not.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0c11',
    theme_color: '#0a0c11',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
