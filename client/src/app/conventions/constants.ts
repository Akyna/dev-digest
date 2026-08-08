/* Route-level constants for /conventions — shared by ConventionsView and the
   create-skill modal. Listed literally rather than imported off the shared Zod
   enum: `@devdigest/shared` is type-only on the client (see skills/constants.ts
   for the full rationale), so importing the schema as a value breaks the build. */
import type { SkillType } from "@devdigest/shared";

export const SKILL_TYPE_VALUES = [
  "rubric",
  "convention",
  "security",
  "custom",
] as const satisfies readonly SkillType[];
