/**
 * Answers of known quality, for checking the assessor can actually tell them
 * apart.
 *
 * An assessor that returns a plausible verdict regardless of input looks exactly
 * like a working one from the outside: the map fills in, the wording is
 * reasonable, the session progresses. The sibling project shipped a grader that
 * was broken in three separate ways and looked fine, and only a harness feeding
 * it answers of KNOWN quality caught it.
 *
 * ## The four classes, and what each is for
 *
 * - `strong` — genuinely has the idea, in their own words, without the jargon.
 *   Must come back `known`. An assessor that marks these down never advances
 *   anyone, which is the quiet mirror of the failure below.
 * - `misconception` — confidently holds one of the node's authored wrong models.
 *   **Must not come back `known`.** This is the case that matters: a wrong model
 *   has to be dropped before the next idea can land on it, and marking it known
 *   routes someone straight past the thing blocking them.
 * - `parroted` — fluent, correct-sounding vocabulary with no mechanism behind
 *   it. **Must not come back `known`.** The hardest case, because it pattern-
 *   matches to expertise on every surface feature.
 * - `blank` — says they do not know. Must come back `blocked`.
 *
 * ## A known gap in this evidence
 *
 * These are WRITTEN, and the product is voice-first. The sibling project learned
 * this the expensive way: its calibration scored clean prose, passed happily,
 * and missed three bugs that only appeared on transcribed speech — including the
 * grader reading a recognition error as a technical mistake. The answers below
 * are written in spoken register (hedges, self-correction, run-ons) to narrow
 * that gap, but they are not transcripts. **Re-record these through the real
 * speech path once voice lands, and re-run.**
 */

export type CaseLabel = 'strong' | 'misconception' | 'parroted' | 'blank';

export type CalibrationFixture = {
  nodeId: string;
  /** The question the learner is answering. Drawn from the node's authored probes. */
  asked: string;
  cases: { label: CaseLabel; answer: string }[];
};

export const FIXTURES: CalibrationFixture[] = [
  {
    nodeId: 'training-vs-inference',
    asked: 'When you send a message to a chatbot, is it learning anything from you? What makes you say that?',
    cases: [
      {
        label: 'strong',
        answer:
          "No, I don't think it is. The training happened ages ago and then it got frozen. When it seems to remember what I said three messages back, that's just because the whole conversation gets sent to it again every single time — so it's re-reading, not remembering.",
      },
      {
        label: 'misconception',
        answer:
          "Yeah, definitely, that's kind of the whole point isn't it. The more you talk to it the more it learns about you, which is why it gets better at answering you over a long conversation.",
      },
      {
        label: 'parroted',
        // Rewritten: the original ("two distinct phases, training and inference,
        // deployment happens after training") stated this node's core fact and
        // was a genuinely borderline call, so it was useless as evidence — a
        // fixture whose correct verdict is arguable cannot test anything. This
        // version names the topic and says nothing whatever about it.
        answer:
          'Right, so this is the training-versus-inference distinction, which is a pretty fundamental part of the model lifecycle. There are established best practices for how you handle each stage of that.',
      },
      { label: 'blank', answer: "Honestly, no idea. I've never really thought about that." },
    ],
  },
  {
    nodeId: 'neuron',
    asked: 'People say neural networks are modelled on the brain. How far do you think that comparison actually goes?',
    cases: [
      {
        label: 'strong',
        answer:
          "Not very far at all, really. It's basically — you take the numbers coming in, multiply each one by its own weight, add them all up, and then push the total through some function that bends it. That's it. There's no chemistry, nothing fires. I think the word neuron is kind of a historical accident.",
      },
      {
        label: 'misconception',
        answer:
          "Pretty far, I'd say. Each artificial neuron is modelled on a brain cell — it fires once it gets enough signal and passes that on through the synapses to the next layer. So it's a simplified brain, basically.",
      },
      {
        label: 'parroted',
        answer:
          'Neural networks consist of neurons arranged into layers, and during training the weights get optimised so that the network learns useful representations of the input data.',
      },
      { label: 'blank', answer: "I don't know." },
    ],
  },
  {
    nodeId: 'next-token-prediction',
    asked: 'What do you think the training objective of a large language model actually is — what was it being scored on?',
    cases: [
      {
        label: 'strong',
        answer:
          "Just guessing the next bit of text, over and over. You hide the next token, make it predict it, score how close it got, nudge it. Which sounds trivial, but I think to get really good at it you'd have to actually be tracking what's going on — like to predict who the murderer turns out to be at the end of a novel, you'd have had to follow the plot.",
      },
      {
        label: 'misconception',
        answer:
          "It just predicts the next word based on statistics. So it's fancy autocomplete really — it can't actually reason about anything, it's only ever picking whatever word is most likely to come next.",
      },
      {
        label: 'parroted',
        answer:
          'It is an autoregressive transformer trained with a causal language modelling objective over a large pretraining corpus, optimising cross-entropy loss.',
      },
      { label: 'blank', answer: 'No idea, sorry.' },
    ],
  },
  {
    nodeId: 'hallucination',
    asked:
      'A model invents a citation that does not exist — plausible authors, plausible journal, plausible year. Given how it was trained, why would that happen?',
    cases: [
      {
        label: 'strong',
        answer:
          "Because it was never trained to be right, it was trained to produce stuff that looks like the text it saw. And a fake citation that looks exactly like a real one is a brilliant output by that measure. There's nothing inside it flagging which bits are real, so it comes out sounding just as sure either way.",
      },
      {
        label: 'misconception',
        answer:
          "Because it's making things up to please you. It doesn't want to admit it doesn't know, so it lies and invents something plausible instead.",
      },
      {
        label: 'parroted',
        answer:
          'Hallucination is a well-documented limitation of large language models, arising from the probabilistic nature of generation and from gaps in the training distribution.',
      },
      { label: 'blank', answer: "I don't know why that would happen." },
    ],
  },
];
