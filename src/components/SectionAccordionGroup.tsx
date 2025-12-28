import React from "react";
import { ChevronDown, ChevronRight, Check } from "lucide-react";

export interface SectionAccordionGroupProps {
  label: string;
  isExpanded: boolean;
  completedCount: number;
  totalCount: number;
  onToggle: () => void;
  children?: React.ReactNode;
}

export const SectionAccordionGroup: React.FC<SectionAccordionGroupProps> = ({
  label,
  isExpanded,
  completedCount,
  totalCount,
  onToggle,
  children,
}) => {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
      >
        <div className="flex items-center">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 mr-2 text-gray-600" />
          ) : (
            <ChevronRight className="w-4 h-4 mr-2 text-gray-600" />
          )}
          <span className="font-medium text-gray-800">{label}</span>
          <span className="ml-3 text-sm text-gray-500">
            ({completedCount}/{totalCount} completed)
          </span>
        </div>

        {completedCount === totalCount && totalCount > 0 && (
          <Check className="w-5 h-5 text-green-500" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4 bg-white border-t">{children}</div>
      )}
    </div>
  );
};
