import React from "react";
import { ActionButtons } from "./ActionButtons";

export interface HeaderBarProps {
  title: string;
  projectName?: string;
  onAutofillAll?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  onConfigure?: () => void;
  primaryActionLabel?: string;
  ids?: { rootId?: string };
  disabled?: { share?: boolean; configure?: boolean };
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  title,
  projectName,
  onAutofillAll,
  onExport,
  onShare,
  onConfigure,
  primaryActionLabel,
  ids,
  disabled,
}) => {
  return (
    <div id={ids?.rootId} className="bg-white px-6 py-3 border-b shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold">{title}</h1>
          {projectName && (
            <span className="text-sm text-gray-500">{projectName}</span>
          )}
        </div>

        <ActionButtons
          onAutofillAll={onAutofillAll}
          onExport={onExport}
          onShare={onShare}
          onConfigure={onConfigure}
          primaryActionLabel={primaryActionLabel}
          disabled={disabled}
        />
      </div>
    </div>
  );
};
