/**
 * FindingsHoverPopover — the reusable severity-chips + hover popover shared by
 * the PR list's FINDINGS column and the PR detail page's Timeline. Covers the
 * three interactions confirmed with the user: hover reveals every finding,
 * clicking a severity chip filters the popover to that severity, and clicking
 * a finding calls back with its id (without also firing the parent row's own
 * click handler — the popover stops propagation).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Finding } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";
import { FindingsHoverPopover } from "./FindingsHoverPopover";

afterEach(cleanup);

function f(o: Partial<Finding>): Finding {
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

function renderPopover(findings: Finding[], onFindingClick = vi.fn()) {
  const utils = render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <div
        data-testid="parent-row"
        onClick={() => {
          throw new Error("parent row click should never fire from inside the popover");
        }}
      >
        <FindingsHoverPopover findings={findings} onFindingClick={onFindingClick} />
      </div>
    </NextIntlClientProvider>,
  );
  return { ...utils, onFindingClick };
}

/** The trigger wrapper is the chip buttons' common parent — hover it to open the popover. */
function hoverTrigger() {
  const chip = screen.getAllByRole("button")[0]!;
  fireEvent.mouseEnter(chip.parentElement!);
}

describe("FindingsHoverPopover — empty state", () => {
  it("renders an em-dash and no chips when there are no findings", () => {
    renderPopover([]);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("FindingsHoverPopover — hover", () => {
  it("shows every finding on hover, grouped/ordered by severity", () => {
    renderPopover([
      f({ id: "f1", severity: "SUGGESTION", title: "Suggestion finding" }),
      f({ id: "f2", severity: "CRITICAL", title: "Critical finding" }),
      f({ id: "f3", severity: "WARNING", title: "Warning finding" }),
    ]);
    hoverTrigger();
    expect(screen.getByText("3 FINDINGS")).toBeInTheDocument();
    expect(screen.getByText("Critical finding")).toBeInTheDocument();
    expect(screen.getByText("Warning finding")).toBeInTheDocument();
    expect(screen.getByText("Suggestion finding")).toBeInTheDocument();
  });

  it("closes on mouse leave", () => {
    renderPopover([f({})]);
    hoverTrigger();
    expect(screen.getByText("Hardcoded Stripe secret key")).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getAllByRole("button")[0]!.parentElement!);
    expect(screen.queryByText("Hardcoded Stripe secret key")).not.toBeInTheDocument();
  });
});

describe("FindingsHoverPopover — severity filter", () => {
  it("clicking a severity chip narrows the popover to that severity", () => {
    renderPopover([
      f({ id: "f1", severity: "CRITICAL", title: "Critical finding" }),
      f({ id: "f2", severity: "WARNING", title: "Warning finding" }),
    ]);
    hoverTrigger();
    expect(screen.getByText("2 FINDINGS")).toBeInTheDocument();

    // Severity chips render as just "{count}" next to an icon; finding items
    // render a full title/meta line, so an exact-text match picks the chip.
    const criticalChip = screen.getAllByRole("button").find((b) => b.textContent?.trim() === "1")!;
    fireEvent.click(criticalChip);
    expect(screen.getByText("1 FINDINGS")).toBeInTheDocument();
    expect(screen.getByText("Critical finding")).toBeInTheDocument();
    expect(screen.queryByText("Warning finding")).not.toBeInTheDocument();

    // Clicking the same chip again clears the filter.
    fireEvent.click(criticalChip);
    expect(screen.getByText("2 FINDINGS")).toBeInTheDocument();
  });
});

describe("FindingsHoverPopover — click-through", () => {
  it("calls onFindingClick with the finding id and does not bubble to the parent row", () => {
    const { onFindingClick } = renderPopover([f({ id: "f1", title: "Hardcoded Stripe secret key" })]);
    hoverTrigger();
    fireEvent.click(screen.getByText("Hardcoded Stripe secret key"));
    expect(onFindingClick).toHaveBeenCalledWith("f1");
  });
});
