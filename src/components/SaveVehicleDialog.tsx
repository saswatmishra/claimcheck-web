import { useLayoutEffect, useId, useRef, useState } from "react";
import { FiBookmark, FiX } from "react-icons/fi";

interface SaveVehicleDialogProps {
  open: boolean;
  defaultRegNumber?: string;
  onClose: () => void;
  onSave: (data: { regNumber: string; nickname: string }) => void | boolean;
}

export default function SaveVehicleDialog({
  open,
  ...props
}: SaveVehicleDialogProps) {
  return open ? <SaveVehicleForm {...props} /> : null;
}

function SaveVehicleForm({
  defaultRegNumber = "",
  onClose,
  onSave,
}: Omit<SaveVehicleDialogProps, "open">) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [regNumber, setRegNumber] = useState(defaultRegNumber);
  const [nickname, setNickname] = useState("");

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  const closeDialog = () => {
    dialogRef.current?.close();
    onClose();
  };

  const canSave = regNumber.trim().length > 0;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => { event.preventDefault(); closeDialog(); }}
      className="w-[calc(100%-2rem)] max-w-md rounded-2xl bg-card p-0 backdrop:bg-black/40 backdrop:backdrop-blur-sm"
      onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}
    >
      <form
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave && onSave({ regNumber: regNumber.trim(), nickname: nickname.trim() }) !== false) closeDialog();
        }}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
              <FiBookmark className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 id={`${id}-title`} className="text-base font-semibold text-foreground">Save vehicle</h3>
              <p className="text-xs text-muted-foreground">
                Stored in this browser only
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor={`${id}-reg`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Registration number
            </label>
            <input
              id={`${id}-reg`}
              type="text"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
              placeholder="MH 12 AB 1234"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium tracking-wide text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor={`${id}-nickname`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nickname{" "}
              <span className="font-normal normal-case text-muted-foreground/70">
                (optional)
              </span>
            </label>
            <input
              id={`${id}-nickname`}
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. My Swift"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={closeDialog}
            className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            Save vehicle
          </button>
        </div>
      </form>
    </dialog>
  );
}
