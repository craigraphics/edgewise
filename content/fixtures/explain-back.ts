/**
 * Explanations of known quality, for the only assessor that can clear a block.
 *
 * `explainBack` has two fatal directions rather than one, and the second is
 * specific to it:
 *
 * - **False pass** — a parrot or a wrong model coming back `known`. Clears a
 *   block that should not clear, and the map then lies about the learner.
 * - **False block** — a genuinely good explanation refused. Worse here than in
 *   the diagnostic: this is the one thing someone does voluntarily, and the
 *   design promises that trying can never cost you. If it also never *pays*,
 *   nobody explains anything back and the feature is dead.
 *
 * Which is why `clumsy` exists as its own class. The prompt claims that someone
 * explaining it badly in everyday words has understood more than someone
 * reciting the right terms — and a model's default bias runs the other way, so
 * that claim has to be measured rather than asserted.
 *
 * ## Why `technical` was split out of `parroted`
 *
 * The first version of this file failed 7/60, and inspecting the failures showed
 * the fixtures were wrong rather than the model. "Updating parameters in the
 * direction of the negative gradient" was labelled a parrot because it is
 * jargon — but it states the mechanism, and this product's own rule is that
 * vocabulary is not what counts. Marking it as a false pass was asking the
 * assessor to reject a correct answer for being well-dressed.
 *
 * So the class split in two rather than the test being relaxed:
 *
 * - `technical` — correct mechanism, expressed in jargon. **Must pass.** It is
 *   `clumsy` in a dinner jacket, and holds the vocabulary-blindness claim to
 *   account from the opposite direction.
 * - `parroted` — names and categorises without ever saying what happens. **Must
 *   not pass.**
 *
 * The distinguishing question, applied to every case here: does the answer say
 * what actually happens, or only what the thing is called?
 */

export type ExplainLabel = 'solid' | 'clumsy' | 'technical' | 'parroted' | 'misconception' | 'empty';

export type ExplainFixture = {
  nodeId: string;
  cases: { label: ExplainLabel; explanation: string }[];
};

export const EXPLAIN_FIXTURES: ExplainFixture[] = [
  {
    nodeId: 'neuron',
    cases: [
      {
        label: 'solid',
        explanation:
          "It takes the numbers coming in, and each one gets multiplied by its own weight — basically how much that input counts for. Adds them all up into a single number, then pushes that through something that bends it so it is not just a straight line. The weights are the part that gets learned.",
      },
      {
        label: 'clumsy',
        explanation:
          "So it is like... you have got a bunch of numbers arriving, right, and each one has a sort of, I do not know, an importance dial on it? And you times them by that and then just add the whole lot together. And then there is a bit at the end that squishes it. That is honestly it, it is just sums.",
      },
      {
        label: 'technical',
        explanation:
          'It is a computational unit that applies learned weights to its inputs, sums them, and produces an activation by passing that sum through a non-linear transfer function.',
      },
      {
        label: 'parroted',
        explanation:
          'It is the fundamental computational primitive of a neural architecture, and the properties of the network emerge from how large numbers of them are composed across layers.',
      },
      {
        label: 'misconception',
        explanation:
          'It is like a brain cell — it collects signals from the ones before it, and when there is enough it fires, and that goes down the synapse to the next one.',
      },
      { label: 'empty', explanation: 'It is a thing inside a neural network. They are all connected up.' },
    ],
  },
  {
    nodeId: 'training-vs-inference',
    cases: [
      {
        label: 'solid',
        explanation:
          "Training happened once, ages ago, and cost a fortune, and then it got frozen. When I am chatting to it nothing about it is changing — it just gets sent the whole conversation again every single time, so it looks like it remembers when really it is re-reading.",
      },
      {
        label: 'clumsy',
        explanation:
          "It has already done all its learning before I ever got to it. So me talking to it does not do anything to it. And the reason it knows what I said earlier is just that... they keep giving it the whole chat again? Every message? I think that is it.",
      },
      {
        label: 'technical',
        explanation:
          'The parameters are optimised during training and then frozen; at inference the forward pass runs against fixed weights, and any apparent memory is the prior turns being resupplied in the context window.',
      },
      {
        label: 'parroted',
        explanation:
          'There is a clear separation between the training phase and the inference phase in the model lifecycle, with deployment following the completion of training.',
      },
      {
        label: 'misconception',
        explanation:
          'It is learning from me as we talk — that is why it gets better at answering me the longer the conversation goes on.',
      },
      { label: 'empty', explanation: 'I do not really know. Something about different phases?' },
    ],
  },
  {
    nodeId: 'hallucination',
    cases: [
      {
        label: 'solid',
        explanation:
          "It was never trained to be right, only to produce things that look like what it saw. A made-up citation that looks exactly like a real one is a great answer by that measure. And nothing inside it marks which bits are real, so it comes out sounding equally sure either way.",
      },
      {
        label: 'clumsy',
        explanation:
          "It does not know the difference? Like it is not choosing to make something up, it is doing the exact same thing it always does, and this time the thing that looked right just was not real. There is no bit of it going careful, I am not sure about this one.",
      },
      {
        label: 'technical',
        explanation:
          'The objective optimises likelihood under the training distribution rather than factual accuracy, so a well-formed but fabricated output scores well, and the decoder carries no calibrated signal separating the two.',
      },
      {
        label: 'parroted',
        explanation:
          'Hallucination is a known limitation arising from the probabilistic nature of autoregressive generation and from gaps in the training distribution.',
      },
      {
        label: 'misconception',
        explanation:
          'It does not want to admit that it does not know, so it makes something up to keep you happy.',
      },
      { label: 'empty', explanation: 'It just gets things wrong sometimes.' },
    ],
  },
  {
    nodeId: 'gradient-descent',
    cases: [
      {
        label: 'solid',
        explanation:
          "For each dial you work out whether nudging it up or down makes the error a bit smaller, and then you nudge every one of them slightly that way. Then you do it again. Millions of times. There is no cleverness in it, it is just an enormous pile of tiny local improvements.",
      },
      {
        label: 'clumsy',
        explanation:
          "You basically just feel which way is better and go a little bit that way? And keep doing it. It is not like it works out the answer, it just keeps getting slightly less wrong until it stops.",
      },
      {
        label: 'technical',
        explanation:
          'It is a first-order iterative method: each parameter is updated in the direction of the negative gradient of the loss, by a small step, and repeated until the loss stops improving.',
      },
      {
        label: 'parroted',
        explanation:
          'It is the canonical optimisation procedure underpinning modern deep learning, and its convergence properties are well studied in the literature.',
      },
      {
        label: 'misconception',
        explanation:
          'It is like a ball rolling down a hill until it reaches the bottom — the lowest point of the landscape, which is the best possible answer.',
      },
      { label: 'empty', explanation: 'It makes the model better somehow.' },
    ],
  },
];
