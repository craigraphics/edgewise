/**
 * The concepts that have a playable experiment, and the per-concept copy the
 * shell needs to offer one.
 *
 * The shell used to branch on `'neuron'`, then on `'neuron' | 'tokens'`, in five
 * places. A third one made that unreadable, so the per-concept strings live here
 * and the shell looks them up. This is a lookup table, not a framework: adding
 * another still means writing its component and rendering it explicitly.
 */
export const EXPERIMENT_IDS = ['neuron', 'tokens', 'prediction-from-examples', 'features-and-representation', 'training-vs-inference', 'loss', 'gradient-descent', 'generalization-overfitting'] as const;
export type ExperimentId = (typeof EXPERIMENT_IDS)[number];

export function isExperimentId(id: string | null | undefined): id is ExperimentId {
  return (EXPERIMENT_IDS as readonly string[]).includes(id ?? '');
}

export const EMPTY_EXPLAIN_REQUESTS: Record<ExperimentId, number> = {
  neuron: 0,
  tokens: 0,
  'prediction-from-examples': 0,
  'features-and-representation': 0,
  'training-vs-inference': 0,
  loss: 0,
  'gradient-descent': 0,
  'generalization-overfitting': 0,
};

/** The heading each experiment focuses when it opens. */
export const EXPERIMENT_TITLE_ID: Record<ExperimentId, string> = {
  neuron: 'neuron-lab-title',
  tokens: 'tokenizer-lab-title',
  'prediction-from-examples': 'predictor-lab-title',
  'features-and-representation': 'representation-lab-title',
  'training-vs-inference': 'phases-lab-title',
  loss: 'loss-lab-title',
  'gradient-descent': 'steps-lab-title',
  'generalization-overfitting': 'generalization-lab-title',
};

/** The inspector's button into the experiment. */
export const EXPERIMENT_ACTION: Record<ExperimentId, string> = {
  neuron: 'Try the movie-score experiment',
  tokens: 'Try the tokenizer playground',
  'prediction-from-examples': 'Try the predictor experiment',
  'features-and-representation': 'Try the representation playground',
  'training-vs-inference': 'Try the training-and-using experiment',
  loss: 'Try the how-far-off experiment',
  'gradient-descent': 'Try the one-step-at-a-time experiment',
  'generalization-overfitting': 'Try the memorising-or-learning experiment',
};

/** The workspace heading while an experiment is open. */
export const EXPERIMENT_HEADLINE: Record<ExperimentId, string> = {
  neuron: 'One neuron, one movie score.',
  tokens: 'Text, piece by piece.',
  'prediction-from-examples': 'A rule, worked out from examples.',
  'features-and-representation': 'The picture, as numbers.',
  'training-vs-inference': 'One rule, many answers.',
  loss: 'Wrong, and how wrong.',
  'gradient-descent': 'Closer, one step at a time.',
  'generalization-overfitting': 'A perfect score, and what it hid.',
};

/**
 * The question the existing explanation form opens with. It asks for the
 * mechanism, never for the answer, and the field is always empty.
 */
export const EXPERIMENT_PROMPT: Record<ExperimentId, string> = {
  neuron: 'How did the two movie numbers become one output? What did changing a weight do? Explain it in your own words.',
  tokens: 'Why can the number of tokens differ from the number of words?',
  'prediction-from-examples': 'If nobody typed the final rule, where did this model’s predictions come from?',
  'features-and-representation': 'If both pictures become the same number, what has the model lost?',
  'training-vs-inference': 'When the answer changes, what has actually changed — the question, or the rule? How can you tell?',
  loss: 'Why would “wrong by this much” be more useful to a model than just “wrong”?',
  'gradient-descent': 'Why can a step in the helpful direction still leave the guess further away, if the step is too big?',
  'generalization-overfitting': 'Why did the cracked phone help one rule on the examples it saw, but hurt it on the sales kept hidden?',
};
