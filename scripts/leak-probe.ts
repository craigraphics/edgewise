/**
 * Does a failed model call put the learner's API key anywhere a log would catch?
 *
 * The routes `console.error` the AI SDK's error object when a call fails in an
 * unexpected way. Those objects carry `url`, `requestBodyValues`,
 * `responseHeaders` and a `cause` chain — and if any of them held the key, every
 * failure would write a live credential into the deployment's logs, where it
 * would sit for as long as logs are retained.
 *
 * Measured rather than assumed, and worth re-running after any `ai` or
 * `@ai-sdk/google` upgrade: the answer depends on how the provider happens to
 * pass credentials, which is not something this app controls.
 *
 * Current result: clean. The key travels as an `x-goog-api-key` header, the SDK
 * does not attach request headers to the error, and `url` carries no `?key=`.
 *
 * Run with: pnpm leak-probe
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { inspect } from 'node:util';

/** Does a failed call put the API key anywhere a log would capture? */
/*
 * Deliberately NOT key-shaped. An `AIza…` prefix would trip GitHub's secret
 * scanning on a public repo and, worse, invite someone to wonder whether it is
 * real. The probe only needs a string unique enough to search for.
 */
const CANARY = 'edgewise-canary-not-a-credential-8f2a1c';

const google = createGoogleGenerativeAI({ apiKey: CANARY });

async function main() {
try {
  await generateObject({
    model: google('gemini-3.1-flash-lite'),
    schema: z.object({ x: z.string() }),
    messages: [{ role: 'user', content: 'hello' }],
    maxRetries: 0,
  });
} catch (error) {
  const e = error as Record<string, unknown>;

  // 1. What console.error would actually print
  const printed = inspect(error, { depth: 6 });

  // 2. Walk every enumerable property, and the cause chain
  const seen = new Set<unknown>();
  const found: string[] = [];
  const walk = (v: unknown, path: string, depth = 0) => {
    if (depth > 6 || v === null || seen.has(v)) return;
    if (typeof v === 'string') {
      if (v.includes(CANARY)) found.push(path);
      return;
    }
    if (typeof v !== 'object') return;
    seen.add(v);
    for (const k of Object.getOwnPropertyNames(v)) {
      try { walk((v as Record<string, unknown>)[k], `${path}.${k}`, depth + 1); } catch {}
    }
  };
  walk(error, 'error');

  console.log('--- console.error output contains the key? ---');
  console.log(printed.includes(CANARY) ? '*** YES — THE KEY WOULD BE LOGGED ***' : 'no');
  console.log('\n--- properties holding the key ---');
  console.log(found.length ? found.join('\n') : 'none');
  console.log('\n--- error shape ---');
  console.log('name:', (e.name as string) ?? '?');
  console.log('top-level props:', Object.getOwnPropertyNames(e).join(', '));
  console.log('url:', typeof e.url === 'string' ? e.url.replace(CANARY, '<<KEY>>') : e.url);
  console.log('\n--- first 600 chars of what console.error prints ---');
  console.log(printed.replaceAll(CANARY, '<<KEY>>').slice(0, 600));
}
}

main();
