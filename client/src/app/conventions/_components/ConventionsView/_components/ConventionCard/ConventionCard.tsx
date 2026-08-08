/* ConventionCard — one extracted convention: rule, category, evidence
   `path:line` (opens the real line on GitHub) + snippet, a confidence meter,
   and a right-hand action stack (Accept/Accepted toggle, Reject, Edit).
   Rejecting removes the card from ConventionsView's list — see its filter. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Icon, MonoLink, ProgressBar } from "@devdigest/ui";
import type { ConventionCandidate } from "@/lib/hooks/conventions";
import { conventionFileHref, evidenceLabel } from "./helpers";
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
  onStatusChange: (status: "pending" | "accepted" | "rejected") => void;
  onEdit: (patch: { rule?: string; evidence_snippet?: string }) => void;
}) {
  const t = useTranslations("conventions");
  const [editing, setEditing] = React.useState(false);
  const [rule, setRule] = React.useState(candidate.rule);
  const [snippet, setSnippet] = React.useState(candidate.evidence_snippet);

  const href = conventionFileHref(
    repoFullName,
    defaultBranch,
    candidate.evidence_path,
    candidate.evidence_line,
    candidate.evidence_end_line,
  );
  const accepted = candidate.status === "accepted";
  const pct = Math.round(candidate.confidence * 100);

  const startEdit = () => {
    setRule(candidate.rule);
    setSnippet(candidate.evidence_snippet);
    setEditing(true);
  };

  const saveEdit = () => {
    onEdit({ rule, evidence_snippet: snippet });
    setEditing(false);
  };

  // Clicking the already-accepted button un-accepts (back to pending); the
  // only way to a terminal state is Reject, which removes the card entirely.
  const toggleAccept = () => onStatusChange(accepted ? "pending" : "accepted");

  return (
    <div style={s.card(candidate.status)}>
      <div style={s.headerRow}>
        <div style={s.titleCol}>
          <div style={s.ruleRow}>
            {candidate.category && (
              <Badge color="var(--accent)" bg="var(--accent-bg, rgba(99,102,241,.12))">
                {candidate.category}
              </Badge>
            )}
            {candidate.edited && <span style={s.editedTag}>{t("card.edited")}</span>}
          </div>
          {editing ? (
            <input value={rule} onChange={(e) => setRule(e.target.value)} style={s.editInput} />
          ) : (
            <span style={s.rule}>{candidate.rule}</span>
          )}

          <div style={s.evidenceRow}>
            <MonoLink href={href}>
              <span style={s.evidencePath}>
                {evidenceLabel(candidate.evidence_path, candidate.evidence_line, candidate.evidence_end_line)}
              </span>
              {href && (
                <span style={s.githubLink}>
                  <Icon.ExternalLink size={11} />
                  {t("card.github")}
                </span>
              )}
            </MonoLink>
            {candidate.support_count > 1 && (
              <span style={s.supportNote}>{t("card.supportedBy", { count: candidate.support_count })}</span>
            )}
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

          <div style={s.confidenceRow}>
            <span style={s.confidenceLabel}>{t("card.confidence")}</span>
            <div style={s.confidenceBar}>
              <ProgressBar value={pct} height={4} />
            </div>
            <span style={s.confidencePct}>{pct}%</span>
          </div>
        </div>

        <div style={s.actions}>
          <Button
            kind={accepted ? "secondary" : "primary"}
            size="sm"
            icon="Check"
            active={accepted}
            full
            onClick={toggleAccept}
          >
            {accepted ? t("card.accepted") : t("card.accept")}
          </Button>
          <Button kind="secondary" size="sm" icon="X" full onClick={() => onStatusChange("rejected")}>
            {t("card.reject")}
          </Button>
          {!editing && (
            <Button kind="ghost" size="sm" icon="Edit" full onClick={startEdit}>
              {t("card.edit")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
