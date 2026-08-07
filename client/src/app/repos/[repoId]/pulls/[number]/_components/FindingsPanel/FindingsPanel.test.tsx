import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
  useFindingsSearch: () => ({ results: [], loading: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(cleanup);

function finding(o: Partial<FindingRecord>): FindingRecord {
  return {
    id: "f1",
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded secret",
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "A secret is committed.",
    suggestion: null,
    confidence: 0.95,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...o,
  };
}

const FINDINGS: FindingRecord[] = [finding({})];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });
});

describe("FindingsPanel — targetFindingId", () => {
  it("expands the card matching targetFindingId even when it isn't the first (default-expanded) one", () => {
    Element.prototype.scrollIntoView = vi.fn();
    const findings = [
      finding({ id: "f1", title: "First finding" }),
      finding({ id: "f2", title: "Second finding", rationale: "Second rationale text." }),
      finding({ id: "f3", title: "Third finding", rationale: "Third rationale text." }),
    ];
    renderWithIntl(
      <FindingsPanel findings={findings} prId="pr1" targetFindingId="f3" targetNonce={1} />,
    );
    // f1 (index 0) is expanded by default regardless of target — expected.
    expect(screen.getByText("A secret is committed.")).toBeInTheDocument();
    // f3 is the deep-link target, so it expands too even though it's not index 0.
    expect(screen.getByText("Third rationale text.")).toBeInTheDocument();
    // f2 is neither the default nor the target — stays collapsed.
    expect(screen.queryByText("Second rationale text.")).not.toBeInTheDocument();
  });
});
