/**
 * Learning from a choice between prepared replies, for the
 * `pretraining-vs-posttraining` node.
 *
 * THE QUESTION. Why does a model answer your question, instead of adding more
 * questions? The node's first recorded misconception is that helpfulness falls
 * out of pretraining. Reading a paragraph about that does not shift it; being
 * the person whose choice moves the numbers might.
 *
 * WHAT IS REAL HERE. A softmax choice model over three fixed replies, trained
 * by one gradient step on cross-entropy. `chances` is the softmax, `howFarOff`
 * is the loss it is trained against, and `learnFrom` is the gradient of that
 * loss. Nothing moves a bar by a hard-coded amount and nothing swaps a reply
 * for a different one after a press.
 *
 * WHAT IS INVENTED, SAID ON SCREEN. The three replies are written by hand for
 * this example, and `OPENING_SCORES` is a made-up "before" state rather than
 * anything measured from a real pretrained model. Both are labelled in the
 * panel beside the thing they describe.
 *
 * WHAT IS A TEACHING CHOICE, SAID ON SCREEN. Three replies, not a vocabulary.
 * Real post-training adjusts a great many saved numbers from examples and other
 * feedback, and is not any single tidy method; this is a narrow demonstration
 * of one idea inside it — that a choice between candidate replies can be turned
 * into a change in how likely each one is.
 *
 * TWO THINGS ARE THE SHAPE OF A FUNCTION, NOT A PROMISE IN A COMMENT.
 *
 * 1. Only the chance of choosing among the supplied replies can move. The state
 *    carries one score per entry of `REPLIES` and `learnFrom` returns a list of
 *    the same length; there is nowhere for reply text, or for anything about
 *    bicycles, to be learned. Nothing here can improve an answer to a question
 *    these three replies do not already answer.
 *
 * 2. Pointing at a reply cannot train anything. `applyAction` returns the same
 *    `scores` array by REFERENCE for a `select`, so "inspecting or choosing
 *    changes no number" is checkable by identity rather than by reading the
 *    code. Learning happens in one place, under one action, and two presses in
 *    quick succession are exactly two steps applied in order.
 */

/** One prepared continuation of the question. Written by hand; never generated. */
export type Reply = {
  id: string;
  /** What kind of continuation this is, in the learner's words. */
  label: string;
  text: string;
  /** Why it is in the list, said on screen next to it. */
  note: string;
};

export const QUESTION = 'My bike has a flat tyre. What should I do first?';

/**
 * Three replies to the same question.
 *
 * The first is what a text continuer does with a question on its own: a
 * question is often followed by more questions, so more questions is a
 * plausible continuation. The other two both answer, and differ only in how
 * much they say — which is what makes the second half of the panel possible,
 * where choosing between them steers manner rather than willingness to answer.
 */
export const REPLIES: readonly Reply[] = [
  {
    id: 'more-questions',
    label: 'More questions',
    text: 'How long have you had the bike? Front or back tyre? Do you have a pump?',
    note: 'Carries on in the same shape. It does not answer.',
  },
  {
    id: 'first-step',
    label: 'A short first step',
    text: 'Stop riding and check which tyre is flat.',
    note: 'Answers, and stops.',
  },
  {
    id: 'fuller',
    label: 'A longer answer',
    text: 'Stop riding and check which tyre is flat. Riding on a flat can bend the wheel. Then look for a nail or a thorn in the tread.',
    note: 'Answers, then says why and what to look at next.',
  },
];

/**
 * The scores the panel opens on: 55% / 25% / 20% once they become chances.
 *
 * Made up for this example. A real base model's behaviour depends on the model
 * and on the surrounding text, and no number here is measured from one. The
 * panel says so beside them.
 */
export const OPENING_SCORES: readonly number[] = [1, 0.2, 0];

/** How far each score moves per round of learning. One fixed size; nothing on screen asks for it. */
export const STEP = 1;

/**
 * Scores to chances.
 *
 * The largest score is subtracted first. That changes no result — the same
 * amount cancels top and bottom — and it is what stops a large score becoming
 * `Infinity` and the whole list becoming `NaN`. A panel about where numbers
 * come from cannot print one that is not a number.
 */
