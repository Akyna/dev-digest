import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent, AgentSkillLink, Skill } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/agents.json";
import { ToastProvider } from "@/lib/toast";

const AGENT: Agent = {
  id: "ag1",
  name: "Security Reviewer",
  description: "Flags secrets and injection",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "You are a security reviewer.",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
};

function skill(over: Partial<Skill> & Pick<Skill, "id" | "name">): Skill {
  return {
    description: `${over.name} description`,
    type: "rubric",
    source: "manual",
    body: "# body",
    enabled: true,
    version: 1,
    ...over,
  };
}

// Module-level fixtures: the hook mocks must return REFERENTIALLY STABLE data.
// SkillsTab seeds its draft from `links` in an effect keyed on the memoised id
// list — a fresh array literal per render would re-seed the draft every render
// and silently undo every edit the test makes.
const SKILLS: Skill[] = [
  skill({ id: "s1", name: "Alpha Rubric", type: "rubric" }),
  skill({ id: "s2", name: "Beta Convention", type: "convention" }),
  skill({ id: "s3", name: "Gamma Security", type: "security" }),
];

// Deliberately NOT alphabetical, and `order` deliberately out of array order —
// prompt order comes from `order`, nothing else.
const LINKS: AgentSkillLink[] = [
  { agent_id: "ag1", skill_id: "s1", order: 1 },
  { agent_id: "ag1", skill_id: "s3", order: 0 },
];

const mutate = vi.fn();
const useSkills = vi.fn(() => ({ data: SKILLS, isLoading: false, isError: false, refetch: vi.fn() }));
const useAgentSkills = vi.fn(() => ({ data: LINKS, isLoading: false, isError: false }));

vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => useSkills(),
  useAgentSkills: () => useAgentSkills(),
  useSetAgentSkills: () => ({ mutate, isPending: false, isSuccess: false }),
}));

import { SkillsTab } from "./SkillsTab";

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      <ToastProvider>
        <SkillsTab agent={AGENT} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

/** Document-order position of a skill name — used to assert prompt order. */
const posOf = (name: string) => document.body.textContent!.indexOf(name);

beforeEach(() => {
  mutate.mockReset();
  useSkills.mockReturnValue({ data: SKILLS, isLoading: false, isError: false, refetch: vi.fn() });
  useAgentSkills.mockReturnValue({ data: LINKS, isLoading: false, isError: false });
});
afterEach(cleanup);

describe("SkillsTab", () => {
  it("renders the order hint, the counter and the linked/available split in prompt order", () => {
    renderTab();

    // The order hint is the mental model of the tab — it must be on screen.
    expect(screen.getByText(/Order matters/)).toBeInTheDocument();
    expect(screen.getByText("2 of 3 enabled")).toBeInTheDocument();

    // Attached first, by `order` (Gamma=0 before Alpha=1), then available.
    expect(posOf("Gamma Security")).toBeLessThan(posOf("Alpha Rubric"));
    expect(posOf("Alpha Rubric")).toBeLessThan(posOf("Beta Convention"));
  });

  it("disables Save while clean and saves the whole ordered set after attaching", () => {
    renderTab();
    const save = screen.getByRole("button", { name: "Save skills" });
    expect(save).toBeDisabled();

    // Switch order: attached Gamma, attached Alpha, available Beta.
    const toggles = screen.getAllByRole("switch");
    expect(toggles).toHaveLength(3);
    fireEvent.click(toggles[2]!); // attach Beta

    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]![0]).toEqual({ agentId: "ag1", skillIds: ["s3", "s1", "s2"] });
  });

  it("detaching removes the skill from the saved set", () => {
    renderTab();
    fireEvent.click(screen.getAllByRole("switch")[0]!); // detach Gamma
    fireEvent.click(screen.getByRole("button", { name: "Save skills" }));
    expect(mutate.mock.calls[0]![0]).toEqual({ agentId: "ag1", skillIds: ["s1"] });
  });

  it("reorders with the arrow buttons and persists the new order", () => {
    renderTab();
    const ups = screen.getAllByLabelText("Move earlier in the prompt");
    expect(ups[0]).toBeDisabled(); // first row cannot move up
    fireEvent.click(ups[1]!); // Alpha moves above Gamma

    expect(posOf("Alpha Rubric")).toBeLessThan(posOf("Gamma Security"));
    fireEvent.click(screen.getByRole("button", { name: "Save skills" }));
    expect(mutate.mock.calls[0]![0]).toEqual({ agentId: "ag1", skillIds: ["s1", "s3"] });
  });

  it("reorders via drag-and-drop and persists the new order", () => {
    const { container } = renderTab();
    const alpha = container.querySelector('[data-testid="skill-row-s1"]')!;
    const gamma = container.querySelector('[data-testid="skill-row-s3"]')!;

    // Draft starts as [s3, s1] (Gamma order=0, Alpha order=1). Dragging Alpha
    // and dropping it on Gamma moves it to sit right before Gamma.
    fireEvent.dragStart(alpha, { dataTransfer: {} });
    fireEvent.dragOver(gamma, { dataTransfer: {} });
    fireEvent.drop(gamma, { dataTransfer: {} });

    expect(posOf("Alpha Rubric")).toBeLessThan(posOf("Gamma Security"));
    fireEvent.click(screen.getByRole("button", { name: "Save skills" }));
    expect(mutate.mock.calls[0]![0]).toEqual({ agentId: "ag1", skillIds: ["s1", "s3"] });
  });

  it("does not make an available (detached) row draggable", () => {
    const { container } = renderTab();
    const beta = container.querySelector('[data-testid="skill-row-s2"]')!;
    expect(beta).toHaveAttribute("draggable", "false");
  });

  it("filters rows without changing the underlying order", () => {
    renderTab();
    fireEvent.change(screen.getByLabelText("Filter skills…"), { target: { value: "beta" } });

    expect(screen.getByText("Beta Convention")).toBeInTheDocument();
    expect(screen.queryByText("Gamma Security")).not.toBeInTheDocument();
    expect(screen.queryByText("Alpha Rubric")).not.toBeInTheDocument();
  });

  it("shows a skeleton while loading and an error state on failure", () => {
    useAgentSkills.mockReturnValue({ data: undefined as never, isLoading: true, isError: false });
    const { unmount } = renderTab();
    expect(screen.queryByText("2 of 3 enabled")).not.toBeInTheDocument();
    unmount();

    useSkills.mockReturnValue({ data: undefined as never, isLoading: false, isError: true, refetch: vi.fn() });
    renderTab();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load skills.");
  });

  it("renders the empty state when the workspace has no skills at all", () => {
    useSkills.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
    useAgentSkills.mockReturnValue({ data: [], isLoading: false, isError: false });
    renderTab();
    expect(screen.getByText("No skills in this workspace")).toBeInTheDocument();
  });
});
