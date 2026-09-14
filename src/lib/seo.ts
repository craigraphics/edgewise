/**
 * The facts about this site that more than one file has to agree on.
 *
 * `metadataBase` is hard-coded rather than read from `VERCEL_URL`, which is the
 * per-deployment hostname: canonicals built from it point every preview at
 * itself, and a crawler that reaches one sees the whole site duplicated at an
 * address that will not exist next week.
 *
 * `DESCRIPTION` is also what `scripts/make-icons.py` prints on the sharing
 * card — it reads this file rather than holding its own copy. Changing the line
 * means regenerating the card.
 */
export const SITE_URL = 'https://edgewise.craigraphics.com';

export const SITE_NAME = 'Edgewise';

export const TITLE = 'Edgewise — find the one idea blocking the rest';

export const DESCRIPTION =
  'A diagnostic that finds the one idea blocking the rest of your understanding of AI, then draws a map of 23 concepts and shows where yours stops.';
