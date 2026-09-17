/**
 * The words on the two destructive confirmations.
 *
 * Both actions used to happen on a single press. A confirmation that says only
 * "Are you sure?" is barely better: somebody deciding whether to press needs to
 * know what they would lose, in words, before they lose it. Kept here rather
 * than inline so a test can hold each one to naming it.
 *
 * No counts. "You would lose 7 solid ideas" is the score this product does not
 * keep, turning up in the one place it would sting most.
 */

export type Confirmation = {
  title: string;
  body: string;
  /** What is kept, so the loss is not assumed to be bigger than it is. */
  kept: string;
  confirm: string;
  cancel: string;
};

export const CLEAR_MAP: Confirmation = {
  title: 'Clear your map?',
  body: 'Every mark on your map — solid, half-held and not yet — goes back to not looked at. This conversation, any answer you have typed, and your progress in the hands-on experiments are cleared too. This cannot be undone.',
  kept: 'Your place in the walkthrough and your connection settings are kept.',
  confirm: 'Clear my map',
  cancel: 'Keep my map',
};

export const LOAD_EXAMPLE: Confirmation = {
  title: 'Replace your map with example progress?',
  body: 'This is a testing tool. It replaces every mark on your map with a made-up example, so your own marks are lost. This cannot be undone.',
  kept: 'The conversation, your place in the walkthrough and your connection settings are kept.',
  confirm: 'Replace with example',
  cancel: 'Keep my map',
};
