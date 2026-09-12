/**
 * The concepts that have a playable experiment, and the per-concept copy the
 * shell needs to offer one.
 *
 * The shell used to branch on `'neuron'`, then on `'neuron' | 'tokens'`, in five
 * places. A third one made that unreadable, so the per-concept strings live here
 * and the shell looks them up. This is a lookup table, not a framework: adding
 * another still means writing its component and rendering it explicitly.
 */
export const EXPERIMENT_IDS = ['neuron', 'tokens', 'prediction-from-examples', 'features-and-representation', 'training-vs-inference'] as const;
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
};

/** The heading each experiment focuses when it opens. */
export const EXPERIMENT_TITLE_ID: Record<ExperimentId, string> = {
  neuron: 'neuron-lab-title',
  tokens: 'tokenizer-lab-title',
  'prediction-from-examples': 'predictor-lab-title',
  'features-and-representation': 'representation-lab-title',
  'training-vs-inference': 'phases-lab-title',
};

/** The inspector's button into the experiment. */
export const EXPERIMENT_ACTION: Record<ExperimentId, string> = {
  neuron: 'Try the neuron experiment',
  tokens: 'Try the tokenizer playground',
  'prediction-from-examples': 'Try the predictor experiment',
  'features-and-representation': 'Try the representation playground',
  'training-vs-inference': 'Try the training-and-using experiment',
};

/** The workspace heading while an experiment is open. */
export const EXPERIMENT_HEADLINE: Record<ExperimentId, string> = {
  neuron: 'The neuron, up close.',
  tokens: 'Text, piece by piece.',
  'prediction-from-examples': 'A rule, worked out from examples.',
  'features-and-representation': 'The picture, as numbers.',
  'training-vs-inference': 'One rule, many answers.',
};

/**
 * The question the existing explanation form opens with. It asks for the
 * mechanism, never for the answer, and the field is always empty.
 */
export const EXPERIMENT_PROMPT: Record<ExperimentId, string> = {
  neuron: 'What did changing the weight do? How did the inputs become one output? Explain it in your own words.',
  tokens: 'Why can the number of tokens differ from the number of words?',
  'prediction-from-examples': 'If nobody typed the final rule, where did this model’s predictions come from?',
  'features-and-representation': 'If both pictures become the same number, what has the model lost?',
  'training-vs-inference': 'When the answer changes, what has actually changed — the question, or the rule? How can you tell?',
};
