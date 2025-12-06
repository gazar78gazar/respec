import type { Maybe } from "../types/UCDataTypes";

// TypeScript interfaces and types
export interface Requirements {
  [fieldName: string]: {
    value?: unknown;
    priority: 1 | 2 | 3 | 4;
    isAssumption?: boolean;
    required?: boolean;
  };
}

export interface MustFieldsStatus {
  total: number;
  completed: number;
  missing: string[];
}

export interface SectionProgress {
  percentage: number;
  completed: number;
  total: number;
}

export type AnimationType = "success" | "error" | "warning";
export type SectionKey =
  | "performanceComputing"
  | "IOConnectivity"
  | "powerEnvironment"
  | "commercial";

// Field mappings
const MUST_FIELDS = [
  "digitalIO",
  "analogIO",
  "networkPorts",
  "budgetPerUnit",
  "quantity",
];

const FIELD_SECTIONS: Record<string, SectionKey> = {
  // Performance & Computing
  cpuType: "performanceComputing",
  cpuCores: "performanceComputing",
  cpuSpeed: "performanceComputing",
  ramSize: "performanceComputing",
  storageType: "performanceComputing",
  storageСapacity: "performanceComputing",

  // I/O & Connectivity
  digitalIO: "IOConnectivity",
  analogIO: "IOConnectivity",
  networkPorts: "IOConnectivity",
  wirelessCapabilities: "IOConnectivity",
  serialPorts: "IOConnectivity",
  usbPorts: "IOConnectivity",

  // Power & Environment
  powerSupply: "powerEnvironment",
  powerConsumption: "powerEnvironment",
  operatingTemp: "powerEnvironment",
  enclosureType: "powerEnvironment",
  coolingRequirements: "powerEnvironment",

  // Commercial
  budgetPerUnit: "commercial",
  quantity: "commercial",
  timeline: "commercial",
  certifications: "commercial",
  support: "commercial",
};

const FIELD_PRIORITIES: Record<string, 1 | 2 | 3 | 4> = {
  // Priority 1 (Must-have)
  digitalIO: 1,
  analogIO: 1,
  networkPorts: 1,
  budgetPerUnit: 1,
  quantity: 1,

  // Priority 2 (High importance)
  cpuType: 2,
  ramSize: 2,
  storageType: 2,
  powerSupply: 2,
  operatingTemp: 2,

  // Priority 3 (Medium importance)
  cpuCores: 3,
  cpuSpeed: 3,
  storageСapacity: 3,
  powerConsumption: 3,
  enclosureType: 3,
  timeline: 3,

  // Priority 4 (Nice to have)
  wirelessCapabilities: 4,
  serialPorts: 4,
  usbPorts: 4,
  coolingRequirements: 4,
  certifications: 4,
  support: 4,
};

// 1. Weighted Completion Scoring
export function calculateCompletionScore(requirements: Requirements): number {
  let totalWeight = 0;
  let completedWeight = 0;

  Object.entries(requirements).forEach(([_, requirement]) => {
    const priority = requirement.priority;
    const weight = 5 - priority; // Priority 1 = weight 4, Priority 2 = weight 3, etc.

    totalWeight += weight;

    // Completion only cares if field has a value, not whether it's an assumption
    if (
      requirement.value !== undefined &&
      requirement.value !== null &&
      requirement.value !== ""
    ) {
      completedWeight += weight; // All completed fields contribute fully, regardless of assumption status
    }
  });

  return totalWeight > 0
    ? Math.round((completedWeight / totalWeight) * 100)
    : 0;
}

// 2. Animation Utilities
export function flashField(fieldId: string, type: AnimationType): void {
  const element = document.getElementById(fieldId);
  if (!element) return;

  const animationClass = `animate-${type}`;
  element.classList.add(animationClass);

  setTimeout(() => {
    element.classList.remove(animationClass);
  }, 2000);
}

// 3. Field Navigation Helpers
export function scrollToField(fieldId: string): void {
  const element = document.getElementById(fieldId);
  if (!element) return;

  element.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest",
  });
}

export function highlightField(fieldId: string, duration: number = 3000): void {
  const element = document.getElementById(fieldId);
  if (!element) return;

  element.classList.add("highlight-field");

  setTimeout(() => {
    element.classList.remove("highlight-field");
  }, duration);
}

export function focusField(fieldId: string): void {
  const element = document.getElementById(fieldId) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement;
  if (!element) return;

  element.focus();

  // Add visual feedback
  element.classList.add("focus-feedback");

  const removeFeedback = () => {
    element.classList.remove("focus-feedback");
    element.removeEventListener("blur", removeFeedback);
  };

  element.addEventListener("blur", removeFeedback);
}

// 4. Progress Calculations
export function getMustFieldsStatus(
  requirements: Requirements,
): MustFieldsStatus {
  const total = MUST_FIELDS.length;
  let completed = 0;
  const missing: string[] = [];

  MUST_FIELDS.forEach((fieldName) => {
    const requirement = requirements[fieldName];
    if (
      requirement?.value !== undefined &&
      requirement.value !== null &&
      requirement.value !== ""
    ) {
      completed++;
    } else {
      missing.push(fieldName);
    }
  });

  return { total, completed, missing };
}

export function getNextPriorityField(
  requirements: Requirements,
): Maybe<string> {
  const emptyFields = Object.entries(requirements)
    .filter(
      ([_, requirement]) =>
        requirement.value === undefined ||
        requirement.value === null ||
        requirement.value === "",
    )
    .map(([fieldName, requirement]) => ({
      fieldName,
      priority: requirement.priority,
    }))
    .sort((a, b) => a.priority - b.priority); // Sort by priority (1 = highest)

  return emptyFields.length > 0 ? emptyFields[0].fieldName : null;
}

export function getSectionProgress(
  sectionKey: SectionKey,
  requirements: Requirements,
): SectionProgress {
  const sectionFields = Object.entries(FIELD_SECTIONS)
    .filter(([_, section]) => section === sectionKey)
    .map(([fieldName, _]) => fieldName);

  const total = sectionFields.length;
  let completed = 0;

  sectionFields.forEach((fieldName) => {
    const requirement = requirements[fieldName];
    if (
      requirement?.value !== undefined &&
      requirement.value !== null &&
      requirement.value !== ""
    ) {
      completed++;
    }
  });

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { percentage, completed, total };
}

// 5. Field Helper Functions
export function findFieldSection(fieldName: string): Maybe<SectionKey> {
  return FIELD_SECTIONS[fieldName];
}

export function getFieldPriority(fieldName: string): Maybe<1 | 2 | 3 | 4> {
  return FIELD_PRIORITIES[fieldName];
}

export function isFieldRequired(fieldName: string): boolean {
  return MUST_FIELDS.includes(fieldName);
}
