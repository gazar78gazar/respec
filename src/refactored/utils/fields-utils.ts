import type { Requirements } from "../types/requirements.types";
import { formFieldsData, SECTION_MAPPING } from "../config/uiConfig";
import * as uiUtils from "../../utils/uiUtilities";

export const autoCalculateFields = (
  changedField: string,
  newValue: string | number,
  requirements: Requirements
): Record<string, string> => {
  const updates: Record<string, string> = {};

  if (changedField === "budgetPerUnit" || changedField === "quantity") {
    const commercial = (requirements as any).commercial || {};
    const unitBudget = parseFloat(
      (commercial.budgetPerUnit?.value || 0).toString().replace(/[$,]/g, "")
    );
    const quantity = parseInt(String(commercial.quantity?.value || 0));

    if (changedField === "budgetPerUnit") {
      const newUnitBudget = parseFloat(String(newValue).replace(/[$,]/g, ""));
      if (!isNaN(newUnitBudget) && quantity > 0) {
        updates["commercial.totalBudget"] = (newUnitBudget * quantity).toFixed(
          2
        );
      }
    } else if (changedField === "quantity") {
      const newQuantity = parseInt(String(newValue));
      if (!isNaN(unitBudget) && !isNaN(newQuantity) && unitBudget > 0) {
        updates["commercial.totalBudget"] = (unitBudget * newQuantity).toFixed(
          2
        );
      }
    }
  }

  return updates;
};

export const mapValueToFormField = (
  section: string,
  field: string,
  value: unknown
) => {
  console.log(`[DEBUG] Mapping value for ${section}.${field}:`, {
    inputValue: value,
    inputType: typeof value,
  });

  if (value === true || value === "true") {
    switch (field) {
      case "wirelessExtension":
        return "WiFi"; // Default WiFi option
      case "ethernetPorts":
      case "networkPorts":
        return "2"; // Default 2 ports
      default:
        return value;
    }
  }

  type Maybe<InternalType> = InternalType | null;

  if (typeof value === "string") {
    const lowerValue = value.toLowerCase();
    let validAnalogOptions: string[];
    let validDigitalOptions: string[];
    let analogMatch: Maybe<RegExpMatchArray>;
    let digitalMatch: Maybe<RegExpMatchArray>;

    switch (field) {
      case "wirelessExtension":
        if (lowerValue.includes("wifi") || lowerValue.includes("wi-fi")) {
          return "WiFi";
        }
        if (lowerValue.includes("lte")) return "LTE";
        if (lowerValue.includes("5g")) return "5G";
        if (lowerValue.includes("lora")) return "LoRa";
        if (lowerValue.includes("none") || lowerValue.includes("not required"))
          return "None";
        return "WiFi"; // Default fallback

      case "analogIO":
        validAnalogOptions = ["None", "2", "4", "8", "16", "32", "64"];
        if (validAnalogOptions.includes(value)) return value;
        analogMatch = value.match(/(\d+)/);
        if (analogMatch) {
          const num = analogMatch[1];
          if (validAnalogOptions.includes(num)) return num;
        }
        return "4"; // Default fallback

      case "digitalIO":
        validDigitalOptions = ["None", "2", "4", "8", "16", "32", "64"];
        if (validDigitalOptions.includes(value)) return value;
        digitalMatch = value.match(/(\d+)/);
        if (digitalMatch) {
          const num = digitalMatch[1];
          if (validDigitalOptions.includes(num)) return num;
        }
        return "8"; // Default fallback

      case "ethernetPorts":
      case "networkPorts":
        if (lowerValue.includes("2") || lowerValue.includes("two")) return "2";
        if (lowerValue.includes("4") || lowerValue.includes("four")) return "4";
        if (lowerValue.includes("8") || lowerValue.includes("eight"))
          return "8";
        return "2"; // Default fallback
    }
  }

  if (typeof value === "number") {
    switch (field) {
      case "analogIO":
      case "digitalIO":
        return value.toString(); // Convert to string for dropdown
      default:
        return value;
    }
  }

  console.log(
    `[DEBUG] No mapping found for ${section}.${field}, using original value:`,
    value
  );
  return value;
};

