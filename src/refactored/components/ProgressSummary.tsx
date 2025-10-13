import React from "react";

export interface ProgressSummaryProps {
  completion: number; // 0-100
  accuracy: number; // 0-100
  missingFields: string[];
  getFieldLabel: (fieldKey: string) => string;
  onClickField: (fieldKey: string) => void;
  className?: string;
}

export const ProgressSummary: React.FC<ProgressSummaryProps> = ({
  completion,
  accuracy,
  missingFields,
  getFieldLabel,
  onClickField,
  className,
}) => {
  return (
    <div className={className ?? ""}>
      <div className="flex gap-6">
        <div className="w-1/4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-gray-600">Completion</span>
            <span className="text-sm font-medium">{completion}%</span>
          </div>
          <div className="w-48 bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, completion))}%` }}
            />
          </div>
        </div>

        <div className="w-1/4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-gray-600">Accuracy</span>
            <span className="text-sm font-medium">{accuracy}%</span>
          </div>
          <div className="w-48 bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, accuracy))}%` }}
            />
          </div>
        </div>

        <div className="w-1/2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-gray-600">
              Key Requirements Left:
            </span>
            <span className="text-sm font-medium">{missingFields.length}</span>
          </div>
          <div className="mt-2">
            <div className="flex flex-wrap gap-2">
              {missingFields.map((field) => (
                <button
                  key={field}
                  onClick={() => onClickField(field)}
                  className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 transition-colors"
                >
                  {getFieldLabel(field)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
