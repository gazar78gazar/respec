import React, { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, Check, Info } from "lucide-react";

export type FieldValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | undefined;

export type FieldDef = {
  type: "dropdown" | "multi-select" | "number" | "date" | "text";
  label: string;
  options?: string[];
  min?: number;
  max?: number;
  required?: boolean;
  placeholder?: string;
  calculated?: boolean;
};

export interface ValidationMsg {
  severity: "error" | "warning" | "info";
  message: string;
}

export interface FormFieldProps {
  fieldKey: string;
  fieldDef: FieldDef;
  data?: { value?: FieldValue; isAssumption?: boolean };
  section: string;
  required?: boolean;
  validation?: ValidationMsg | null;
  onChange: (value: FieldValue, isAssumption: boolean) => void;
}

export const FormField: React.FC<FormFieldProps> = ({
  fieldKey,
  fieldDef,
  data,
  section,
  required,
  validation,
  onChange,
}) => {
  const [localValue, setLocalValue] = useState<FieldValue>(data?.value ?? "");
  const [localAssumption, setLocalAssumption] = useState<boolean>(
    !!data?.isAssumption
  );

  useEffect(() => {
    setLocalValue(data?.value ?? "");
    setLocalAssumption(!!data?.isAssumption);
  }, [data?.value, data?.isAssumption]);

  const handleValueChange = (newValue: FieldValue) => {
    setLocalValue(newValue);
    onChange(newValue, localAssumption);
  };

  const toggleAssumption = () => {
    const next = !localAssumption;
    setLocalAssumption(next);
    onChange(localValue, next);
  };

  const baseInputClass = `
    flex-1 px-3 py-2 border rounded-lg text-sm transition-all duration-500
    ${
      localAssumption
        ? "border-amber-300 bg-amber-50"
        : !localValue || (Array.isArray(localValue) && localValue.length === 0)
        ? "border-gray-300 bg-yellow-50"
        : "border-gray-300 bg-white"
    }
    focus:outline-none focus:ring-2 focus:ring-blue-500
  `;

  const renderInput = () => {
    switch (fieldDef.type) {
      case "dropdown":
        return (
          <select
            id={`field-${fieldKey}`}
            value={(localValue as string | number | undefined) ?? ""}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              handleValueChange(e.target.value)
            }
            className={baseInputClass}
          >
            <option value="">Select {fieldDef.label}...</option>
            {fieldDef.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case "multi-select": {
        const selectedValues = Array.isArray(localValue)
          ? (localValue as string[])
          : [];
        return (
          <div className="flex-1">
            <div className={baseInputClass}>
              {selectedValues.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedValues.map((val) => (
                    <span
                      key={val}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                    >
                      {val}
                      <button
                        onClick={() =>
                          handleValueChange(
                            selectedValues.filter((v: string) => v !== val)
                          )
                        }
                        className="ml-1 text-blue-500 hover:text-blue-700"
                        aria-label={`Remove ${val}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400">Select options...</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {fieldDef.options?.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    if (selectedValues.includes(opt)) {
                      handleValueChange(
                        selectedValues.filter((v: string) => v !== opt)
                      );
                    } else {
                      handleValueChange([...selectedValues, opt]);
                    }
                  }}
                  className={`px-2 py-1 rounded text-xs ${
                    selectedValues.includes(opt)
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                  aria-pressed={selectedValues.includes(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        );
      }

      case "number": {
        const isReadOnly = fieldDef.calculated === true;
        return (
          <div className="flex-1 flex items-center space-x-2">
            {!isReadOnly && (
              <button
                onClick={() =>
                  handleValueChange(
                    Math.max(
                      (parseInt(String(localValue)) || 0) - 1,
                      fieldDef.min ?? 0
                    )
                  )
                }
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                aria-label="Decrement"
              >
                -
              </button>
            )}
            <input
              id={`field-${fieldKey}`}
              type="number"
              value={(localValue as string | number | undefined) ?? ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                !isReadOnly && handleValueChange(e.target.value)
              }
              min={fieldDef.min}
              max={fieldDef.max}
              readOnly={isReadOnly}
              disabled={isReadOnly}
              className={`${baseInputClass} ${
                isReadOnly
                  ? "border-gray-200 bg-gray-50 cursor-not-allowed"
                  : ""
              }`}
              placeholder={
                isReadOnly
                  ? "Auto-calculated"
                  : `${fieldDef.min ?? 0}-${fieldDef.max ?? 999}`
              }
            />
            {!isReadOnly && (
              <button
                onClick={() =>
                  handleValueChange(
                    Math.min(
                      (parseInt(String(localValue)) || 0) + 1,
                      fieldDef.max ?? 999
                    )
                  )
                }
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                aria-label="Increment"
              >
                +
              </button>
            )}
          </div>
        );
      }

      case "date":
        return (
          <input
            id={`field-${fieldKey}`}
            type="date"
            value={(localValue as string | undefined) ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleValueChange(e.target.value)
            }
            className={baseInputClass}
          />
        );

      default:
        return (
          <input
            id={`field-${fieldKey}`}
            type="text"
            value={(localValue as string | undefined) ?? ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleValueChange(e.target.value)
            }
            placeholder={fieldDef.placeholder || `Enter ${fieldDef.label}...`}
            className={baseInputClass}
          />
        );
    }
  };

  return (
    <div>
      <div className="flex items-center space-x-4">
        <label
          htmlFor={`field-${section}-${fieldKey}`}
          className="w-40 text-sm font-medium text-gray-700"
        >
          {fieldDef.label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>

        {renderInput()}

        <div className="flex items-center">
          <div
            onClick={toggleAssumption}
            className={`relative w-12 h-6 rounded-full cursor-pointer transition-all duration-300 ${
              localAssumption ? "bg-amber-200" : "bg-blue-200"
            }`}
            title={
              localAssumption
                ? "Click to mark as requirement"
                : "Click to mark as assumption"
            }
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
                localAssumption
                  ? "left-6 bg-amber-500 text-white"
                  : "left-0.5 bg-blue-500 text-white"
              }`}
            >
              {localAssumption ? (
                <AlertTriangle size={10} />
              ) : (
                <Check size={10} />
              )}
            </div>
          </div>
          <span className="text-sm text-gray-500 ml-2">
            {localAssumption ? "Assumption" : "Requirement"}
          </span>
        </div>
      </div>

      {validation && (
        <div
          className={`mt-2 ml-44 flex items-start text-xs ${
            validation.severity === "error"
              ? "text-red-600"
              : validation.severity === "warning"
              ? "text-amber-600"
              : "text-blue-600"
          }`}
        >
          {validation.severity === "error" && (
            <AlertCircle className="w-3 h-3 mr-1 mt-0.5" />
          )}
          {validation.severity === "warning" && (
            <AlertTriangle className="w-3 h-3 mr-1 mt-0.5" />
          )}
          {validation.severity === "info" && (
            <Info className="w-3 h-3 mr-1 mt-0.5" />
          )}
          <span>{validation.message}</span>
        </div>
      )}
    </div>
  );
};
