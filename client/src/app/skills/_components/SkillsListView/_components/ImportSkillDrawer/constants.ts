/** Constants for ImportSkillDrawer. */

import type { Skill } from "@devdigest/shared";

export const DRAWER_WIDTH = 720;

/** The only two things the importer accepts. Anything else is rejected before
    a byte is read. */
export const ALLOWED_EXTENSIONS = [".md", ".zip"] as const;

/** `accept` for the file input — a picker hint only; the extension is re-checked
    in code because a user can always pick "All files". */
export const FILE_ACCEPT = ALLOWED_EXTENSIONS.join(",");

export const MARKDOWN_EXTENSION = ".md";

/** `btoa(String.fromCharCode(...bytes))` blows the argument limit on a whole
    archive — encode in chunks instead. */
export const BASE64_CHUNK_SIZE = 0x8000;

/** Anything imported is someone else's text, and is recorded as such so the
    card can badge it "needs vetting". */
export const IMPORT_SOURCE: Skill["source"] = "imported_url";

/** Max height (px) of the scrollable body preview. */
export const BODY_PREVIEW_MAX_HEIGHT = 320;