export const validateSystemFieldUpdate = (
  requirements: Requirements,
  fieldPermissions: Record<
    string,
    { allowSystemOverride: boolean; grantedAt: string; grantedBy: string }
  >,
  section: string,
  field: string,
  value: unknown,
  allowOverride: boolean = false
): boolean => {
  const FIELD_DEFS = formFieldsData.field_definitions as Record<
    string,
    Record<string, any>
  >;

  const currentField = (requirements as any)[section]?.[field];
  if (
    currentField?.source === "user" &&
    currentField?.value !== "" &&
    currentField?.value !== null
  ) {
    const permissionKey = `${section}.${field}`;
    const hasPermission = fieldPermissions[permissionKey]?.allowSystemOverride;

    if (!allowOverride || !hasPermission) {
      return false;
    }
  }

  const fieldExists = FIELD_DEFS?.[section]?.[field];
  if (!fieldExists) {
    return false;
  }

  const fieldDef = FIELD_DEFS[section][field];
  if (
    fieldDef.type === "dropdown" &&
    fieldDef.options &&
    !fieldDef.options.includes(value as any)
  ) {
    return false;
  }

  if (
    fieldDef.type === "number" &&
    value !== null &&
    value !== "" &&
    isNaN(Number(value))
  ) {
    return false;
  }

  return true;
};

export const getPriority = (fieldKey: string): number => {
  for (const [level, config] of Object.entries(
    (formFieldsData as any).priority_system.priority_levels
  )) {
    if ((config as any).fields.includes(fieldKey)) {
      return parseInt(level);
    }
  }
  return 4;
};

export const calculateCompletion = (requirements: Requirements): number => {
  const formatted: Record<string, any> = {};
  Object.entries(requirements).forEach(([_, fields]) => {
    Object.entries(fields as any).forEach(([fieldKey, fieldData]: any) => {
      formatted[fieldKey] = {
        value: fieldData.value,
        priority: fieldData.priority,
        isAssumption: fieldData.isAssumption,
      };
    });
  });
  return uiUtils.calculateCompletionScore(formatted);
};

export const calculateAccuracy = (requirements: Requirements): number => {
  const TOTAL_FIELDS = 37;
  const REQUIREMENT_WEIGHT = 100 / TOTAL_FIELDS;
  const ASSUMPTION_WEIGHT = 60 / TOTAL_FIELDS;

  let accuracyScore = 0;
  let fieldCount = 0;

  Object.values(requirements as any).forEach((section: any) => {
    Object.values(section).forEach((field: any) => {
      fieldCount++;
      if (field.isComplete) {
        if (!field.isAssumption) accuracyScore += REQUIREMENT_WEIGHT;
        else accuracyScore += ASSUMPTION_WEIGHT;
      }
    });
  });

  if (fieldCount !== TOTAL_FIELDS) {
    console.warn(
      `Field count mismatch: Expected ${TOTAL_FIELDS}, found ${fieldCount}`
    );
  }

  return Math.min(100, Math.round(accuracyScore * 10) / 10);
};

export const getMustFieldsStatus = (requirements: Requirements) => {
  const mustFields: string[] = (formFieldsData as any).priority_system
    .must_fields;
  let completed = 0;
  const missing: string[] = [];

  mustFields.forEach((fieldKey) => {
    let found = false;
    Object.values(requirements as any).forEach((section: any) => {
      if (section[fieldKey]?.isComplete) {
        found = true;
        completed++;
      }
    });
    if (!found) missing.push(fieldKey);
  });

  return { total: mustFields.length, completed, missing };
};

export const getFieldLabel = (fieldKey: string): string => {
  for (const [, fields] of Object.entries(
    (formFieldsData as any).field_definitions
  )) {
    const def: any = (fields as any)[fieldKey];
    if (def?.label) return def.label as string;
  }
  return fieldKey;
};

