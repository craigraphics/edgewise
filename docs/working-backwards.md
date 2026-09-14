# Working backwards from one wrong amount

The `backprop-intuition` experiment asks one question:

> If the final amount is wrong, how do we work back to the earlier settings?

It uses a deliberately small watering model. A ten-minute run has two saved
estimates: a tap rate and the share of the water that reaches one plant. The
opening values are 0.5 litres per minute and 60%, so the model expects 3 litres.
The plant is measured at 4 litres.

The first action is **Work back from the difference**. It reveals two pieces of
advice in reverse order through the chain: splitter first, then tap. The panel
keeps both saved settings visibly unchanged while it does that. A separate
learning step applies both changes at once and reports:

> The estimate moved from 3 litres to 3.64 litres, closer to the 4 litres we
> measured.

## The calculation

With tap rate `a`, plant share `b`, measurement `t`, and ten minutes:

```text
estimate = 10ab
difference = estimate - t
error score = 0.5(difference)^2
tap sensitivity = difference × 10 × b
share sensitivity = difference × 10 × a
```

For the opening run, the sensitivities are −6 for the tap estimate and −5 for
the splitter share. The visibly labelled learning step is 0.01. Subtracting
0.01 times each sensitivity, from the same frozen pre-update settings, gives
0.56 litres per minute and 65%. Only then is a new prediction made:

```text
10 × 0.56 × 0.65 = 3.64 litres
```

`calculateAdvice` copies the supplied settings and calculates both
sensitivities before anything can change. `applyLearningStep` consumes that
snapshot, applies the two changes simultaneously, and refuses non-finite or
physically invalid results rather than clamping them. The reducer makes Apply
an exactly-once state transition even if activation is repeated.

A measurement equal to the opening 3-litre estimate produces exactly zero
advice and no Apply control. A tiny binary floating-point remainder is
normalised to zero so the interface cannot offer an invisible, meaningless
update. After the canonical run, measurements from 0 to 10 litres can be tried
in 0.1-litre steps. Clearing the field holds a real empty state and cannot be
mistaken for zero; every new measurement restarts from the same two supplied
settings.

## What the metaphor does not mean

The graph calls this idea "Blame, spread backwards." The useful part of that
metaphor is the direction of work: a difference at the end tells us how earlier
settings affect the error. Its limit is important. Backpropagation computes
chain-rule sensitivities. It does not divide a finite substance among settings;
the gradients are not percentages, do not add to 100, and leave no conserved
remainder of blame.

The panel is a two-setting teaching model, not real plumbing or a full neural
network. The arithmetic sits under **How it works**, after the learner has seen
the separation between prediction, advice, and update. The network band is used
only for borders and numbered accents; all words stay on neutral text surfaces.
There is no animation and the experiment itself has no network or learner-model
access.

## Verification

The pure-model tests independently check the two gradients with central finite
differences at five valid measurements. They also cover the canonical estimate,
half-squared error, frozen advice snapshot, simultaneous 0.01 update, 3.64-litre
result, duplicate Apply, zero error, reset, empty and invalid targets, every
0.1-litre target from 0 through 10, and invalid or non-finite learning steps.
The typed registry and deep-link test cover `#play/backprop-intuition`; the page
owns the reducer so leaving the experiment does not discard it, and the page's
existing global reset now resets it with every sibling experiment.

BrowserOS neo checks completed across the initial pass and the shorter resumed
pass:

- The canonical advice and result were read from the accessibility tree; a
  synchronous double activation produced one update and the atomic live region
  contained the canonical sentence.
- Zero error exposed two zero pieces of advice and no Apply control.
- The explanation opened with the specified prompt and an empty field; an
  entered draft survived leaving and reopening it without being submitted.
- Leaving for another idea and returning through the map preserved the
  experiment state. A populated ten-mark learner model remained byte-identical
  through the completed play path.
- At 320×568, the final first action was 503px below the panel title, 208px wide,
  and 47px high. The experiment had no right-edge clipping or page scroll. The
  first version put that action 910px below the title; moving the run and action
  ahead of the settings detail fixed the path, and letting the shared nowrap
  button wrap fixed its narrow-card overflow.
- Resize-after-load checks at 320×568, 640×600, 720×450, 900×650, 1230×842 and
  1920×900 found no page scroll, clipped experiment edge, or off-right
  experiment control. Every experiment control measured at least 40px; smaller
  controls reported by the whole-page probe belonged to the existing map UI.
- At 720×450, two End presses reached the bottom of the experiment's own scroll
  pane with the final arithmetic paragraph visible. `document.getAnimations()`
  returned zero.
- The keyboard order from the experiment title was Reset, Try another measured
  amount, Explain what happened, then How it works. All four reported
  `:focus-visible`, stayed in the viewport, and had visible 1.5–2px outlines.
- A 200%-equivalent reflow check used half the 1230×842 CSS viewport at device
  pixel ratio 4. It found no page scroll, clipping, off-right controls, or
  experiment controls below 40px. BrowserOS cannot drive browser-chrome zoom,
  so this is equivalent layout evidence rather than a literal browser zoom
  setting.
- Light and dark themes were visually inspected at 1230×842. The neutral
  surfaces, foreground text and network-band borders stayed distinct in both.
- Clearing resource timings immediately before the local play path and reading
  them after the canonical result found zero fetch or XHR entries.
- Global Start over removed the result and experiment Reset, restored the
  opening Work back action, and cleared the learner model as that global action
  is designed to do.

Wheel-only reachability remains unverified: BrowserOS's targeted wheel command
hung twice, while keyboard End and the scroll-bound measurements succeeded. A
literal browser-chrome 200% zoom setting also cannot be driven by this browser
tool. There was no physical-phone or real-screen-reader check. No assessed
explanation was submitted, no calibration run was needed or run, and this is
not a learner study.
