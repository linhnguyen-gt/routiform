"use client";

import Tooltip from "@/shared/components/Tooltip";

interface FieldLabelWithHelpProps {
  label: string;
  help: string;
}

export function FieldLabelWithHelp({ label, help }: FieldLabelWithHelpProps) {
  return (
    <div className="flex items-center gap-1 mb-0.5">
      <label className="text-[10px] text-text-muted">{label}</label>
      <Tooltip content={help}>
        <span className="material-symbols-outlined text-[12px] text-text-muted cursor-help">
          help
        </span>
      </Tooltip>
    </div>
  );
}
