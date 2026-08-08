import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

const SKILLS: Skill[] = [
  {
    id: "sk1",
    name: "pr-quality-rubric",
    description: "Use when reviewing a pull request for quality.",
    type: "rubric",
    source: "manual",
    body: "# Rubric",
    enabled: true,
    version: 1,
  },
  {
    id: "sk2",
    name: "secrets-guard",
    description: "Use when a diff touches credentials.",
    type: "security",
    source: "manual",
    body: "# Secrets",
    enabled: false,
    version: 2,
  },
];

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// The shell needs the repo/query providers; the list view is what's under test.
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: SKILLS, isLoading: false, isError: false, refetch: vi.fn() }),
  useSkill: () => ({ data: undefined }),
  useUpdateSkill: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false, data: undefined }),
  useDeleteSkill: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateSkill: () => ({ mutate: vi.fn(), isPending: false }),
  useSkillVersions: () => ({ data: [], isLoading: false, isError: false }),
  useRestoreSkillVersion: () => ({ mutate: vi.fn(), isPending: false }),
  useImportSkillPreview: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { SkillsListView } from "./SkillsListView";

afterEach(cleanup);

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <SkillsListView />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("Skills list view", () => {
  it("renders a card per skill", () => {
    renderView();
    expect(screen.getByText("pr-quality-rubric")).toBeInTheDocument();
    expect(screen.getByText("secrets-guard")).toBeInTheDocument();
  });

  it("filters the list by the search box", () => {
    renderView();
    fireEvent.change(screen.getByPlaceholderText("Search skills…"), { target: { value: "secrets" } });
    expect(screen.queryByText("pr-quality-rubric")).not.toBeInTheDocument();
    expect(screen.getByText("secrets-guard")).toBeInTheDocument();
  });

  it("prompts for a selection while ?skill= is unset", () => {
    renderView();
    expect(screen.getByText("Select a skill")).toBeInTheDocument();
  });
});
