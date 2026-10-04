import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Check from "./Check";

beforeEach(() => localStorage.clear());
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const report = { risk: "GREEN", summary: "Matching documents", findings: [], fixes: [] };
function selectFiles() {
  fireEvent.change(screen.getByLabelText("Registration Certificate (RC)"), { target: { files: [new File(["rc"], "rc.png", { type: "image/png" })] } });
  fireEvent.change(screen.getByLabelText("Insurance Policy"), { target: { files: [new File(["policy"], "policy.pdf", { type: "application/pdf" })] } });
}

describe("Check demo flow", () => {
  it("enters demo mode, shows scenario cards, and cycles scenarios", () => {
    render(<Check />);

    fireEvent.click(screen.getByRole("button", { name: "Try Demo" }));

    expect(screen.getByText("🟢 Details Match")).toBeInTheDocument();
    expect(screen.getByText("🔴 Policy Expired")).toBeInTheDocument();
    expect(screen.getByText("🔴 High Risk")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try another scenario" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try another scenario" }));
    expect(
      screen.getByText(/Your policy appears to be expired\. This may affect claim eligibility\./),
    ).toBeInTheDocument();
  });
});

describe("Check real document flow", () => {
  it("omits the DL after the user deselects it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => report });
    vi.stubGlobal("fetch", fetchMock);
    render(<Check />);
    selectFiles();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Driving License (Optional)"), { target: { files: [new File(["dl"], "dl.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Analyze Documents" }));
    await screen.findByText("Matching documents");
    expect((fetchMock.mock.calls[0][1].body as FormData).has("dl")).toBe(false);
  });

  it("clears stale results when an uploaded document changes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => report }));
    render(<Check />);
    selectFiles();
    fireEvent.click(screen.getByRole("button", { name: "Analyze Documents" }));
    await screen.findByText("Matching documents");
    fireEvent.click(screen.getByRole("button", { name: "Remove Insurance Policy file" }));
    expect(screen.queryByText("Matching documents")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze Documents" })).toBeDisabled();
  });

  it("cancels a pending check and ignores its late result", async () => {
    let resolveRequest!: (response: unknown) => void;
    const fetchMock = vi.fn(() => new Promise((resolve) => { resolveRequest = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Check />);
    selectFiles();
    fireEvent.click(screen.getByRole("button", { name: "Analyze Documents" }));
    expect(screen.getByLabelText("Insurance Policy")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel check" }));
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true);
    await act(async () => resolveRequest({ ok: true, json: async () => report }));
    expect(screen.queryByText("Matching documents")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze Documents" })).toBeEnabled();
  });

  it("shows a useful network error while retaining selected files", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<Check />);
    selectFiles();
    fireEvent.click(screen.getByRole("button", { name: "Analyze Documents" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Check your connection"));
    expect(screen.getByText("rc.png")).toBeInTheDocument();
    expect(screen.getByText("policy.pdf")).toBeInTheDocument();
  });

  it("rejects malformed reports without crashing the results view", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...report, findings: [null] }) }));
    render(<Check />);
    selectFiles();
    fireEvent.click(screen.getByRole("button", { name: "Analyze Documents" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("incomplete report"));
  });
});
