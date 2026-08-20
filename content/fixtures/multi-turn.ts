/**
 * Conversations, not single exchanges.
 *
 * The single-turn fixtures pass a clean history: one question, one answer. A
 * real session is nothing like that, and the first real one surfaced two marks
 * whose stated reasoning was about the PREVIOUS node rather than the one being
 * judged. Single-turn fixtures are structurally incapable of catching that,
 * because there is no previous node to blend in.
 *
 * Each fixture ends with the answer under judgement. Everything before it is
 * there to be ignored — and whether it actually is, is the whole test.
 */

export type MultiTurnFixture = {
  name: string;
  /** The node the final question was about. */
  nodeId: string;
  /** Extra nodes to mark known, beyond the target's own prerequisites. */
  alsoKnown?: string[];
  /** The conversation, ending with the learner's answer to judge. */
  turns: { role: 'assistant' | 'user'; content: string }[];
  /**
   * `known` and `not-known` are self-explanatory. `unclear` means the answer did
   * not address the question, so no verdict about the learner is yet warranted.
   */
  expect: 'known' | 'not-known' | 'unclear';
  /** What this fixture exists to catch. */
  why: string;
};

export const MULTI_TURN: MultiTurnFixture[] = [
  {
    name: 'drifted',
    nodeId: 'gradient-descent',
    alsoKnown: ['training-vs-inference', 'generalization-overfitting'],
    why: 'The learner carries on about the previous topic. Judging that as a verdict on THIS node is the failure a real session showed.',
    expect: 'unclear',
    turns: [
      {
        role: 'assistant',
        content:
          'A model gets every single training example exactly right. Is that good news, do you think?',
      },
      {
        role: 'user',
        content:
          "Probably not? It sounds like it just memorised them. Like a student who learnt last year's exam paper off by heart and then falls apart on this year's.",
      },
      {
        role: 'assistant',
        content:
          'Right. So you have a number telling you how wrong the model currently is, and millions of dials you could turn. How would you go about turning them?',
      },
      {
        role: 'user',
        content:
          "Yeah and I suppose the memorising thing is why you'd want to hold some data back, right? So you can check it on stuff it hasn't seen. That's the bit I was trying to get at before.",
      },
    ],
  },
  {
    name: 'halo',
    nodeId: 'neuron',
    why: 'Four strong answers, then a hollow one. Catches the assessor riding a good impression instead of reading the latest answer.',
    expect: 'not-known',
    turns: [
      {
        role: 'assistant',
        content: 'What would you have to give a machine-learning system that you would not give a normal program?',
      },
      {
        role: 'user',
        content:
          "Examples with the answers attached. It works the rule out from those, rather than me writing the rule down myself.",
      },
      {
        role: 'assistant',
        content: 'Good. And before a system can do anything with a photo or a sentence, what has to happen to it?',
      },
      {
        role: 'user',
        content:
          "It has to turn into numbers somehow. And whatever that conversion throws away, the model just can't see — so it kind of decides the ceiling.",
      },
      {
        role: 'assistant',
        content: 'People say neural networks are modelled on the brain. How far does that comparison actually go?',
      },
      {
        role: 'user',
        content:
          'Neural networks are composed of interconnected neurons organised into layers, and through training the network learns hierarchical representations of the input.',
      },
    ],
  },
  {
    name: 'recovery',
    nodeId: 'loss',
    alsoKnown: ['training-vs-inference'],
    why: 'Two blanks, then a genuinely strong answer. Catches the assessor anchoring on a bad impression and marking down something they actually have.',
    expect: 'known',
    turns: [
      {
        role: 'assistant',
        content: 'Before a system can do anything with a photo or a sentence, what has to happen to it?',
      },
      { role: 'user', content: "No idea, sorry." },
      {
        role: 'assistant',
        content: 'That is fine. When you send a message to a chatbot, is it learning anything from you?',
      },
      { role: 'user', content: "I really don't know. I've never thought about it." },
      {
        role: 'assistant',
        content:
          'No problem. If a system is going to improve, something has to tell it how badly it is doing. What would that have to produce?',
      },
      {
        role: 'user',
        content:
          "Oh — a number, I think? Not just right or wrong, because that doesn't tell you which way to go. You'd want something like 'you were out by this much', so being out by ten is better than being out by a thousand and it knows it's getting warmer.",
      },
    ],
  },
  {
    name: 'neighbour-bleed',
    nodeId: 'generalization-overfitting',
    alsoKnown: ['training-vs-inference', 'features-and-representation', 'tokens'],
    why: 'A strong answer about a NEIGHBOURING idea sits directly before a weak one about this node. The verdict must come from the latter.',
    expect: 'not-known',
    turns: [
      {
        role: 'assistant',
        content: 'A language model has to turn your sentence into numbers. What do you think the unit is?',
      },
      {
        role: 'user',
        content:
          "Chunks, I think — not whole words. Bits of words. Which is why it goes funny if you ask it to count letters, it literally never sees them.",
      },
      {
        role: 'assistant',
        content: 'Right. A model gets every single training example exactly right. Is that good news?',
      },
      {
        role: 'user',
        content: "Sounds good to me? If it gets everything right that seems like it's working properly.",
      },
    ],
  },
];
