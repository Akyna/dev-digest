import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";
import type { SkillImportPreview } from "@/lib/hooks/skills";

// jsdom 25 implements Blob without `.text()`, which every browser has. Bridge it
// with FileReader (which jsdom does implement) so the drawer's real read path runs.
if (typeof File.prototype.text !== "function") {
  File.prototype.text = function (this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

const PREVIEW: SkillImportPreview = {
  name: "migrations-rubric",
  description: "Use when a diff touches migrations.",
  type: "rubric",
  body: "# Rule\nNever hand-edit an applied migration.",
  ignored_files: ["setup.sh", "assets/logo.png"],
  warnings: ["The archive contains executable files."],
};

const createMutate = vi.fn();
const previewMutate = vi.fn(
  (_input: unknown, opts?: { onSuccess?: (p: SkillImportPreview) => void }) =>
    opts?.onSuccess?.(PREVIEW),
);

vi.mock("@/lib/hooks/skills", () => ({
  useCreateSkill: () => ({ mutate: createMutate, isPending: false }),
  useImportSkillPreview: () => ({ mutate: previewMutate, isPending: false }),
}));

import { ImportSkillDrawer } from "./ImportSkillDrawer";

afterEach(() => {
  cleanup();
  createMutate.mockReset();
  previewMutate.mockClear();
});

function renderDrawer() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <ImportSkillDrawer onClose={() => {}} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

function choose(name: string) {
  const input = screen.getByLabelText("Skill file");
  fireEvent.change(input, { target: { files: [new File(["# Rule"], name, { type: "text/markdown" })] } });
}

describe("ImportSkillDrawer", () => {
  it("rejects anything that is not .md or .zip", () => {
    renderDrawer();
    choose("payload.exe");
    expect(screen.getByRole("alert")).toHaveTextContent("Only .md and .zip files can be imported.");
    expect(previewMutate).not.toHaveBeenCalled();
  });

  // The product rule: a preview is a read. Nothing reaches the database until
  // the user has seen the body and clicked Save.
  it("does not create the skill until the preview is explicitly confirmed", async () => {
    renderDrawer();
    choose("migrations-rubric.md");
    fireEvent.click(screen.getByText("Preview import"));

    expect(await screen.findByText("Review this before you save it")).toBeInTheDocument();
    expect(previewMutate).toHaveBeenCalledTimes(1);
    expect(previewMutate.mock.calls[0]?.[0]).toEqual({
      filename: "migrations-rubric.md",
      content: "# Rule",
    });
    expect(createMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Save skill"));

    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate.mock.calls[0]?.[0]).toEqual({
      name: PREVIEW.name,
      description: PREVIEW.description,
      type: PREVIEW.type,
      body: PREVIEW.body,
      source: "imported_url",
    });
  });

  it("lists archive entries as left alone, and says nothing is saved yet", async () => {
    renderDrawer();
    choose("bundle.md");
    fireEvent.click(screen.getByText("Preview import"));

    expect(await screen.findByText("setup.sh")).toBeInTheDocument();
    expect(
      screen.getByText("These archive entries were listed and left alone — never unpacked, never executed."),
    ).toBeInTheDocument();
    expect(screen.getByText("The archive contains executable files.")).toBeInTheDocument();
    expect(screen.getByText("Nothing has been saved yet — this is a preview.")).toBeInTheDocument();
  });
});
