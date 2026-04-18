import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FiCheckCircle, FiFileText, FiUpload, FiX } from "react-icons/fi";

interface FileDropzoneProps {
  label: string;
  description: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: string;
}

export default function FileDropzone({
  label,
  description,
  file,
  onFileChange,
  accept = ".pdf,.jpg,.jpeg,.png,.webp",
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFileChange(dropped);
  };

  const handleSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    onFileChange(selected);
  };

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-baseline justify-between">
        <label className="text-sm font-semibold text-slate-900">{label}</label>
        {file && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
            <FiCheckCircle className="h-3.5 w-3.5" />
            Ready
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-500">{description}</p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
        className={[
          "relative flex min-h-[160px] flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white p-6 text-center transition-all",
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
          type="file"
          accept={accept}
          onChange={handleSelect}
          className="hidden"
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
              onClick={(e) => {
                e.stopPropagation();
                onFileChange(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white hover:text-red-600"
              aria-label="Remove file"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <FiUpload className="h-5 w-5 text-slate-900" />
            </div>
            <p className="text-sm font-medium text-slate-900">
              Drop file here or <span className="text-slate-700 underline">browse</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG up to 8MB</p>
          </>
        )}
      </div>
    </div>
  );
}
