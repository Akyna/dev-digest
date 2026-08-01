/**
 * PRRow — the COST cell. A PR whose runs have no known price must read "—", not
 * "$0.00": the list is the first place someone checks what reviews are costing,
 * and a fake zero there is worse than an honest blank.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta, Finding } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { PRRow } from "./PRRow";

afterEach(cleanup);

function pr(o: Partial<PrMeta>): PrMeta {
  return {
    id: "pr-1",
    number: 482,
    title: "Add rate limiting to public API endpoints",
    author: "marisa.koch",
    branch: "feat/rate-limit-public",
    base: "main",
    head_sha: "abc1234",
    additions: 247,
    deletions: 38,
    files_count: 9,
    status: "needs_review",
    opened_at: "2026-06-11T18:00:00.000Z",
    updated_at: "2026-06-11T18:44:34.000Z",
    score: 61,
    cost_usd: 0.014,
    ...o,
  };
}

function renderRow(meta: PrMeta) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <PRRow pr={meta} repoId="repo-1" />
    </NextIntlClientProvider>,
  );
}

describe("PRRow — cost cell", () => {
  it("renders the summed run cost", () => {
    renderRow(pr({ cost_usd: 0.014 }));
    expect(screen.getByText("$0.014")).toBeInTheDocument();
  });

  it("renders an em-dash when no run on the PR has a known price", () => {
    renderRow(pr({ cost_usd: null, score: null }));
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    // The score ring, findings cell, and cost cell all fall back to the same em-dash.
    expect(screen.getAllByText("—")).toHaveLength(3);
  });
});

function finding(o: Partial<Finding>): Finding {
  return {
    id: "f1",
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded Stripe secret key",
    file: "src/config.ts",
    start_line: 12,
    end_line: 12,
    rationale: "A live Stripe key is committed in source.",
    suggestion: null,
    confidence: 0.98,
    kind: "finding",
    ...o,
  };
}

describe("PRRow — findings cell", () => {
  afterEach(() => push.mockClear());

  it("renders an em-dash when the PR was never reviewed", () => {
    renderRow(pr({ score: null, top_findings: null }));
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("hovering the findings popover and clicking a finding navigates to the PR detail with ?tab=findings&findingId=", () => {
    renderRow(pr({ score: 61, top_findings: [finding({ id: "f42" })] }));
    const chip = screen.getByRole("button");
    fireEvent.mouseEnter(chip.parentElement!);
    fireEvent.click(screen.getByText("Hardcoded Stripe secret key"));
    // Exactly once, and with the deep-link URL — proves the popover stops the
    // click from also bubbling to the row's own "navigate to the PR" handler.
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/repos/repo-1/pulls/482?tab=findings&findingId=f42");
  });
});
