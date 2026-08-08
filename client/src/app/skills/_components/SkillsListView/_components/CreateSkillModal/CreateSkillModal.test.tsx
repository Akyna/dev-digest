import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

const createMutate = vi.fn();
vi.mock("@/lib/hooks/skills", () => ({
  useCreateSkill: () => ({ mutate: createMutate, isPending: false }),
}));

import { CreateSkillModal } from "./CreateSkillModal";

afterEach(() => {
  cleanup();
  createMutate.mockReset();
});

function renderModal() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <CreateSkillModal onClose={() => {}} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("CreateSkillModal", () => {
  it("explains that the description is the skill's interface", () => {
    renderModal();
    expect(screen.getByText(/The description is this skill's interface/)).toBeInTheDocument();
  });

  it("submits the trimmed fields as the create payload", () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText("pr-quality-rubric"), {
      target: { value: "  migrations-rubric  " },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Use when reviewing a pull request that touches database migrations…"),
      { target: { value: "Use when a diff touches migrations." } },
    );
    // The body placeholder is multi-line; RTL normalizes whitespace, so match loosely.
    fireEvent.change(screen.getByPlaceholderText(/Describe the rule/), {
      target: { value: "# Rule\nNever hand-edit an applied migration." },
    });

    fireEvent.click(screen.getByText("Create skill"));

    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(createMutate.mock.calls[0]?.[0]).toEqual({
      name: "migrations-rubric",
      description: "Use when a diff touches migrations.",
      type: "custom",
      body: "# Rule\nNever hand-edit an applied migration.",
    });
  });

  it("keeps the submit disabled until there is a name and a body", () => {
    renderModal();
    fireEvent.click(screen.getByText("Create skill"));
    expect(createMutate).not.toHaveBeenCalled();
  });
});
