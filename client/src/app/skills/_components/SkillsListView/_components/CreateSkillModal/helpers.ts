import type { SkillType } from "@devdigest/shared";
import type { CreateSkillInput } from "@/lib/hooks/skills";

export interface CreateSkillFields {
  name: string;
  description: string;
  type: SkillType;
  body: string;
}

/** A skill with no name or no body is not configuration yet — block the submit. */
export function canCreate(fields: CreateSkillFields): boolean {
  return fields.name.trim().length > 0 && fields.body.trim().length > 0;
}

/** Trim only the identity fields; the body is Markdown and its layout matters. */
export function buildCreateInput(fields: CreateSkillFields): CreateSkillInput {
  return {
    name: fields.name.trim(),
    description: fields.description.trim(),
    type: fields.type,
    body: fields.body,
  };
}
