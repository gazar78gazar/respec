import React from "react";
import type { Requirements } from "../types/requirements.types";

export interface RequirementsReviewProps {
  requirements: Requirements;
  getFieldLabel: (section: string, fieldKey: string) => string;
  title?: string;
}

export const RequirementsReview: React.FC<RequirementsReviewProps> = ({
  requirements,
  getFieldLabel,
  title = "Requirements Review",
}) => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
      {Object.entries(requirements).map(([section, fields]) => {
        const filledFields = Object.entries(fields || {}).filter(
          ([, data]: any) => data?.isComplete
        );
        if (filledFields.length === 0) return null;

        const sectionLabel = section
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

        return (
          <div key={section} className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-medium text-gray-700 mb-4">{sectionLabel}</h3>
            <div className="space-y-2">
              {filledFields.map(([fieldKey, fieldData]: any) => (
                <div
                  key={fieldKey}
                  className="flex justify-between py-2 border-b"
                >
                  <span className="text-gray-600">
                    {getFieldLabel(section, fieldKey)}:
                  </span>
                  <span className="font-medium">
                    {Array.isArray(fieldData.value)
                      ? fieldData.value.join(", ")
                      : fieldData.value}
                    {fieldData.isAssumption && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                        Assumption
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
