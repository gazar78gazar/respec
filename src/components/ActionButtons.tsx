import React from "react";
import { Download, Share, Wand2 } from "lucide-react";

export interface ActionButtonsProps {
  onAutofillAll?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  onConfigure?: () => void;
  primaryActionLabel?: string;
  disabled?: {
    share?: boolean;
    configure?: boolean;
  };
  className?: string;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onAutofillAll,
  onExport,
  onShare,
  onConfigure,
  primaryActionLabel = "Configure",
  disabled,
  className,
}) => {
  return (
    <div
      className={
        "flex items-center space-x-2" + (className ? ` ${className}` : "")
      }
    >
      <button
        onClick={onAutofillAll}
        disabled={!onAutofillAll}
        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:hover:bg-gray-200 disabled:opacity-60 rounded-lg text-sm font-medium flex items-center"
      >
        <Wand2 className="w-4 h-4 mr-2" />
        Autofill All
      </button>

      <button
        onClick={onShare}
        disabled={disabled?.share ?? true}
        className="p-2 bg-white border border-gray-300 rounded-md text-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
        title={disabled?.share ? undefined : "Share"}
      >
        <Share size={16} />
      </button>

      <button
        onClick={onExport}
        disabled={!onExport}
        className="p-2 bg-blue-500 hover:bg-blue-600 disabled:hover:bg-blue-500 disabled:opacity-60 text-white rounded-md flex items-center justify-center"
        title="Export"
      >
        <Download size={16} />
      </button>

      <button
        onClick={onConfigure}
        disabled={disabled?.configure ?? true}
        className="px-4 py-2 bg-purple-400/60 text-white rounded font-medium hover:bg-purple-400/80 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {primaryActionLabel}
      </button>
    </div>
  );
};
