/**
 * RunHistory — the badge must reflect the review OUTCOME, not the run lifecycle.
 * Regression guard for the "green ✓ done on a run that found 5 blockers" bug:
 * a settled run is colored/labelled by its denormalized blocker/finding counts,
 * and shows the review score ring.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { RunSummary, ReviewRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";
import { RunHistory } from "./RunHistory";

afterEach(cleanup);

function run(o: Partial<RunSummary>): RunSummary {
  return {
    run_id: "run-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash",
    status: "done",
    error: null,
    duration_ms: 1000,
    tokens_in: 100,
    tokens_out: 50,
    cost_usd: null,
    findings_count: 0,
    grounding: "0/0 passed",
    ran_at: "2026-06-11T18:44:34.000Z",
    score: null,
    blockers: null,
    ...o,
  };
}

function renderRuns(
  runs: RunSummary[],
  extra: { reviews?: ReviewRecord[]; onGoToReview?: (runId: string, findingId?: string) => void } = {},
) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <RunHistory runs={runs} reviews={extra.reviews} onOpenTrace={() => {}} onGoToReview={extra.onGoToReview} />
    </NextIntlClientProvider>,
  );
}

function review(o: Partial<ReviewRecord>): ReviewRecord {
  return {
    id: "rv-1",
    pr_id: "pr-1",
    agent_id: "a1",
    run_id: "run-1",
    agent_name: "Security Reviewer",
    kind: "review",
    verdict: "request_changes",
    summary: null,
    score: 38,
    model: "deepseek",
    grounding: null,
    created_at: "2026-06-11T18:44:34.000Z",
    findings: [],
    ...o,
  };
}

/** The findings-popover severity chip's text is just its count (e.g. "1"),
 *  unlike the other buttons in a run row (agent name, open-trace icon). */
function severityChip() {
  return screen.getAllByRole("button").find((b) => b.textContent?.trim() === "1")!;
}

describe("RunHistory — outcome badge", () => {
  it("a done run WITH blockers reads 'rejected' (never green 'done') + shows the score ring", () => {
    renderRuns([run({ status: "done", findings_count: 5, blockers: 5, score: 0 })]);
    expect(screen.getByText("rejected")).toBeInTheDocument();
    expect(screen.queryByText("done")).not.toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument(); // CircularScore renders the number
    expect(screen.getByText(/5 blockers/)).toBeInTheDocument();
  });

  it("a clean done run reads 'approved'", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95 })]);
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("a done run with non-blocking findings reads 'reviewed'", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 0, score: 72 })]);
    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.queryByText(/blockers/)).not.toBeInTheDocument();
  });

  it("a failed run reads 'error'", () => {
    renderRuns([run({ status: "failed", error: "boom", score: null, blockers: null })]);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("a running run reads 'running'", () => {
    renderRuns([run({ status: "running", score: null, blockers: null })]);
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});

describe("RunHistory — usage line", () => {
  it("shows grouped tokens and cost for a priced run", () => {
    renderRuns([run({ tokens_in: 8000, tokens_out: 1119, cost_usd: 0.0013 })]);
    expect(screen.getByText(/9,119 tok/)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.0013/)).toBeInTheDocument();
  });

  it("shows tokens alone when the model's price is unknown", () => {
    renderRuns([run({ tokens_in: 100, tokens_out: 50, cost_usd: null })]);
    expect(screen.getByText(/150 tok/)).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it("renders no usage line for a failed run that never billed", () => {
    renderRuns([run({ status: "failed", error: "429", tokens_in: 0, tokens_out: 0, cost_usd: null })]);
    expect(screen.queryByText(/tok/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});

describe("RunHistory — findings popover", () => {
  it("falls back to the plain finding count when no matching review is passed", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 0 })]);
    expect(screen.getByText("3 finding(s)")).toBeInTheDocument();
  });

  it("shows the severity-chips findings popover when a matching review is passed, and keeps the blockers suffix", () => {
    renderRuns(
      [run({ run_id: "run-1", status: "done", findings_count: 1, blockers: 1 })],
      {
        reviews: [
          review({
            run_id: "run-1",
            findings: [
              {
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
                trifecta_components: null,
                evidence: null,
                review_id: "rv-1",
                accepted_at: null,
                dismissed_at: null,
              },
            ],
          }),
        ],
      },
    );
    expect(screen.queryByText("1 finding(s)")).not.toBeInTheDocument();
    expect(screen.getByText(/1 blockers/)).toBeInTheDocument();
    fireEvent.mouseEnter(severityChip().parentElement!);
    expect(screen.getByText("Hardcoded Stripe secret key")).toBeInTheDocument();
  });

  it("clicking a finding in the popover calls onGoToReview with the run id and finding id (no navigation — already on the page)", () => {
    const onGoToReview = vi.fn();
    renderRuns(
      [run({ run_id: "run-1", status: "done", findings_count: 1, blockers: 0 })],
      {
        onGoToReview,
        reviews: [
          review({
            run_id: "run-1",
            findings: [
              {
                id: "f7",
                severity: "WARNING",
                category: "perf",
                title: "N+1 query",
                file: "src/api/users.ts",
                start_line: 46,
                end_line: 46,
                rationale: "Per-row query inside a loop.",
                suggestion: null,
                confidence: 0.86,
                kind: "finding",
                trifecta_components: null,
                evidence: null,
                review_id: "rv-1",
                accepted_at: null,
                dismissed_at: null,
              },
            ],
          }),
        ],
      },
    );
    fireEvent.mouseEnter(severityChip().parentElement!);
    fireEvent.click(screen.getByText("N+1 query"));
    expect(onGoToReview).toHaveBeenCalledWith("run-1", "f7");
  });
});