export function chances(scores: readonly number[]): number[] {
  const largest = Math.max(...scores);
  const raised = scores.map(score => Math.exp(score - largest));
  const total = raised.reduce((sum, value) => sum + value, 0);
  return raised.map(value => value / total);
}

/**
 * How far off the choice was: the natural log of the chance given to the
 * chosen reply, made positive. Zero when that reply already had all the
 * chance, and larger the less chance it had.
 *
 * This is the loss the step below is derived from, and it is the same shape of
 * quantity as the `loss` node's "wrong by this much".
 */
export function howFarOff(scores: readonly number[], chosen: number): number {
  return -Math.log(chances(scores)[chosen]);
}

/**
 * One step of learning from one choice.
 *
 * `score − step × (chance − 1 if this is the chosen one else chance)`, which is
 * the gradient of `howFarOff` with respect to each score. The chosen reply's
 * score rises by `step × (1 − its chance)` and every other falls by
 * `step × its chance`, so the gap always widens and the chosen reply's chance
 * always goes up — there is no step size that overshoots, which is why the
 * panel offers none.
 */
export function learnFrom(scores: readonly number[], chosen: number, step: number = STEP): number[] {
  const current = chances(scores);
  return scores.map((score, index) => score - step * (current[index] - (index === chosen ? 1 : 0)));
}

/** The state of one learner's session with the panel. */
export type Chooser = {
  /** One score per entry of `REPLIES`, in that order. */
  scores: readonly number[];
  /** The reply pointed at, which no number depends on until `learn` runs. */
  chosen: string | null;
  /** The chances immediately before the last round, for the before-and-after readout. Null until one has run. */
  before: readonly number[] | null;
  rounds: number;
  /** Which reply the last round learned from. */
  lastLearned: string | null;
};

export type Action =
  | { kind: 'select'; id: string }
  | { kind: 'learn' }
  | { kind: 'reset' };

export function initialChooser(): Chooser {
  return { scores: OPENING_SCORES, chosen: null, before: null, rounds: 0, lastLearned: null };
}

export function indexOfReply(id: string | null): number {
  return REPLIES.findIndex(reply => reply.id === id);
}

/**
 * Every consequence of a press, worked out here.
 *
 * A reducer rather than a bag of setters, for the reason the working-backwards
 * experiment records: the actions are ordered and are not idempotent, so they
 * have to be applied one at a time to the state that preceded them. Two presses
 * in quick succession are two steps, in order, with none lost and none applied
 * twice. An action that would do nothing returns the state itself, so React
 * re-renders nothing.
 */
export function applyAction(state: Chooser, action: Action): Chooser {
  switch (action.kind) {
    case 'select': {
      if (indexOfReply(action.id) < 0 || action.id === state.chosen) return state;
      // `scores` is carried through by reference: pointing at a reply trains nothing.
      return { ...state, chosen: action.id };
    }
    case 'learn': {
      const index = indexOfReply(state.chosen);
      if (index < 0) return state;
      return {
        scores: learnFrom(state.scores, index),
        chosen: state.chosen,
        before: chances(state.scores),
        rounds: state.rounds + 1,
        lastLearned: state.chosen,
      };
    }
    case 'reset':
      return initialChooser();
  }
}

/**
 * A chance as a whole percentage, for the screen. Display only; nothing reads
 * it back.
 *
 * A chance that is genuinely above zero never prints as `0%`, and one genuinely
 * below one never prints as `100%`. Both states are real: measured, a losing
 * reply drops below half a percent on the 72nd round and the chosen one passes
 * 99.5% on the 134th, and neither ever arrives. Printing the rounded number
 * would say a reply had been ruled out, which is the opposite of what these
 * chances do — the same rule as the attention panel's `under 1%` and the
 * one-step-at-a-time panel's `under 0.01 minutes off`.
 */
export function percent(value: number): string {
  if (value > 0 && value < 0.005) return 'under 1%';
  if (value < 1 && value >= 0.995) return 'over 99%';
  return `${Math.round(value * 100)}%`;
}
