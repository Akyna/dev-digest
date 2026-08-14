/* PromptBlock — one labelled, collapsible prompt segment with copy + fullscreen
   actions; fullscreen opens PromptModalBody in a Modal. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, Modal } from "@devdigest/ui";
import { approxTokens } from "@/lib/tokens";
import { s as drawer } from "../../styles";
import { PromptModalBody } from "../PromptModalBody";
import { s } from "./styles";

export function PromptBlock({ label, text, color }: { label: string; text: string; color: string }) {
  const t = useTranslations("runs");
  // Presentation-only: the trace contract carries whole-run tokens_in/out, never
  // per-block counts, so this is estimated from the text we already have. Always
  // rendered with "≈" — it is what makes an expensive block (skills, repo map)
  // visible without pretending to be the billed number.
  const tokens = approxTokens(text);
  const [open, setOpen] = React.useState(false);
  const [full, setFull] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(text || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div style={drawer.promptRow}>
      <div onClick={() => setOpen((o) => !o)} style={drawer.promptHead}>
        <span style={drawer.promptDot(color)} />
        <span style={drawer.promptLabel}>{label}</span>
        <span style={s.actions}>
          <span style={s.tokens} title={t("trace.prompt.tokensHint")}>
            {t("trace.prompt.tokens", { count: tokens })}
          </span>
          <button
            type="button"
            title={t("trace.prompt.copy")}
            aria-label={t("trace.prompt.copy")}
            onClick={(e) => {
              e.stopPropagation();
              copy();
            }}
            style={s.miniBtn}
          >
            {copied ? <Icon.Check size={12} /> : <Icon.Copy size={12} />}
          </button>
          <button
            type="button"
            title={t("trace.prompt.fullscreen")}
            aria-label={t("trace.prompt.fullscreen")}
            onClick={(e) => {
              e.stopPropagation();
              setFull(true);
            }}
            style={s.miniBtn}
          >
            <Icon.ExternalLink size={12} />
          </button>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {open ? t("trace.collapse") : t("trace.expand")}
          </span>
        </span>
      </div>
      {open && (
        <pre className="mono" style={drawer.promptPre}>
          {text || "—"}
        </pre>
      )}
      {full && (
        <Modal
          width={1200}
          title={label}
          onClose={() => setFull(false)}
          footer={
            <Button kind="secondary" size="sm" icon={copied ? "Check" : "Copy"} onClick={copy}>
              {copied ? t("drawer.copied") : t("trace.prompt.copy")}
            </Button>
          }
        >
          <PromptModalBody text={text} />
        </Modal>
      )}
    </div>
  );
}
