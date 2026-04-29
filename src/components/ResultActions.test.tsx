import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnalysisResult } from "../types/analysis";
import ResultActions from "./ResultActions";

const result: AnalysisResult = {
  risk: "GREEN",
  summary: "All good.",
  findings: [],
  fixes: [{ title: "Next steps", steps: ["Keep documents ready."] }],
};

describe("ResultActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates and copies a DB-backed share link", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "AbC123xY" }),
      }),
    );

    render(
      <ResultActions
        data={result}
        cardRef={{ current: document.createElement("div") }}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("https://claimcheck.co.in/v/AbC123xY");
    });
    expect(await screen.findByRole("button", { name: /link copied/i })).toBeInTheDocument();
  });
});