export const applyFieldUpdate = (
  prev: Requirements,
  section: string,
  field: string,
  value: unknown,
  isAssumption = false,
  source: string = "user"
): Requirements => {
  const updated: Requirements = {
    ...prev,
    [section]: {
      ...(prev as any)[section],
      [field]: {
        ...((prev as any)[section]?.[field] || {}),
        value,
        isComplete: value !== "" && value !== null,
        isAssumption,
        lastUpdated: new Date().toISOString(),
        source,
      },
    },
  } as Requirements;

  const autoUpdates = autoCalculateFields(field, value as any, updated);
  Object.entries(autoUpdates).forEach(([path, autoValue]) => {
    const [autoSection, autoField] = path.split(".");
    if (autoSection && autoField) {
      const sec = (updated as any)[autoSection] || {};
      (updated as any)[autoSection] = sec;
      sec[autoField] = {
        ...(sec[autoField] || {}),
        value: autoValue,
        isComplete: true,
        isAssumption: false,
        dataSource: "requirement",
        priority: sec[autoField]?.priority || 1,
        source: "system",
        lastUpdated: new Date().toISOString(),
        toggleHistory: sec[autoField]?.toggleHistory || [],
      };
    }
  });

  return updated;
};

export type FieldLocation = { section: string; tab: string; group?: string };

export const resolveFieldLocation = (
  fieldKey: string
): FieldLocation | null => {
  for (const [section, fields] of Object.entries(
    (formFieldsData as any).field_definitions
  )) {
    if ((fields as any)[fieldKey]) {
      const fieldDef: any = (fields as any)[fieldKey];
      let tab: string | undefined;
      for (const [tabName, sections] of Object.entries(
        SECTION_MAPPING as any
      )) {
        if ((sections as string[]).includes(section)) {
          tab = tabName;
          break;
        }
      }
      return { section, tab: tab || "", group: fieldDef.group };
    }
  }
  return null;
};

export const focusAndScrollField = (fieldKey: string): boolean => {
  const element = document.getElementById(`field-${fieldKey}`);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    (element as HTMLElement).focus();
    return true;
  }
  return false;
};

export const validateField = (fieldKey: string, value: any, fieldDef: any) => {
  const errors: Array<{ severity: "error" | "warning"; message: string }> = [];

  if (
    value === "Not Required" ||
    (Array.isArray(value) && value.includes("Not Required"))
  ) {
    return errors; // Valid, no errors
  }

  if (fieldDef.required && (!value || value === "")) {
    errors.push({
      severity: "error",
      message: `${fieldDef.label} is required`,
    });
    return errors;
  }

  let numValue: number;

  switch (fieldDef.type) {
    case "number":
      numValue = parseFloat(value);
      if (value && value !== "" && isNaN(numValue)) {
        errors.push({ severity: "error", message: "Must be a valid number" });
      } else if (value && value !== "") {
        if (fieldDef.min !== undefined && numValue < fieldDef.min) {
          errors.push({
            severity: "error",
            message: `Minimum value is ${fieldDef.min}`,
          });
        }
        if (fieldDef.max !== undefined && numValue > fieldDef.max) {
          errors.push({
            severity: "error",
            message: `Maximum value is ${fieldDef.max}`,
          });
        }
      }
      if (fieldKey === "budgetPerUnit" && value && value < 0) {
        errors.push({
          severity: "error",
          message: "Budget cannot be negative",
        });
      }
      break;

    case "text":
      break;

    case "date":
      if (value) {
        const selectedDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
          errors.push({ severity: "warning", message: "Date is in the past" });
        }
      }
      break;

    case "dropdown":
      if (
        value &&
        value !== "" &&
        fieldDef.options &&
        !fieldDef.options.includes(value)
      ) {
        errors.push({
          severity: "error",
          message: "Please select a valid option",
        });
      }
      break;

    case "multi-select":
      if (value && Array.isArray(value) && value.length > 0) {
        const invalidOptions = value.filter(
          (v: any) => v !== "Not Required" && !fieldDef.options.includes(v)
        );
        if (invalidOptions.length > 0) {
          errors.push({
            severity: "error",
            message: `Invalid options selected: ${invalidOptions.join(", ")}`,
          });
        }
      }
      break;
  }

  return errors;
};
