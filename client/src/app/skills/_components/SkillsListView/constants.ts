/** Constants for the Skills list view. */

/** Left pane width (px) — mirrors the agent editor's list column. */
export const LEFT_PANE_WIDTH = 320;

/** Card grid template. In the narrow left pane this collapses to one column,
    but keeps the list responsive if the pane ever widens. */
export const CARD_GRID_COLS = "repeat(auto-fill, minmax(240px, 1fr))";

/** Topbar height, subtracted so each pane scrolls on its own instead of the page. */
export const PANE_HEIGHT = "calc(100vh - 52px)";

/** Placeholder cards shown while the list loads. */
export const SKELETON_COUNT = 3;
export const SKELETON_HEIGHT = 104;

/** Width of the "Add Skill" dropdown menu (px). */
export const MENU_WIDTH = 230;
