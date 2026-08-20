/**
 * Limits both the server and the browser need to agree on.
 *
 * Kept apart from `token.ts` so a client component can state a cap without
 * pulling `jose` and the signing secret's module into the browser bundle.
 */

/** Model-backed turns one session may spend on the shared free-tier key. */
export const FREE_TURN_CAP = 25;

/**
 * Model-backed turns one browser may spend on the shared key per day.
 *
 * The shared free tier is metered by the provider per project, not per visitor —
 * roughly 1,500 requests a day for everyone together. Without a per-browser cap,
 * one enthusiastic reader arriving from a blog post can spend a meaningful slice
 * of it and every other visitor that day sees "try again later", which is a far
 * worse experience than a session that politely ends.
 *
 * **What this does not stop:** clearing site data resets it, because with no
 * database the counter has to live with the client. That is a deliberate
 * trade — it stops the ordinary case (one person, several sessions, one
 * afternoon) without standing up infrastructure the POC does not otherwise
 * need. A determined visitor can get around it, and the honest answer to that
 * is that they should bring their own key, which costs them almost nothing and
 * removes every cap.
 */
export const FREE_DAILY_CAP = 60;
