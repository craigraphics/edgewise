# Edgewise

**[edgewise.craigraphics.com](https://edgewise.craigraphics.com)**

A tool that finds the one idea that is blocking the rest of your understanding,
shows you a map of where you are, and then teaches you the whole thing.

The subject here is how AI works. But the subject is not the point — see
[Any subject](#any-subject) below.

---

## The problem it solves

When you try to learn something hard on your own, the hard part is not finding
explanations. There are plenty.

The hard part is that **you do not know what you are missing**. And if you do not
know what you are missing, you cannot ask for it.

That is why a chat assistant is least useful exactly when you are most stuck. It
answers whatever you ask, very well. But it has no idea what you already know, so
if your question is shaped by a gap you cannot see, you get a confident answer to
the wrong question.

Edgewise does not start by explaining. It starts by finding out where your
understanding stops.

---

## An example

Here is a real session, shortened.

**It asks you something.** No jargon, and nothing is scored.

> Suppose I want a program that spots spam email. What would I have to give a
> machine-learning system that I would not have to give a normal program?

**You answer**, out loud or by typing:

> You would give it loads of emails that are already labelled spam or not spam,
> and it figures out the pattern itself. With a normal program I would have to
> write the rules by hand.

**It moves on.** That idea goes green on the map, and it asks about the next one.

A few questions later:

> People say neural networks are modelled on the brain. How far do you think that
> comparison actually goes?

> Pretty far — each artificial neuron is like a brain cell, it fires when it gets
> enough signal and passes that on to the next layer.

That is a **wrong picture**, not a missing one. A real neuron in a computer is
just multiplication and addition — no firing, no chemistry. So it does not mark
that as understood, and it notes the wrong picture separately, because a wrong
picture has to come out before anything can be built on top of it.

**Then it shows you the map:**

> Learning from examples is the place to start from — **22 of the later ideas
> rest on it**, which is why so much of the rest has probably felt slippery.

That last sentence is the whole point. Not "you got this wrong", but "here is the
one thing holding up everything else".

**Then it teaches you all 23 ideas**, in order, whether you knew them or not.
Turn on *Read it to me* and it works through them by itself while you listen.

---

## The one rule that makes it honest

**Being taught something does not tick it off.**

Listening to a good explanation feels almost exactly like understanding one. So
hearing an idea explained changes nothing on your map.

To move an idea to *solid*, you have to **explain it back in your own words**.
Everyday language is fine. In fact everyday language is better:

> "You've got a bunch of numbers arriving, and each one has a sort of importance
> dial on it. You times them by that and add the whole lot together, and then
> there's a bit at the end that squishes it. That's honestly it, it's just sums."

That counts. It has no correct terms in it at all, and it describes exactly what
happens.

This does not:

> "It is a computational primitive of a neural architecture, and the properties
> of the network emerge from how large numbers of them are composed across
> layers."

Every word is correct. It never says what the thing actually *does*.

---

## What you see

Twenty-three ideas, from *learning from examples* through to *agents*, each one
resting on the ones before it. Every one is marked:

| Mark | Means |
|---|---|
| **Solid** | You explained it back and it held up |
| **Half-held** | Partly there, or a piece is missing |
| **Not yet** | You do not have this one |
| **Not looked at** | Nobody has asked you about it |

There is no score, no percentage, and no "correct". Saying **"I don't know"** is
treated as the most useful answer you can give, because it is — it tells the map
something true.

---

## Any subject

The 23 ideas live in one file: `content/graph.json`. Nothing else in the app
knows what they are about. Swap that file and the same tool works on organic
chemistry, or accounting, or the offside rule.

A subject is a good fit if:

- **The ideas genuinely build on each other.** If you can learn them in any
  order, there is no blocking idea to find.
- **The chain is long enough that people arrive in the middle.** The value comes
  from moving where you think your problem is.
- **The popular explanations are often wrong.** This is where it earns its keep.

AI scores very high on the third. *A neuron is like a brain cell* — it is not.
*It just predicts the next word, so it cannot reason* — that confuses what it was
trained to do with what it can do. *Attention means it pays attention to the
important words* — nothing is looking at anything.

---

## Running it yourself

You need [Node.js](https://nodejs.org) and [pnpm](https://pnpm.io).

```bash
pnpm install
cp .env.example .env.local
```

Put two things in `.env.local`:

- `GOOGLE_GENERATIVE_AI_API_KEY` — a free key from
  [Google AI Studio](https://aistudio.google.com/apikey). No credit card needed.
- `SESSION_SECRET` — any long random string. `openssl rand -base64 32` will do.

Then:

```bash
pnpm dev     # open http://localhost:3000
```

Voice needs Chrome. Everything works by typing in any browser.

### Other commands

```bash
pnpm test              # 257 tests
pnpm validate-graph    # checks the 23 ideas are wired up correctly
pnpm calibrate         # checks the AI can actually tell good answers from bad
pnpm leak-probe        # checks a failed request cannot leak your API key
```

---

## What it costs

Almost nothing, on purpose.

| What | Cost |
|---|---|
| The first question | Free — it is written, not generated |
| One question in the conversation | about $0.0005 |
| A whole conversation | about **1 cent** |
| All 23 lessons | **Free** — they are written by hand, not generated |
| Asking for something simpler | about $0.0003 |

The lessons cost nothing because they were written by a person and are read out
as written. That is also why they cannot be wrong in the way a made-up answer
can be wrong.

You can use it with no key at all, on a shared free allowance. Add your own key
and there is no limit.

---

## Your data

- **No accounts. No database.** Your progress is saved in your own browser and
  nowhere else.
- **If you add your own key**, it stays in your browser. It is sent to the server
  only on the requests that need it, used once, and never saved or logged. There
  is a script in this repo (`pnpm leak-probe`) that checks this is true.
- **Voice**: Chrome does speech recognition on Google's servers, not on your
  computer. The app tells you this before it turns the microphone on. Typing
  always works instead.

---

## Honest status

This is a proof of concept, and works end to end. Some things are not finished:

- **Nobody outside the project has used it yet.** The real question — does the
  map tell you something you did not already know — has not been asked of a
  stranger.
- **The 23 ideas and how they connect have not been checked against a real
  syllabus.** One person wrote them.
- **One test still fails.** The part that decides whether your explanation counts
  gets it wrong about 3% of the time on the hardest example. It is left failing
  and written down, rather than quietly adjusted until it passed.

There is more detail in [`AGENTS.md`](./AGENTS.md), which records every decision
and what it cost.

---

## Built with

Next.js, React, TypeScript, Tailwind. Google's Gemini models through the Vercel
AI SDK. No database.

The AI is deliberately given very little freedom: it picks one answer from four
options against a strict format, and every question it can ask was written by a
person in advance. That is why a cheap, fast model works as well here as an
expensive one — tested, not assumed.
