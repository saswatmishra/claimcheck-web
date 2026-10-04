import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FileDropzone from "./FileDropzone";

describe("document uploads", () => {
  it("labels the input and provides a keyboard-accessible browse button", () => {
    render(<FileDropzone label="RC" description="Registration" file={null} onFileChange={vi.fn()} />);
    expect(screen.getByLabelText("RC")).toHaveAttribute("type", "file");
    expect(screen.getByRole("button", { name: "Choose RC file" })).toBeEnabled();
  });

  it.each([
    [new File(["data"], "file.txt", { type: "text/plain" }), "Choose a PDF"],
    [new File([], "file.pdf", { type: "application/pdf" }), "empty"],
    [new File([new Uint8Array(8 * 1024 * 1024 + 1)], "file.pdf", { type: "application/pdf" }), "too large"],
  ])("rejects an invalid selection with a useful message", (file, message) => {
    const onFileChange = vi.fn();
    render(<FileDropzone label="RC" description="Registration" file={null} onFileChange={onFileChange} />);
    fireEvent.change(screen.getByLabelText("RC"), { target: { files: [file] } });
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(onFileChange).not.toHaveBeenCalled();
  });

  it("validates dropped files and preserves an existing valid selection", () => {
    const onFileChange = vi.fn();
    render(<FileDropzone label="RC" description="Registration" file={new File(["pdf"], "rc.pdf", { type: "application/pdf" })} onFileChange={onFileChange} />);
    fireEvent.drop(screen.getByLabelText("RC").parentElement!, { dataTransfer: { files: [new File(["data"], "bad.exe", { type: "application/octet-stream" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a PDF");
    expect(screen.getByText("rc.pdf")).toBeInTheDocument();
    expect(onFileChange).not.toHaveBeenCalled();
  });

  it("does not change files while disabled", () => {
    const onFileChange = vi.fn();
    render(<FileDropzone label="RC" description="Registration" file={null} onFileChange={onFileChange} disabled />);
    fireEvent.drop(screen.getByLabelText("RC").parentElement!, { dataTransfer: { files: [new File(["pdf"], "rc.pdf", { type: "application/pdf" })] } });
    expect(onFileChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
