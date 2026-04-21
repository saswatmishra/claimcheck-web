import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Check from "./Check";

describe("Check demo flow", () => {
  it("enters demo mode, shows scenario cards, and cycles scenarios", () => {
    render(<Check />);

    fireEvent.click(screen.getByRole("button", { name: "Try Demo" }));

    expect(screen.getByText("🟢 Safe")).toBeInTheDocument();
    expect(screen.getByText("🟠 Needs Attention")).toBeInTheDocument();
    expect(screen.getByText("🔴 High Risk")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try another scenario" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try another scenario" }));
    expect(
      screen.getByText(/Your policy appears to be expired\. This may affect claim eligibility\./),
    ).toBeInTheDocument();
  });
});
