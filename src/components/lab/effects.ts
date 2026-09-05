/**
 * The eight effects the lab is asking about, and what each one is FOR.
 *
 * The blurb is not decoration. This product's rule is that motion has to say
 * something true — the shipped map allows exactly two loops, on the grounds
 * that each answers a question continuously — so an effect that cannot finish
 * the sentence "this moves because…" is one to delete rather than to tune.
 * Writing the sentence down next to the switch is how that judgement gets made
 * while looking at the thing rather than afterwards.
 */

export type EffectId =
  | 'cascade'
  | 'flow'
  | 'pool'
  | 'magnet'
  | 'press'
  | 'glide'
  | 'ripple'
  | 'aurora';

export type Effects = Record<EffectId, boolean>;

export const EFFECTS: { id: EffectId; name: string; says: string }[] = [
  {
    id: 'cascade',
    name: 'Cascade',
    says: 'The cone lights outward a step at a time, so you watch the chain resolve instead of being handed it.',
  },
  {
    id: 'flow',
    name: 'Current',
    says: 'Which way an edge points, without putting 33 arrowheads on a crowded map.',
  },
  {
    id: 'pool',
    name: 'Light pool',
    says: 'Where you are looking. A pool of the band colour rather than a scrim, because dimming reads as switched off.',
  },
  {
    id: 'magnet',
    name: 'Magnetism',
    says: 'The map is live and responds to you. Says nothing about the graph — pure personality, and the first thing to cut if it reads as fidgety.',
  },
  {
    id: 'press',
    name: 'Press',
    says: 'The box took the click. Overshoots on release, which the shipped motion system forbids everywhere.',
  },
  {
    id: 'glide',
    name: 'Camera glide',
    says: 'You did not teleport. The map moved and you can see where from, so the drawing stays one continuous place.',
  },
  {
    id: 'ripple',
    name: 'Unlock wave',
    says: 'Marking an idea solid opened a chain, not a region — so the wave travels through the dependants in order.',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    says: 'Mood only. Sits behind opaque cards so it cannot touch a label’s measured contrast; what it can cost is calm.',
  },
];

export const ALL_ON: Effects = {
  cascade: true,
  flow: true,
  pool: true,
  magnet: true,
  press: true,
  glide: true,
  ripple: true,
  aurora: true,
};

export const ALL_OFF: Effects = {
  cascade: false,
  flow: false,
  pool: false,
  magnet: false,
  press: false,
  glide: false,
  ripple: false,
  aurora: false,
};
