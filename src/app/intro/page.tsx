import type { Metadata } from 'next';

import { Overture } from '@/components/overture/overture';
import { GRAPH } from '@/lib/graph/load';

export const metadata: Metadata = {
  title: 'Edgewise — the shape of what you do not know yet',
};

/**
 * The opening argument, as its own route.
 *
 * Not the app, and not linked from it yet. The product states its premise in a
 * first-run dialog and then asks someone to believe it; this shows it instead,
 * which is a different claim on someone's attention and should be judged on its
 * own before it is put in anybody's way.
 */
export default function IntroPage() {
  return <Overture graph={GRAPH} />;
}
