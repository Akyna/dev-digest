/* ImportSkillDrawer — import a skill from a .md file or a .zip bundle, in three
   steps: choose the file, read the preview, then explicitly save.

   Three product constraints this flow exists to enforce:
   1. Nothing is persisted before the user confirms. The preview call is a pure
      read; only the "Save skill" click writes.
   2. Archive entries other than the markdown core are listed, never unpacked
      and never executed — the client hands the archive over as opaque bytes and
      shows what the server chose to leave alone.
   3. A skill is configuration text. It executes nothing; it only becomes a
      block in the assembled review prompt, which is why the imported body has
      to be read by a human before it is saved. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Drawer, FormField, Icon, SectionLabel } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useCreateSkill, useImportSkillPreview, type SkillImportPreview } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { DRAWER_WIDTH, FILE_ACCEPT, IMPORT_SOURCE } from "./constants";
import { isAllowedFile, readSkillFile } from "./helpers";
import { s } from "./styles";

export function ImportSkillDrawer({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported?: (skill: Skill) => void;
}) {
  const t = useTranslations("skills");
  const toast = useToast();
  const previewImport = useImportSkillPreview();
  const create = useCreateSkill();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // The preview is held locally rather than read off the mutation so that
  // picking another file visibly rewinds the flow to step 1.
  const [preview, setPreview] = React.useState<SkillImportPreview | null>(null);
  // Monotonic id of the newest preview request. Reading a large .zip and POSTing
  // it is slow enough for the user to pick a different file mid-flight; without
  // this, the older response would land into state under the newer file's name
  // and Save would persist the WRONG file's body — defeating the entire
  // read-it-before-you-save design of this drawer.
  const previewRun = React.useRef(0);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    previewRun.current += 1; // invalidate anything already in flight
    setPreview(null);
    setError(picked && !isAllowedFile(picked.name) ? t("file.badExtension") : null);
    setFile(picked && isAllowedFile(picked.name) ? picked : null);
  };

  const runPreview = async () => {
    if (!file) return;
    setError(null);
    const run = ++previewRun.current;
    try {
      const input = await readSkillFile(file);
      if (run !== previewRun.current) return; // a newer pick superseded us
      previewImport.mutate(input, {
        onSuccess: (result) => {
          if (run === previewRun.current) setPreview(result);
        },
      });
    } catch {
      // Reading happens in the browser, so a failure here is local, not an API
      // error the global toast would have caught.
      setError(t("drawer.importFailed"));
    }
  };

  /** Step 3. The only call that writes anything. */
  const save = () => {
    if (!preview) return;
    create.mutate(
      {
        name: preview.name,
        description: preview.description,
        type: preview.type,
        body: preview.body,
        source: IMPORT_SOURCE,
      },
      {
        onSuccess: (skill) => {
          toast.success(t("file.success", { name: skill.name }));
          onImported?.(skill);
          onClose();
        },
      },
    );
  };

  return (
    <Drawer
      width={DRAWER_WIDTH}
      title={t("drawer.title")}
      subtitle={t("drawer.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            {t("file.cancel")}
          </Button>
          {preview ? (
            <Button kind="primary" icon="Check" onClick={save} disabled={create.isPending}>
              {create.isPending ? t("file.saving") : t("file.save")}
            </Button>
          ) : (
            <Button
              kind="primary"
              icon="Eye"
              onClick={runPreview}
              disabled={!file || previewImport.isPending}
            >
              {previewImport.isPending ? t("file.previewing") : t("file.preview")}
            </Button>
          )}
        </div>
      }
    >
      <div style={s.body}>
        <FormField label={t("file.chooseLabel")} hint={t("file.chooseHint")}>
          <div style={s.chooseRow}>
            <input
              ref={inputRef}
              type="file"
              accept={FILE_ACCEPT}
              aria-label={t("file.chooseLabel")}
              onChange={pick}
              style={s.fileInput}
            />
            <Button kind="secondary" icon="Upload" onClick={() => inputRef.current?.click()}>
              {file ? t("file.change") : t("file.choose")}
            </Button>
            <span style={s.filename}>{file ? file.name : t("file.noFile")}</span>
          </div>
          {error && (
            <div role="alert" style={s.error}>
              {error}
            </div>
          )}
        </FormField>

        {preview && <ImportPreview preview={preview} />}
      </div>
    </Drawer>
  );
}

/** Step 2 — everything the user has to be able to see before deciding. */
function ImportPreview({ preview }: { preview: SkillImportPreview }) {
  const t = useTranslations("skills");

  return (
    <>
      <div style={s.callout}>
        <Icon.AlertTriangle size={15} style={s.calloutIcon} />
        <div>
          <div style={s.calloutTitle}>{t("file.trustTitle")}</div>
          <p style={s.calloutBody}>{t("file.trustBody")}</p>
        </div>
      </div>

      <div style={s.section}>
        <SectionLabel>{t("file.derived")}</SectionLabel>
        <div style={s.derivedRow}>
          <span style={s.derivedTerm}>{t("file.derivedName")}</span>
          <span style={s.derivedValue}>{preview.name}</span>
        </div>
        <div style={s.derivedRow}>
          <span style={s.derivedTerm}>{t("file.derivedType")}</span>
          <Badge>{t(`listItem.type.${preview.type}`)}</Badge>
        </div>
        <div style={s.derivedRow}>
          <span style={s.derivedTerm}>{t("file.derivedDescription")}</span>
          <span style={s.derivedValue}>{preview.description || t("listItem.noDescription")}</span>
        </div>
      </div>

      <div style={s.section}>
        <SectionLabel>{t("file.bodyPreview")}</SectionLabel>
        <pre style={s.bodyPreview}>{preview.body}</pre>
      </div>

      {preview.ignored_files.length > 0 && (
        <div style={s.section}>
          <SectionLabel icon="File">{t("file.ignoredFiles")}</SectionLabel>
          <ul style={s.list}>
            {preview.ignored_files.map((f) => (
              <li key={f} className="mono" style={s.listItem}>
                {f}
              </li>
            ))}
          </ul>
          <p style={s.hint}>{t("file.ignoredHint")}</p>
        </div>
      )}

      {preview.warnings.length > 0 && (
        <div style={s.section}>
          <SectionLabel icon="AlertTriangle">{t("file.warnings")}</SectionLabel>
          <ul style={s.list}>
            {preview.warnings.map((w) => (
              <li key={w} style={s.listItem}>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p style={s.unsaved}>{t("file.unsaved")}</p>
    </>
  );
}
