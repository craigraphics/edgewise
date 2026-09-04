import { GLYPH_RADIUS } from '@/lib/map/layout';
import type { NodeState } from '@/lib/graph/types';

/**
 * The state, drawn as a shape.
 *
 * The previous map encoded state as a dash pattern on a 1.3px border —
 * solid / `5 3` / `2 4` / solid-but-fainter — at four fill opacities between 5%
 * and 90%. The difference between "not yet" and "not looked at" was about one
 * pixel of pattern and two per cent of fill, which is not a distinction anyone
 * can make, and it left the map's four states legible only to someone who
 * already knew the code.
 *
 * A filled disc, a half disc, an open ring and a faint dot survive greyscale,
 * every kind of colour blindness, and a screenshot scaled to a third. That is
 * the requirement: state must never be carried by colour.
 *
 * `blocked` is an OPEN RING and not a cross, a warning or anything red. It is
 * drawn as waiting, because that is what it means — we asked, and the idea is
 * not there yet. Red is reserved for nothing in this product.
 */

type Props = {
  state: NodeState;
  /** Centre, in the parent group's coordinates. */
  cx: number;
  cy: number;
  colour: string;
};

export function NodeGlyph({ state, cx, cy, colour }: Props) {
  if (state === 'unexplored') {
    // Nobody has asked. The mark is present but says almost nothing, which is
    // exactly how much we know.
    return <circle cx={cx} cy={cy} r={2} fill="var(--muted-foreground)" fillOpacity={0.7} />;
  }

  const ring = (
    <circle cx={cx} cy={cy} r={GLYPH_RADIUS} fill="none" stroke={colour} strokeWidth={1.5} />
  );

  if (state === 'blocked') return ring;

  if (state === 'known') return <circle cx={cx} cy={cy} r={GLYPH_RADIUS} fill={colour} />;

  // shaky: half filled, which is the literal picture of "half-held".
  return (
    <>
      {ring}
      <path
        d={`M ${cx} ${cy - GLYPH_RADIUS} A ${GLYPH_RADIUS} ${GLYPH_RADIUS} 0 0 1 ${cx} ${cy + GLYPH_RADIUS} Z`}
        fill={colour}
      />
    </>
  );
}
