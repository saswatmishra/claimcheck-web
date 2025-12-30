type Props = {
  label: string;
  hint: string;
  onFile: (file: File | null) => void;
  file?: File | null;
  error?: string | null;
};

export default function UploadCard({
  label,
  hint,
  onFile,
  file,
  error,
}: Props) {
  return (
    <div className="border border-dashed rounded-lg p-4 bg-white">
      <p className="font-medium text-slate-800">{label}</p>
      <p className="text-sm text-slate-500 mb-3">{hint}</p>
      <input
        type="file"
        accept="application/pdf,image/*"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        className="w-full"
      />

      {file && (
        <p className="mt-1 text-xs text-slate-500">
          Type: {file.type || "image"}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
