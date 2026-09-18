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

/**
 * Where focus goes when the panel for `nodeId` closes.
 *
 * Closing used to focus a DOM node captured when the panel opened. That is the
 * wrong identity: the focused view is keyed on the node it draws, so the element
 * that opened the panel is routinely replaced before it can be focused again —
 * `isConnected` comes back false and focus falls through to the map section
 * instead of the idea you were just reading about. Switching format, or walking
 * idea to idea through the inspector's prerequisite buttons, breaks it the same
 * way.
 *
 * So remember which idea it was and find whatever currently represents it. All
 * three map formats carry `data-node`, so one selector covers the SVG group, the
 * focused card and the list row without knowing which is on screen.
 *
 * The id comes from the graph rather than from anything a visitor can type, but
 * it is still going into a selector: anything that is not a plain id gets the
 * section instead of being interpolated.
 */
export const MAP_SECTION = 'concept-map';

export function returnFocusSelector(nodeId: string | null): string {
  if (!nodeId || !/^[a-z0-9-]+$/i.test(nodeId)) return `#${MAP_SECTION}`;
  return `[data-node="${nodeId}"]`;
}
