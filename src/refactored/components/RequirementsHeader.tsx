import { AlertTriangle, Check, Wand2 } from "lucide-react";
import React from "react";

export interface RequirementsHeaderProps {
  activeTabTitle: string;
  onAutoFillClick: () => void;
}

export const RequirementsHeader: React.FC<
  RequirementsHeaderProps
> = ({ activeTabTitle, onAutoFillClick }) => {
  return (
    <div className="px-6 py-4 border-b flex items-center justify-between">
      <h3 className="text-lg font-medium text-gray-800">
        {activeTabTitle} Specifications
      </h3>
      <div className="flex items-center space-x-4">
        <button
          onClick={onAutoFillClick}
          className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium flex items-center"
        >
          <Wand2 className="w-4 h-4 mr-1" />
          Autofill
        </button>

        <div className="flex items-center space-x-6 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center">
              <Check size={10} className="text-blue-700" />
            </div>
            <span>Requirement</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center">
              <AlertTriangle size={10} className="text-amber-700" />
            </div>
            <span>Assumption</span>
          </div>
        </div>
      </div>
    </div>
  );
};
