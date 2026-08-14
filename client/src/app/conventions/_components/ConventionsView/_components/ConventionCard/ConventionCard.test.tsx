import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../messages/en/conventions.json";
import type { ConventionCandidate } from "@/lib/hooks/conventions";
import { ConventionCard } from "./ConventionCard";

afterEach(cleanup);

const CANDIDATE: ConventionCandidate = {
  id: "c1",
  rule: "Use camelCase for variable names.",
  evidence_path: "src/foo.ts",
  evidence_snippet: "const fooBar = 1;",
  confidence: 0.9,
  accepted: false,
  category: "naming",
  evidence_line: 3,
  evidence_end_line: null,
  status: "pending",
  support_count: 2,
  edited: false,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("ConventionCard", () => {
  it("renders the rule, evidence path:line and confidence", () => {
    renderWithIntl(
      <ConventionCard candidate={CANDIDATE} onStatusChange={() => {}} onEdit={() => {}} />,
    );
    expect(screen.getByText("Use camelCase for variable names.")).toBeInTheDocument();
    expect(screen.getByText("src/foo.ts:3")).toBeInTheDocument();
    expect(screen.getByText("const fooBar = 1;")).toBeInTheDocument();
  });

  it("fires accept/reject", () => {
    const onStatusChange = vi.fn();
    renderWithIntl(
      <ConventionCard candidate={CANDIDATE} onStatusChange={onStatusChange} onEdit={() => {}} />,
    );
    fireEvent.click(screen.getByText("Accept"));
    expect(onStatusChange).toHaveBeenCalledWith("accepted");
    fireEvent.click(screen.getByText("Reject"));
    expect(onStatusChange).toHaveBeenCalledWith("rejected");
  });

  it("clicking the accepted button toggles back to pending", () => {
    const onStatusChange = vi.fn();
    renderWithIntl(
      <ConventionCard
        candidate={{ ...CANDIDATE, status: "accepted" }}
        onStatusChange={onStatusChange}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Accepted"));
    expect(onStatusChange).toHaveBeenCalledWith("pending");
  });

  it("edits the rule and snippet inline", () => {
    const onEdit = vi.fn();
    renderWithIntl(<ConventionCard candidate={CANDIDATE} onStatusChange={() => {}} onEdit={onEdit} />);

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByDisplayValue(CANDIDATE.rule), {
      target: { value: "Use PascalCase for classes." },
    });
    fireEvent.click(screen.getByText("Save"));

    expect(onEdit).toHaveBeenCalledWith({
      rule: "Use PascalCase for classes.",
      evidence_snippet: CANDIDATE.evidence_snippet,
    });
  });
});
