/* ConventionCard — one extracted convention: rule, category, confidence,
   `path:line` evidence + snippet, accept/reject, and inline edit of the rule
   text / snippet. Mirrors FindingCard's accept/dismiss affordance. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, ConfidenceNum, MonoLink } from "@devdigest/ui";
import type { ConventionCandidate } from "@/lib/hooks/conventions";
import { conventionFileHref } from "./helpers";
import { s } from "./styles";

export function ConventionCard({
  candidate,
  repoFullName,
  defaultBranch,
  onStatusChange,
  onEdit,
}: {
  candidate: ConventionCandidate;
  repoFullName?: string | null;
  defaultBranch?: string | null;
  onStatusChange: (status: "accepted" | "rejected") => void;
  onEdit: (patch: { rule?: string; evidence_snippet?: string }) => void;
}) {
  const t = useTranslations("conventions");
  const [editing, setEditing] = React.useState(false);
  const [rule, setRule] = React.useState(candidate.rule);
  const [snippet, setSnippet] = React.useState(candidate.evidence_snippet);

  const href = conventionFileHref(repoFullName, defaultBranch, candidate.evidence_path, candidate.evidence_line);

  const startEdit = () => {
    setRule(candidate.rule);
    setSnippet(candidate.evidence_snippet);
    setEditing(true);
  };

  const saveEdit = () => {
    onEdit({ rule, evidence_snippet: snippet });
    setEditing(false);
  };

  return (
    <div style={s.card(candidate.status)}>
      <div style={s.headerRow}>
        <div style={s.titleCol}>
          <div style={s.ruleRow}>
            {candidate.category && <Badge color="var(--accent)" bg="var(--accent-bg, rgba(99,102,241,.12))">{candidate.category}</Badge>}
            {candidate.edited && <span style={s.editedTag}>{t("card.edited")}</span>}
          </div>
          {editing ? (
            <input value={rule} onChange={(e) => setRule(e.target.value)} style={s.editInput} />
          ) : (
            <span style={s.rule}>{candidate.rule}</span>
          )}
          <div style={s.metaRow}>
            <MonoLink href={href}>
              {candidate.evidence_path}
              {candidate.evidence_line ? `:${candidate.evidence_line}` : ""}
            </MonoLink>
            <ConfidenceNum value={candidate.confidence} />
            {candidate.support_count > 1 && (
              <span style={s.supportNote}>{t("card.supportedBy", { count: candidate.support_count })}</span>
            )}
          </div>
        </div>

        <div style={s.actions}>
          <Button
            kind="secondary"
            size="sm"
            icon="Check"
            active={candidate.status === "accepted"}
            onClick={() => onStatusChange("accepted")}
          >
            {t("card.accept")}
          </Button>
          <Button
            kind="ghost"
            size="sm"
            icon="X"
            active={candidate.status === "rejected"}
            onClick={() => onStatusChange("rejected")}
          >
            {t("card.reject")}
          </Button>
          {!editing && (
            <Button kind="ghost" size="sm" icon="Edit" onClick={startEdit}>
              {t("card.edit")}
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <div style={s.editRow}>
          <textarea value={snippet} onChange={(e) => setSnippet(e.target.value)} style={s.editTextarea} />
          <div style={s.editActions}>
            <Button kind="primary" size="sm" onClick={saveEdit}>
              {t("card.saveEdit")}
            </Button>
            <Button kind="ghost" size="sm" onClick={() => setEditing(false)}>
              {t("card.cancelEdit")}
            </Button>
          </div>
        </div>
      ) : (
        <div style={s.snippet}>{candidate.evidence_snippet}</div>
      )}
    </div>
  );
}
