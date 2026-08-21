import type { MetadataRoute } from 'next';

/**
 * Installable-app metadata.
 *
 * The icons are PNGs in `public/` rather than the `icon.svg` next to this file:
 * app-directory icons are served on a hashed path that changes between builds,
 * and a manifest pointing at one would break every time the file did not.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Edgewise — find the idea blocking the rest',
    short_name: 'Edgewise',
    description:
      'Find the one idea blocking the rest of your understanding of AI, then learn the whole thing from there.',
    start_url: '/',
    display: 'standalone',
    background_color: '#131c2b',
    theme_color: '#13a1d7',
    categories: ['education'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
