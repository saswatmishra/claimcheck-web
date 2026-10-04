import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FiCheckCircle, FiFileText, FiUpload, FiX } from "react-icons/fi";
import { validateDocumentFile } from "../shared/documents.js";

interface FileDropzoneProps {
  label: string;
  description: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: string;
  disabled?: boolean;
}

export default function FileDropzone({
  label,
  description,
  file,
  onFileChange,
  accept = ".pdf,.jpg,.jpeg,.png,.webp",
  disabled = false,
}: FileDropzoneProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseFile = (files: FileList | null) => {
    if (disabled || !files?.length) return;
    const message = files.length > 1
      ? "Choose one file for this document."
      : validateDocumentFile(files[0]);
    setError(message);
    if (!message) onFileChange(files[0]);
    if (inputRef.current) inputRef.current.value = "";
  };

  useEffect(() => {
    if (!file && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [file]);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    chooseFile(e.dataTransfer.files);
  };

  const handleSelect = (e: ChangeEvent<HTMLInputElement>) => {
    chooseFile(e.target.files);
  };

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-semibold text-slate-900">{label}</label>
        {file && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
            <FiCheckCircle className="h-3.5 w-3.5" />
            Ready
          </span>
        )}
      </div>
      <p id={`${id}-description`} className="mb-3 text-xs text-slate-500">{description}</p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled && !file && inputRef.current) {
            inputRef.current.value = "";
            inputRef.current.click();
          }
        }}
        className={[
          "relative flex min-h-[160px] flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white p-6 text-center transition-all focus-within:ring-2 focus-within:ring-slate-600 focus-within:ring-offset-2",
          disabled ? "opacity-60" : "",
          !file ? "cursor-pointer" : "cursor-default",
          isDragging ? "border-slate-900 bg-slate-50" : "",
          !isDragging && !file
            ? "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
            : "",
          file ? "border-green-200 bg-green-50/40" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          disabled={disabled}
          aria-describedby={`${id}-description${error ? ` ${id}-error` : ""}`}
          aria-invalid={!!error}
          onChange={handleSelect}
          className="sr-only"
        />

        {file ? (
          <div className="flex w-full items-center gap-3 text-left">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
              <FiFileText className="h-5 w-5 text-slate-900" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onFileChange(null);
                setError(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white hover:text-red-600"
              aria-label={`Remove ${label} file`}
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <FiUpload className="h-5 w-5 text-slate-900" />
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                inputRef.current?.click();
              }}
              className="rounded text-sm font-medium text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
              aria-label={`Choose ${label} file`}
            >
              Drop file here or <span className="text-slate-700 underline">browse</span>
            </button>
            <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG, WebP · up to 8 MB</p>
          </>
        )}
      </div>
      {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
