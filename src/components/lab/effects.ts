/**
 * The five effects that survived review, and what each one is allowed to mean.
 *
 * This was a shelf of eight. Three are gone — magnetism, press and aurora —
 * because none of them helped anyone read the graph, and two of them worked
 * against the composure the interface is deliberately built for. "Harmless" was
 * the strongest case for keeping press, and harmless is not a reason.
 *
 * What is left carries two fields that did not exist before, and they are the
 * point of the file:
 *
 * - `claim` — what the movement asserts. Motion in this product is an argument,
 *   and an effect that cannot finish "this moves because…" is decoration on a
 *   diagram somebody is going to make decisions about.
 * - `trigger` — the ONLY thing allowed to fire it in the product. This is the
 *   guardrail. The unlock wave is honest exactly when a learner's own
 *   explanation moved a node and dishonest the moment it fires because they
 *   were taught something, and the difference between those two is a wiring
 *   decision somebody will make in a hurry six months from now. Writing it next
 *   to the effect is cheaper than discovering it.
 */

export type EffectId = 'cascade' | 'flow' | 'pool' | 'glide' | 'ripple';

export type Effects = Record<EffectId, boolean>;

export const EFFECTS: { id: EffectId; name: string; claim: string; trigger: string }[] = [
  {
    id: 'cascade',
    name: 'Cascade',
    claim: 'These ideas rest on each other in this order — watch the chain resolve rather than be handed it.',
    trigger: 'Hover or selection. Changes no state, no glyph and no mark, and reverses when the pointer leaves.',
  },
  {
    id: 'flow',
    name: 'Current',
    claim: 'This edge points that way.',
    trigger: 'Drawn only on edges already inside the focused cone. Never implies traversal or progress.',
  },
  {
    id: 'pool',
    name: 'Light pool',
    claim: 'You are looking here.',
    trigger: 'Follows the focused node. Additive light, never a scrim — nothing is dimmed to produce it.',
  },
  {
    id: 'glide',
    name: 'Camera glide',
    claim: 'You did not teleport; this is the same drawing, moved.',
    trigger: 'Selection and deselection. Moves the camera only — never a node relative to another node.',
  },
  {
    id: 'ripple',
    name: 'Unlock wave',
    claim: 'Marking this solid opened a chain, and here is the chain.',
    trigger:
      'ONLY a node transitioning to `known` through explain-back. Must never fire because the walkthrough covered a node: being taught something does not move the map, and a wave that says it did is the product contradicting its own central rule.',
  },
];

export const ALL_ON: Effects = { cascade: true, flow: true, pool: true, glide: true, ripple: true };
export const ALL_OFF: Effects = {
  cascade: false,
  flow: false,
  pool: false,
  glide: false,
  ripple: false,
};
