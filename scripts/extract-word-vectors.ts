/**
 * Builds `content/word-vectors.json` — the small saved collection of real
 * learned word vectors the `embeddings` experiment reads.
 *
 * The values are NOT generated here. They are copied, unchanged apart from
 * rounding, out of a published GloVe release:
 *
 *   GloVe 6B — Wikipedia 2014 + Gigaword 5, 400k lowercase words, 100
 *   dimensions. Jeffrey Pennington, Richard Socher, Christopher D. Manning,
 *   "GloVe: Global Vectors for Word Representation", EMNLP 2014.
 *   https://nlp.stanford.edu/projects/glove/
 *
 * The GloVe vectors are released under the Open Data Commons Public Domain
 * Dedication and Licence (PDDL) v1.0, which is why a slice of them can be
 * checked into this repository.
 *
 * These are STATIC vectors: one fixed list per word, learned from how often
 * words appear near each other across that corpus. They are deliberately not
 * the context-dependent vectors a modern language model computes for a token
 * inside a particular sentence, and the panel says so.
 *
 * Usage, once `glove.6B.100d.txt` has been downloaded and unzipped:
 *
 *   pnpm tsx scripts/extract-word-vectors.ts path/to/glove.6B.100d.txt
 *
 * Words are looked up, never invented: a word the release does not carry is
 * reported and the script exits rather than emitting a partial collection.
 */

import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

/**
 * The collection, grouped into everyday areas.
 *
 * The grouping is OURS, for finding a word. Nothing in the numbers knows about
 * it, and the panel says as much — several words sit in an area whose
 * neighbours come from somewhere else entirely, which is the point.
 */
const TOPICS: { id: string; label: string; words: string[] }[] = [
  { id: 'music', label: 'Music', words: ['guitar', 'piano', 'drums', 'violin', 'bass', 'trumpet', 'song', 'album', 'band', 'concert', 'singer', 'jazz', 'melody', 'orchestra', 'choir', 'guitarist', 'lyrics', 'keyboard'] },
  { id: 'garden', label: 'The garden', words: ['garden', 'flower', 'soil', 'seeds', 'roses', 'planted', 'leaves', 'tree', 'grass', 'lawn', 'hedge', 'greenhouse', 'gardening', 'bloom', 'weeds', 'shrubs', 'plant'] },
  { id: 'kitchen', label: 'Food and the kitchen', words: ['coffee', 'tea', 'recipe', 'kitchen', 'bread', 'cheese', 'soup', 'baked', 'oven', 'dinner', 'chef', 'salad', 'sauce', 'restaurant', 'breakfast'] },
  { id: 'sport', label: 'Sport', words: ['football', 'tennis', 'cricket', 'goal', 'match', 'player', 'team', 'coach', 'stadium', 'league', 'referee', 'championship', 'bat', 'pitch'] },
  { id: 'weather', label: 'Weather', words: ['rain', 'snow', 'storm', 'sunny', 'cloudy', 'wind', 'fog', 'thunder', 'temperature', 'forecast', 'frost'] },
  { id: 'animals', label: 'Animals', words: ['dog', 'cat', 'horse', 'bird', 'cow', 'sheep', 'rabbit', 'fish', 'mouse', 'elephant', 'seal', 'crane'] },
  { id: 'travel', label: 'Getting around', words: ['train', 'bus', 'airport', 'flight', 'ticket', 'hotel', 'journey', 'station', 'passenger', 'luggage', 'taxi', 'car', 'bicycle', 'road'] },
  { id: 'money', label: 'Money', words: ['bank', 'money', 'loan', 'savings', 'cash', 'price', 'salary', 'tax', 'budget', 'current'] },
  { id: 'family', label: 'Family', words: ['mother', 'father', 'sister', 'brother', 'daughter', 'son', 'cousin', 'grandmother', 'wedding', 'family'] },
  { id: 'school', label: 'School', words: ['teacher', 'school', 'homework', 'exam', 'classroom', 'student', 'pupil', 'lesson', 'university', 'library'] },
  { id: 'health', label: 'Health', words: ['doctor', 'nurse', 'hospital', 'medicine', 'patient', 'illness', 'surgery'] },
  { id: 'home', label: 'Around the house', words: ['bedroom', 'roof', 'window', 'door', 'garage', 'furniture', 'curtains', 'hammer', 'nails', 'drill', 'saw', 'light'] },
  { id: 'screens', label: 'Reading and screens', words: ['phone', 'computer', 'screen', 'email', 'newspaper', 'book', 'film', 'cinema'] },
  { id: 'outdoors', label: 'Outdoors', words: ['river', 'water', 'bridge', 'spring', 'rock'] },
];

/** Four words from four different parts of life, offered on the first screen. */
const OPENING = ['guitar', 'garden', 'coffee', 'football'];

const DIMENSIONS = 100;
/** Four decimal places. The panel computes every neighbour from the rounded values it ships. */
const PLACES = 4;

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: pnpm tsx scripts/extract-word-vectors.ts path/to/glove.6B.100d.txt');
    process.exit(1);
  }

  const wanted = new Set(TOPICS.flatMap(topic => topic.words));
  const found = new Map<string, number[]>();

  const lines = createInterface({ input: createReadStream(resolve(path)), crlfDelay: Infinity });
  for await (const line of lines) {
    const space = line.indexOf(' ');
    const word = line.slice(0, space);
    if (!wanted.has(word) || found.has(word)) continue;
    const values = line.slice(space + 1).split(' ').map(Number);
    if (values.length !== DIMENSIONS || values.some(value => !Number.isFinite(value))) {
      throw new Error(`${word}: expected ${DIMENSIONS} finite values, got ${values.length}`);
    }
    found.set(word, values.map(value => Number(value.toFixed(PLACES))));
    if (found.size === wanted.size) break;
  }

  const missing = [...wanted].filter(word => !found.has(word));
  if (missing.length) throw new Error(`not in this release: ${missing.join(', ')}`);
  for (const word of OPENING) if (!wanted.has(word)) throw new Error(`opening word ${word} is not in the collection`);

  const vectors: Record<string, number[]> = {};
  for (const topic of TOPICS) for (const word of topic.words) vectors[word] = found.get(word)!;

  const data = {
    source: {
      name: 'GloVe 6B, 100 dimensions',
      corpus: 'Wikipedia 2014 + Gigaword 5',
      citation: 'Pennington, Socher and Manning, "GloVe: Global Vectors for Word Representation", EMNLP 2014',
      url: 'https://nlp.stanford.edu/projects/glove/',
      licence: 'Open Data Commons Public Domain Dedication and Licence (PDDL) v1.0',
      licenceUrl: 'https://opendatacommons.org/licenses/pddl/1-0/',
      file: 'glove.6B.100d.txt',
      kind: 'static',
      kindNote: 'One fixed list per word, learned from how often words appear near each other. Not the context-dependent values a language model computes for a token inside a sentence.',
      dimensions: DIMENSIONS,
      rounding: `values rounded to ${PLACES} decimal places; every number this panel shows is computed from these rounded values`,
      extractedBy: 'scripts/extract-word-vectors.ts',
    },
    opening: OPENING,
    topics: TOPICS.map(topic => ({ id: topic.id, label: topic.label, words: topic.words })),
    vectors,
  };

  const out = resolve('content/word-vectors.json');
  writeFileSync(out, `${JSON.stringify(data, null, 0)}\n`);
  console.log(`${found.size} words, ${DIMENSIONS} dimensions → ${out}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
