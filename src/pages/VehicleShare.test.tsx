import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import VehicleShare from "./VehicleShare";

afterEach(() => vi.unstubAllGlobals());

describe("shared report recovery", () => {
  it("distinguishes a network error from a missing report and supports retry", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce({ ok: true, json: async () => ({ id: "AbC123xY", report: { risk: "GREEN", summary: "Shared test report", findings: [], fixes: [] } }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter initialEntries={["/v/AbC123xY"]}><Routes><Route path="/v/:id" element={<VehicleShare />} /></Routes></MemoryRouter>);
    expect(await screen.findByText("We couldn’t load this report")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Shared test report")).toBeInTheDocument();
  });
});
