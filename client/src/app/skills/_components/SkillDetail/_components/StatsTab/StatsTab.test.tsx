import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/skills.json";

const SKILL: Skill = {
  id: "sk1",
  name: "pr-quality-rubric",
  description: "",
  type: "rubric",
  source: "manual",
  body: "# body",
  enabled: true,
  version: 3,
};

const useSkillStats = vi.fn();
vi.mock("@/lib/hooks/skills", () => ({ useSkillStats: () => useSkillStats() }));

import { StatsTab } from "./StatsTab";

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <StatsTab skill={SKILL} />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe("StatsTab", () => {
  it("renders the agent count and the linked-agents list", () => {
    useSkillStats.mockReturnValue({
      data: {
        skill_id: "sk1",
        versions: 3,
        agents_linked: 2,
        agents: [
          { id: "a1", name: "General Reviewer" },
          { id: "a2", name: "Test Quality Reviewer" },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    const { container } = renderTab();

    expect(container.textContent).toMatch(/2\s*agents/i);
    expect(screen.getByText("General Reviewer")).toBeInTheDocument();
    expect(screen.getByText("Test Quality Reviewer")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open" })[0]).toHaveAttribute("href", "/agents/a1");
  });

  it("shows an empty state when no agent uses this skill", () => {
    useSkillStats.mockReturnValue({
      data: { skill_id: "sk1", versions: 1, agents_linked: 0, agents: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderTab();
    expect(screen.getByText("Not used by any agent yet")).toBeInTheDocument();
  });

  it("shows an error state on failure", () => {
    useSkillStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });
    renderTab();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load stats.");
  });
});
