import type { ConceptGraph, LearnerModel } from './types';

/**
 * A hand-made learner state, for looking at the map before any agent exists.
 *
 * Build order step 3 is "render the map with fake state and stop and look at
 * it". The point of a fixture rather than a random generator is that this
 * particular shape is the one worth judging: someone comfortable with the
 * foundations and the language stack in outline, who never got neural networks,
 * and is therefore quietly locked out of most of the map without knowing it.
 *
 * If THIS picture does not produce recognition, the idea does not work, and no
 * amount of agent quality rescues it.
 */
export function plausibleLearner(graph: ConceptGraph): LearnerModel {
  return {
    graphVersion: graph.version,
    states: {
      'prediction-from-examples': 'known',
      'features-and-representation': 'known',
      'training-vs-inference': 'known',
      loss: 'known',
      'generalization-overfitting': 'known',
      'gradient-descent': 'shaky',
      tokens: 'known',
      neuron: 'blocked',
      'train-test-split': 'unexplored',
      embeddings: 'shaky',
    },
  };
}
