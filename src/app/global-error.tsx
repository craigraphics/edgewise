'use client';

/**
 * The last resort: a throw in the root layout, where `error.tsx` cannot help
 * because the layout that would render it is the thing that failed.
 *
 * Replaces the whole document, so it ships its own <html> and its own styles —
 * the stylesheet may be exactly what did not load.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem',
          background: '#0c141a',
          color: '#e6ecef',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          lineHeight: 1.6,
        }}
      >
        <div style={{ maxWidth: '32rem' }}>
          <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem' }}>This page failed to load.</h1>
          <p style={{ margin: '0 0 1.5rem', color: '#afc0c8' }}>
            Your progress is kept in this browser and has not been lost. Reloading should restore it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              height: 40,
              padding: '0 1rem',
              borderRadius: 8,
              border: 0,
              background: '#e6ecef',
              color: '#0c141a',
              font: 'inherit',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          {error.digest ? (
            <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#7d9099' }}>Reference: {error.digest}</p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
