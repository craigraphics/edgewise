/**
 * Whether the side panel is already showing a given idea.
 *
 * The focused card offers "Explore this idea", which selects that idea and
 * brings the guide panel into view. Both are no-ops once the panel is showing
 * that same idea — and because the card always draws the selected idea, that is
 * every state after the first press of a session. The control sat there doing
 * nothing, which is worse than not offering it.
 *
 * Below the panel breakpoint the map and the guide are switched between rather
 * than shown side by side, so the same press still does something real whenever
 * the map is the visible surface. That is why this asks about the layout as
 * well as the selection: hiding the affordance there would remove the one route
 * back to the idea's text from inside an experiment.
 */
export function panelAlreadyShows(options: {
  selectedId: string | null;
  nodeId: string;
  /** True below the panel breakpoint, where map and guide are separate views. */
  compact: boolean;
  surface: 'map' | 'guide';
}): boolean {
  const { selectedId, nodeId, compact, surface } = options;
  if (selectedId !== nodeId) return false;
  return compact ? surface === 'guide' : true;
}
