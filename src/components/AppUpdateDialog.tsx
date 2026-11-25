import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

export type AppUpdateChoice = "cancel" | "confirm" | "skip";

interface Props {
  current: string;
  version: string;
  onChoice: (choice: AppUpdateChoice) => void;
}

export function AppUpdateDialog({ current, version, onChoice }: Props) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const secondaryClass = "rounded-lg px-3 py-1.5 text-[13px] font-medium text-tertiary hover:bg-surface-hover hover:text-secondary";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    cancelRef.current?.focus();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="app-update-title"
      aria-describedby="app-update-description"
      onCancel={(event) => {
        event.preventDefault();
        onChoice("cancel");
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-border bg-surface p-5 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <h2 id="app-update-title" className="mb-3 text-[14px] font-semibold text-primary">
        {t("settings.installUpdate")}
      </h2>
      <p id="app-update-description" className="mb-5 text-[13px] leading-5 text-tertiary">
        {t("settings.confirmAppUpdate", { current, version })}
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => onChoice("skip")} className={`mr-auto ${secondaryClass}`}>
          {t("settings.skipAppUpdate")}
        </button>
        <button ref={cancelRef} type="button" onClick={() => onChoice("cancel")} className={secondaryClass}>
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={() => onChoice("confirm")}
          className="rounded-lg border border-accent-border bg-accent-dark px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent"
        >
          {t("common.confirm")}
        </button>
      </div>
    </dialog>
  );
}
