import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../messages/en/conventions.json";
import { ToastProvider } from "@/lib/toast";

const draftMutate = vi.fn((_ids: string[], opts?: { onSuccess?: (d: unknown) => void }) => {
  opts?.onSuccess?.({
    name: "acme-repo-conventions",
    description: "2 house conventions extracted from acme-repo",
    body: "# acme-repo-conventions\n\nsome body",
  });
});
const createMutate = vi.fn();

vi.mock("@/lib/hooks/conventions", () => ({
  useSkillDraft: () => ({ mutate: draftMutate, isPending: false }),
  useCreateSkillFromConventions: () => ({ mutate: createMutate, isPending: false }),
}));
vi.mock("@/lib/hooks/agents", () => ({
  useAgents: () => ({ data: [{ id: "a1", name: "General reviewer" }] }),
}));

import { CreateSkillFromConventionsModal } from "./CreateSkillFromConventionsModal";

afterEach(() => {
  cleanup();
  draftMutate.mockClear();
  createMutate.mockClear();
});

function renderModal() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      <ToastProvider>
        <CreateSkillFromConventionsModal
          repoId="r1"
          repoName="acme-repo"
          conventionIds={["c1", "c2"]}
          onClose={() => {}}
        />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("CreateSkillFromConventionsModal", () => {
  it("loads the server draft into the name/description/body fields", async () => {
    renderModal();
    await waitFor(() => expect(draftMutate).toHaveBeenCalledWith(["c1", "c2"], expect.anything()));
    expect(await screen.findByDisplayValue("acme-repo-conventions")).toBeInTheDocument();
  });

  it("pre-selects the default agent and submits the create payload", async () => {
    renderModal();
    await waitFor(() => expect(screen.getByDisplayValue("acme-repo-conventions")).toBeInTheDocument());

    screen.getByText("Create skill").click();

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const payload = createMutate.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      convention_ids: ["c1", "c2"],
      name: "acme-repo-conventions",
      type: "convention",
      agent_ids: ["a1"],
    });
  });
});
