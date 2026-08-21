import { ImageResponse } from 'next/og';

/**
 * The social card.
 *
 * Drawn rather than shipped as a PNG so the wording cannot drift away from the
 * page's own. Deliberately uses no external font and no image file: an
 * `ImageResponse` that fetches anything at build time turns a network blip into
 * a failed deploy, and the built-in face is legible at this size.
 *
 * The mark is the same circle-in-ring as the favicon, rebuilt from two divs —
 * closer to the real thing than embedding an SVG the renderer supports only in
 * part.
 */
export const alt = 'Edgewise — find the idea blocking the rest';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#f4f7fb';
const BRAND = '#13a1d7';
const RING = '#d5e5e9';
const GROUND = '#131c2b';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: GROUND,
          padding: 80,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 84,
              height: 84,
              borderRadius: 84,
              border: `8px solid ${RING}`,
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 32, background: BRAND }} />
          </div>
          <div style={{ fontSize: 46, fontWeight: 600, color: INK, letterSpacing: -1 }}>Edgewise</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Two elements rather than one with a <br />: the renderer requires an
              explicit display on any node with more than one child, and a line
              break counts as one. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 82,
              fontWeight: 600,
              color: INK,
              letterSpacing: -2.5,
              lineHeight: 1.05,
            }}
          >
            <div>Find the one idea</div>
            <div>blocking the rest.</div>
          </div>
          <div style={{ fontSize: 34, color: '#94a7bd', lineHeight: 1.35 }}>
            A map of where your understanding of AI stops — and the way through it.
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 26, color: '#6f8399' }}>
          edgewise.craigraphics.com · by William Craig
        </div>
      </div>
    ),
    size,
  );
}
