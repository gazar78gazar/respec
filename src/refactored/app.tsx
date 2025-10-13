import { useState, useEffect, useCallback, useRef } from "react";
import {
  SimplifiedRespecService,
  EnhancedFormUpdate,
  ChatResult,
  StructuredConflicts,
  AutofillResult,
} from "../services/respec/SimplifiedRespecService";
import * as uiUtils from "../utils/uiUtilities";
import { dataServices } from "../services/dataServices";
import "../styles/animations.css";

import EnhancedChatWindow from "./components/EnhancedChatWindow";
import { FieldConflict } from "../legacy_isolated/ConflictDetectionService";

import { ArtifactManager } from "../services/respec/artifacts/ArtifactManager";
import { CompatibilityLayer } from "../services/respec/artifacts/CompatibilityLayer";
import { uc1ValidationEngine } from "../services/respec/UC1ValidationEngine";

import { ucDataLayer } from "../services/data/UCDataLayer";

import type {
  Requirements,
  ChatMessage,
  MASCommunicationResult,
  UserRole,
} from "../types/requirements.types";
import type { FieldDef } from "./components/FormField";
import type { MASAction, PayloadMap } from "./types/mas";
import { StepProgressIndicator } from "./components/StepProgressIndicator";
import { TabsNav } from "./components/TabsNav";
import { ProgressSummary } from "./components/ProgressSummary";
import { HeaderBar } from "./components/HeaderBar";
import { RequirementsReview } from "./components/RequirementsReview";
import { formFieldsData, SECTION_MAPPING } from "../config/uiConfig";
import { ProcessingPopup } from "./components/ProcessingPopup";
import { ConflictPanelContainer } from "./components/ConflictPanelContainer";
import { RequirementsForm } from "./components/RequirementsForm";
import { ConflictToggleButton } from "./components/ConflictToggleButton";
import { RequirementsHeader } from "./components/RequirementsHeader";

type Error = {
  severity: "error" | "warning";
  message: string;
};

// Safe index helpers for dynamic section keys (string index access)
type FieldDefExt = FieldDef & { group?: string };
type FieldDefsMap = Record<string, Record<string, FieldDefExt>>;
type FieldGroupsMap = Record<
  string,
  Record<string, { label: string; fields: string[]; defaultOpen?: boolean }>
>;
const FIELD_DEFS = formFieldsData.field_definitions as unknown as FieldDefsMap;
const FIELD_GROUPS = formFieldsData.field_groups as unknown as FieldGroupsMap;

const validateField = (fieldKey: string, value: any, fieldDef: any) => {
  const errors: Error[] = [];

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
      if (fieldKey === "budget_per_unit" && value && value < 0) {
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
          (v) => v !== "Not Required" && !fieldDef.options.includes(v)
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

const autoCalculateFields = (
  changedField: string,
  newValue: string | number,
  requirements: Requirements
): Record<string, string> => {
  const updates: Record<string, string> = {};

  if (changedField === "budget_per_unit" || changedField === "quantity") {
    const commercial = requirements.commercial || {};
    const unitBudget = parseFloat(
      (commercial.budget_per_unit?.value || 0).toString().replace(/[$,]/g, "")
    );
    const quantity = parseInt(String(commercial.quantity?.value || 0));

    if (changedField === "budget_per_unit") {
      const newUnitBudget = parseFloat(String(newValue).replace(/[$,]/g, ""));
      if (!isNaN(newUnitBudget) && quantity > 0) {
        updates["commercial.total_budget"] = (newUnitBudget * quantity).toFixed(
          2
        );
      }
    } else if (changedField === "quantity") {
      const newQuantity = parseInt(String(newValue));
      if (!isNaN(unitBudget) && !isNaN(newQuantity) && unitBudget > 0) {
        updates["commercial.total_budget"] = (unitBudget * newQuantity).toFixed(
          2
        );
      }
    }
  }

  return updates;
};

export default function App() {
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [activeTab, setActiveTab] = useState("Compute Performance");
  const [requirements, setRequirements] = useState<Requirements>({});
  const [expandedGroups, setExpandedGroups] = useState({});

  const [artifactManager, setArtifactManager] =
    useState<ArtifactManager | null>(null);
  const [compatibilityLayer, setCompatibilityLayer] =
    useState<CompatibilityLayer | null>(null);
  const [projectName] = useState("Untitled Project");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "initial",
      role: "assistant",
      content: "How can I help you with filling out these requirements?",
      timestamp: new Date(),
    },
  ]);
  const chatEndRef = useRef(null);

  const [activeConflicts, setActiveConflicts] = useState<FieldConflict[]>([]);
  const [showConflicts, setShowConflicts] = useState(true);

  const [simplifiedRespecService] = useState(
    () => new SimplifiedRespecService()
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [chatWidth, setChatWidth] = useState(384); // Default 24rem = 384px
  const [isResizing, setIsResizing] = useState(false);

  const [fieldPermissions, setFieldPermissions] = useState<
    Record<
      string,
      {
        allowSystemOverride: boolean;
        grantedAt: string;
        grantedBy: string;
      }
    >
  >({});

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = window.innerWidth - e.clientX;
      const constrainedWidth = Math.min(600, Math.max(320, newWidth));
      setChatWidth(constrainedWidth);
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    } else {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const addTrace = useCallback(
    (
      action: string,
      details: unknown,
      status: "SUCCESS" | "FAILED" | "BLOCKED" | "WARNING"
    ) => {
      const entry = {
        timestamp: new Date().toISOString(),
        action,
        details,
        status,
        id: Date.now(),
      };

      console.log(
        `[TRACE] ${entry.timestamp} | ${action} | ${status}`,
        details
      );
    },
    []
  );

  const validateSystemFieldUpdate = useCallback(
    (
      section: string,
      field: string,
      value: unknown,
      allowOverride: boolean = false
    ): boolean => {
      try {
        const currentField = requirements[section]?.[field];
        if (
          currentField?.source === "user" &&
          currentField?.value !== "" &&
          currentField?.value !== null
        ) {
          const permissionKey = `${section}.${field}`;
          const hasPermission =
            fieldPermissions[permissionKey]?.allowSystemOverride;

          if (!allowOverride || !hasPermission) {
            console.error(
              `[BLOCKED] Cannot overwrite user field ${section}.${field} without permission`
            );
            addTrace(
              "field_update_blocked",
              { section, field, reason: "no_permission" },
              "BLOCKED"
            );
            return false;
          }

          console.warn(
            `[OVERRIDE] Overwriting user field ${section}.${field} with permission`
          );
          addTrace("field_override", { section, field, value }, "WARNING");
        }

        const fieldExists = FIELD_DEFS[section]?.[field];
        if (!fieldExists) {
          console.error(
            `[UI-MAS] Invalid field reference: ${section}.${field}`
          );
          addTrace(
            "field_validation_failed",
            { section, field, reason: "field_not_exists" },
            "FAILED"
          );
          return false;
        }

        const fieldDef = FIELD_DEFS[section][field];
        if (
          fieldDef.type === "dropdown" &&
          fieldDef.options &&
          !fieldDef.options.includes(value)
        ) {
          console.warn(
            `[UI-MAS] Invalid dropdown value for ${section}.${field}: ${value}`
          );
          return false;
        }

        if (
          fieldDef.type === "number" &&
          value !== null &&
          value !== "" &&
          isNaN(Number(value))
        ) {
          console.warn(
            `[UI-MAS] Invalid number value for ${section}.${field}: ${value}`
          );
          return false;
        }

        return true;
      } catch (error: unknown) {
        console.error(
          `[UI-MAS] Validation error for ${section}.${field}:`,
          error
        );
        return false;
      }
    },
    [requirements, addTrace, fieldPermissions]
  );

  const handleConflictResolve = async (
    conflictId: string,
    action: "accept" | "reject" | "modify",
    newValue?: string
  ): Promise<void> => {
    try {
      const resolution = await simplifiedRespecService.resolveConflict(
        conflictId,
        action,
        newValue
      );

      if (resolution.applied && action === "accept") {
        const conflict = activeConflicts.find((c) => c.id === conflictId);
        if (conflict) {
          updateField(
            conflict.section,
            conflict.field.split(".")[1],
            resolution.newValue || conflict.newValue,
            false
          );
        }
      }

      console.log(
        `[APP] Conflict ${conflictId} resolved with action: ${action}`
      );
    } catch (error) {
      console.error("[APP] Failed to resolve conflict:", error);
    }
  };

  const sendMessageWrapper = async (
    message: string
  ): Promise<MASCommunicationResult> => {
    if (isLoading) return { success: false, error: "loading" };

    setIsLoading(true);
    try {
      addChatMessage("user", message);

      const result = await communicateWithMAS("chat_message", { message });

      if (result.success && result.message)
        addChatMessage("assistant", result.message);

      return result;
    } catch (error: unknown) {
      console.error("[UI-ReSpec] Chat message failed:", error);

      addChatMessage(
        "assistant",
        "Sorry, I encountered an error processing your message. Please try again."
      );

      return { success: false, error: "Processing failed" };
    } finally {
      setIsLoading(false);
    }
  };

  const mapValueToFormField = (
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
        case "wireless_extension":
        case "wirelessExtension":
          return "WiFi"; // Default WiFi option
        case "ethernet_ports":
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
        case "wireless_extension":
        case "wirelessExtension":
          if (lowerValue.includes("wifi") || lowerValue.includes("wi-fi")) {
            return "WiFi";
          }
          if (lowerValue.includes("lte")) return "LTE";
          if (lowerValue.includes("5g")) return "5G";
          if (lowerValue.includes("lora")) return "LoRa";
          if (
            lowerValue.includes("none") ||
            lowerValue.includes("not required")
          )
            return "None";
          return "WiFi"; // Default fallback

        case "analog_io":
        case "analogIO":
          validAnalogOptions = ["None", "2", "4", "8", "16", "32", "64"];
          if (validAnalogOptions.includes(value)) return value;
          analogMatch = value.match(/(\d+)/);
          if (analogMatch) {
            const num = analogMatch[1];
            if (validAnalogOptions.includes(num)) return num;
          }
          return "4"; // Default fallback

        case "digital_io":
        case "digitalIO":
          validDigitalOptions = ["None", "2", "4", "8", "16", "32", "64"];
          if (validDigitalOptions.includes(value)) return value;
          digitalMatch = value.match(/(\d+)/);
          if (digitalMatch) {
            const num = digitalMatch[1];
            if (validDigitalOptions.includes(num)) return num;
          }
          return "8"; // Default fallback

        case "ethernet_ports":
        case "networkPorts":
          if (lowerValue.includes("2") || lowerValue.includes("two"))
            return "2";
          if (lowerValue.includes("4") || lowerValue.includes("four"))
            return "4";
          if (lowerValue.includes("8") || lowerValue.includes("eight"))
            return "8";
          return "2"; // Default fallback
      }
    }

    if (typeof value === "number") {
      switch (field) {
        case "analog_io":
        case "analogIO":
        case "digital_io":
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

  const addChatMessage = (
    role: UserRole,
    content: string,
    id?: string,
    metadata?: ChatMessage["metadata"]
  ) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: id ? id : `general-${Date.now()}`,
        role,
        content,
        timestamp: new Date(),
        metadata,
      },
    ]);
  };

  async function communicateWithMAS<A extends MASAction>(
    action: A,
    data: PayloadMap[A]
  ): Promise<MASCommunicationResult> {
    console.log(`[UI-RESPEC] ${action}:`, data);

    setIsProcessing(true);

    let chatResult: ChatResult;
    let conflictStatus: StructuredConflicts;
    let autofillResult: AutofillResult;

    const handleConflicts = () => {
      console.log(`[APP] 🚨 Conflicts detected - presenting to user`);

      const conflict = conflictStatus.conflicts[0];
      const binaryQuestion = `I detected a conflict: ${conflict.description}

Which would you prefer?
A) ${conflict.resolutionOptions[0].label}
   Outcome: ${conflict.resolutionOptions[0].outcome}

B) ${conflict.resolutionOptions[1].label}
   Outcome: ${conflict.resolutionOptions[1].outcome}

Please respond with A or B.`;

      addChatMessage(
        "assistant",
        binaryQuestion,
        `conflict-question-${Date.now()}`
      );

      return { success: true };
    };

    try {
      switch (action) {
        case "chat_message": {
          const d = data as PayloadMap["chat_message"];
          setProcessingMessage("Processing your message...");
          addTrace("chat_message", { message: d.message }, "SUCCESS");

          chatResult = await simplifiedRespecService.processChatMessage(
            d.message
          );

          conflictStatus = simplifiedRespecService.getActiveConflictsForAgent();

          if (conflictStatus.hasConflicts) return handleConflicts();

          addChatMessage("assistant", chatResult.systemMessage);

          if (chatResult.formUpdates && chatResult.formUpdates.length) {
            console.log(
              `[DEBUG] Chat message returned ${chatResult.formUpdates.length} form updates:`,
              chatResult.formUpdates
            );
            addTrace(
              "chat_form_updates",
              {
                count: chatResult.formUpdates.length,
                updates: chatResult.formUpdates,
              },
              "SUCCESS"
            );

            chatResult.formUpdates.forEach((update: EnhancedFormUpdate) => {
              console.log(`[DEBUG] Processing chat update:`, {
                section: update.section,
                field: update.field,
                value: update.value,
                isAssumption: update.isAssumption,
              });

              const mappedValue = mapValueToFormField(
                update.section,
                update.field,
                update.value
              );
              console.log(
                `[DEBUG] Value mapped from ${update.value} to ${mappedValue}`
              );

              setRequirements((prev) => {
                const newReqs = {
                  ...prev,
                  [update.section]: {
                    ...prev[update.section],
                    [update.field]: {
                      ...prev[update.section]?.[update.field],
                      value: mappedValue,
                      isComplete: true,
                      isAssumption: update.isAssumption || false,
                      dataSource:
                        update.isAssumption || false
                          ? "assumption"
                          : "requirement",
                      priority:
                        prev[update.section]?.[update.field]?.priority || 1,
                      source: "system",
                      lastUpdated: new Date().toISOString(),
                      toggleHistory:
                        prev[update.section]?.[update.field]?.toggleHistory ||
                        [],
                    },
                  },
                };

                console.log(`[DEBUG] Chat update applied to requirements:`, {
                  field: `${update.section}.${update.field}`,
                  oldValue: prev[update.section]?.[update.field],
                  newValue: newReqs[update.section][update.field],
                });

                return newReqs;
              });

              setTimeout(() => {
                setRequirements((currentReqs) => {
                  const actualValue =
                    currentReqs[update.section]?.[update.field]?.value;
                  const expectedValue = mappedValue;

                  if (actualValue !== expectedValue) {
                    console.error(
                      `[CHAT VALIDATION FAILED] Field ${update.section}.${update.field}: expected "${expectedValue}", got "${actualValue}"`
                    );
                    addTrace(
                      "chat_field_verification",
                      {
                        section: update.section,
                        field: update.field,
                        expected: expectedValue,
                        actual: actualValue,
                        source: "chat_message",
                      },
                      "FAILED"
                    );
                  } else {
                    console.log(
                      `[CHAT VALIDATION OK] Field ${update.section}.${update.field} = "${actualValue}"`
                    );
                    addTrace(
                      "chat_field_verification",
                      {
                        section: update.section,
                        field: update.field,
                        value: actualValue,
                        source: "chat_message",
                      },
                      "SUCCESS"
                    );
                  }

                  return currentReqs; // Return unchanged state
                });
              }, 150); // Slightly longer delay for chat updates

              if (update.substitutionNote) {
                const id = `sub-${Date.now()}-${Math.random()
                  .toString(36)
                  .substr(2, 9)}`;
                const metadata = {
                  isAssumption: false,
                  confidence: update.confidence || 0.9,
                };
                addChatMessage(
                  "system",
                  `📝 ${update.substitutionNote}`,
                  id,
                  metadata
                );
                console.log(
                  `[DEBUG] Added substitution note for ${update.section}.${update.field}:`,
                  update.substitutionNote
                );
                addTrace(
                  "substitution_note",
                  {
                    section: update.section,
                    field: update.field,
                    originalRequest: update.originalRequest,
                    substitutionNote: update.substitutionNote,
                  },
                  "SUCCESS"
                );
              }
            });
          }

          return { success: true };
        }

        case "form_update": {
          const d = data as PayloadMap["form_update"];
          if (d.source === "user") {
            setProcessingMessage("Noting selection...");
            addTrace(
              "form_update",
              { section: d.section, field: d.field, value: d.value },
              "SUCCESS"
            );
            const formResult = await simplifiedRespecService.processFormUpdate(
              d.section,
              d.field,
              d.value
            );

            if (formResult.acknowledgment) {
              addChatMessage("assistant", formResult.acknowledgment);
            }
          }
          return { success: true };
        }

        case "trigger_autofill": {
          const d = data as PayloadMap["trigger_autofill"];
          setProcessingMessage("Generating defaults...");
          addTrace("trigger_autofill", { trigger: d.trigger }, "SUCCESS");
          autofillResult = await simplifiedRespecService.triggerAutofill(
            d.trigger
          );
          addChatMessage("assistant", autofillResult.message);

          autofillResult.fields.forEach((field) => {
            const currentValue =
              requirements[field.section]?.[field.field]?.value;

            if (!currentValue || currentValue === "") {
              setRequirements((prev) => ({
                ...prev,
                [field.section]: {
                  ...prev[field.section],
                  [field.field]: {
                    ...prev[field.section]?.[field.field],
                    value: field.value,
                    isComplete: true,
                    isAssumption: true,
                    dataSource: "assumption",
                    priority: prev[field.section]?.[field.field]?.priority || 1,
                    source: "system",
                    lastUpdated: new Date().toISOString(),
                    toggleHistory:
                      prev[field.section]?.[field.field]?.toggleHistory || [],
                  },
                },
              }));
            }
          });

          return { success: true };
        }
        case "autofill": {
          const d = data as PayloadMap["autofill"];
          return await communicateWithMAS("trigger_autofill", {
            trigger: d.section,
          });
        }

        case "system_populate_field": {
          const d = data as PayloadMap["system_populate_field"];
          try {
            if (!validateSystemFieldUpdate(d.section, d.field, d.value)) {
              addTrace(
                "system_populate_field",
                {
                  section: d.section,
                  field: d.field,
                  value: d.value,
                  reason: "validation_failed",
                },
                "FAILED"
              );
              return { success: false, error: "Field validation failed" };
            }

            addTrace(
              "system_populate_field",
              { section: d.section, field: d.field, value: d.value },
              "SUCCESS"
            );
            console.log(`[DEBUG] system_populate_field called with:`, {
              section: d.section,
              field: d.field,
              value: d.value,
              isSystemGenerated: d.isSystemGenerated,
              rawData: d,
            });

            const mappedValue = mapValueToFormField(
              d.section,
              d.field,
              d.value
            );
            console.log(
              `[DEBUG] System populate value mapped from ${d.value} to ${mappedValue}`
            );

            setProcessingMessage("Updating field...");
            setRequirements((prev) => {
              const newValue = {
                ...prev,
                [d.section]: {
                  ...prev[d.section],
                  [d.field]: {
                    ...prev[d.section]?.[d.field],
                    value: mappedValue,
                    isComplete: true,
                    isAssumption: d.isSystemGenerated || false,
                    dataSource:
                      d.isSystemGenerated || false
                        ? "assumption"
                        : "requirement",
                    priority: prev[d.section]?.[d.field]?.priority || 1,
                    source: "system",
                    lastUpdated: new Date().toISOString(),
                    toggleHistory:
                      prev[d.section]?.[d.field]?.toggleHistory || [],
                  },
                },
              };

              console.log(
                `[DEBUG] Updated requirements for ${d.section}.${d.field}:`,
                {
                  oldValue: prev[d.section]?.[d.field],
                  newValue: newValue[d.section][d.field],
                  fullSection: newValue[d.section],
                }
              );

              return newValue;
            });

            setTimeout(() => {
              setRequirements((currentReqs) => {
                const actualValue = currentReqs[d.section]?.[d.field]?.value;
                const expectedValue = mappedValue;

                if (actualValue !== expectedValue) {
                  console.error(
                    `[VALIDATION FAILED] Field ${d.section}.${d.field}: expected "${expectedValue}", got "${actualValue}"`
                  );
                  addTrace(
                    "system_populate_field_verification",
                    {
                      section: d.section,
                      field: d.field,
                      expected: expectedValue,
                      actual: actualValue,
                    },
                    "FAILED"
                  );
                } else {
                  console.log(
                    `[VALIDATION OK] Field ${d.section}.${d.field} = "${actualValue}"`
                  );
                  addTrace(
                    "system_populate_field_verification",
                    {
                      section: d.section,
                      field: d.field,
                      value: actualValue,
                    },
                    "SUCCESS"
                  );
                }

                return currentReqs; // Return unchanged state
              });
            }, 100);

            return { success: true };
          } catch (error: unknown) {
            console.error(`[UI-RESPEC] System field update failed:`, error);
            addTrace(
              "system_populate_field",
              {
                section: d.section,
                field: d.field,
                error: (error as Error).message,
              },
              "FAILED"
            );
            return { success: false, error: String(error) };
          }
        }
        case "system_populate_multiple": {
          const d = data as PayloadMap["system_populate_multiple"];
          try {
            addTrace(
              "system_populate_multiple",
              { count: d.updates?.length || 0 },
              "SUCCESS"
            );
            setProcessingMessage("Updating multiple fields...");
            setRequirements((prev) => {
              const updated = { ...prev };
              d.updates.forEach((update) => {
                if (!updated[update.section]) updated[update.section] = {};
                updated[update.section][update.field] = {
                  ...updated[update.section]?.[update.field],
                  value: update.value,
                  isComplete: true,
                  isAssumption: update.isSystemGenerated || false,
                  dataSource:
                    update.isSystemGenerated || false
                      ? "assumption"
                      : "requirement",
                  priority:
                    updated[update.section]?.[update.field]?.priority || 1,
                  source: "system",
                  lastUpdated: new Date().toISOString(),
                  toggleHistory:
                    updated[update.section]?.[update.field]?.toggleHistory ||
                    [],
                };
              });
              return updated;
            });
            return { success: true };
          } catch (error: unknown) {
            console.error(`[UI-RESPEC] System multiple update failed:`, error);
            return { success: false, error: String(error) };
          }
        }

        case "system_send_message": {
          const d = data as PayloadMap["system_send_message"];
          try {
            addChatMessage("assistant", d.message);
            return { success: true };
          } catch (error: unknown) {
            console.error(`[UI-RESPEC] System message failed:`, error);
            return { success: false, error: String(error) };
          }
        }

        case "system_toggle_assumption": {
          const d = data as PayloadMap["system_toggle_assumption"];
          try {
            const { section, field, reason } = d;
            const currentField = requirements[section]?.[field];

            if (!currentField) {
              console.error(
                `[TOGGLE FAILED] Field not found: ${section}.${field}`
              );
              addTrace("toggle_assumption", { section, field }, "FAILED");
              return { success: false };
            }

            const previousState = currentField.isAssumption
              ? "assumption"
              : "requirement";
            const newState = !currentField.isAssumption
              ? "assumption"
              : "requirement";

            setRequirements((prev) => ({
              ...prev,
              [section]: {
                ...prev[section],
                [field]: {
                  ...prev[section][field],
                  isAssumption: !currentField.isAssumption,
                  dataSource: newState,
                  toggleHistory: [
                    ...(currentField.toggleHistory || []),
                    {
                      timestamp: new Date().toISOString(),
                      from: previousState,
                      to: newState,
                      triggeredBy: "system",
                      reason,
                    },
                  ],
                },
              },
            }));

            console.log(
              `[TOGGLE] ${section}.${field}: ${previousState} -> ${newState}`
            );
            addTrace(
              "toggle_assumption",
              { section, field, from: previousState, to: newState },
              "SUCCESS"
            );

            return { success: true, newState };
          } catch (error: unknown) {
            console.error(`[TOGGLE ERROR]`, error);
            addTrace(
              "toggle_assumption",
              { error: (error as Error).message },
              "FAILED"
            );
            return { success: false, error: String(error) };
          }
        }

        case "grant_override_permission": {
          const d = data as PayloadMap["grant_override_permission"];
          try {
            const permissionKey = `${d.section}.${d.field}`;

            setFieldPermissions((prev) => ({
              ...prev,
              [permissionKey]: {
                allowSystemOverride: true,
                grantedAt: new Date().toISOString(),
                grantedBy: d.grantedBy || "user_action",
              },
            }));

            console.log(`[PERMISSION GRANTED] ${permissionKey}`);
            addTrace(
              "permission_granted",
              { section: d.section, field: d.field },
              "SUCCESS"
            );

            return { success: true };
          } catch (error: unknown) {
            console.error(`[PERMISSION ERROR]`, error);
            addTrace(
              "permission_granted",
              { error: (error as Error).message },
              "FAILED"
            );
            return { success: false, error: String(error) };
          }
        }

        case "revoke_override_permission": {
          const d = data as PayloadMap["revoke_override_permission"];
          try {
            const revokeKey = `${d.section}.${d.field}`;

            setFieldPermissions((prev) => {
              const updated = { ...prev };
              delete updated[revokeKey];
              return updated;
            });

            console.log(`[PERMISSION REVOKED] ${revokeKey}`);
            addTrace(
              "permission_revoked",
              { section: d.section, field: d.field },
              "SUCCESS"
            );

            return { success: true };
          } catch (error: unknown) {
            console.error(`[PERMISSION ERROR]`, error);
            addTrace(
              "permission_revoked",
              { error: (error as Error).message },
              "FAILED"
            );
            return { success: false, error: String(error) };
          }
        }

        default:
          console.warn(`[UI-RESPEC] Unknown action: ${action}`);
          addTrace("unknown_action", { action }, "WARNING");
          return { success: false };
      }
    } catch (error: unknown) {
      console.error(`[UI-RESPEC] Error:`, error);
      return { success: false, error: String(error) };
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  }

  useEffect(() => {
    const initializeApp = async () => {
      const initialRequirements = {};
      const initialExpanded = {};

      Object.entries(formFieldsData.field_definitions).forEach(
        ([section, fields]) => {
          initialRequirements[section] = {};
          initialExpanded[section] = {};

          Object.entries(fields).forEach(([fieldKey, fieldDef]) => {
            initialRequirements[section][fieldKey] = {
              value: "",
              isComplete: false,
              isAssumption: false,
              dataSource: "requirement",
              priority: getPriority(fieldKey),
              source: "user",
              lastUpdated: new Date().toISOString(),
              toggleHistory: [],
            };
          });
        }
      );

      Object.entries(formFieldsData.field_definitions).forEach(
        ([section, fields]) => {
          if (FIELD_GROUPS[section]) {
            Object.entries(FIELD_GROUPS[section]).forEach(
              ([groupKey, groupDef]) => {
                initialExpanded[section][groupKey] =
                  groupDef.defaultOpen || false;
              }
            );
          }
        }
      );

      setRequirements(initialRequirements);
      setExpandedGroups(initialExpanded);

      try {
        console.log("[APP] Loading UC8 Data Layer...");
        await ucDataLayer.load();
        console.log("[APP] ✅ UC8 Data Layer loaded successfully");
        console.log("[APP] UC8 Version:", ucDataLayer.getVersion());
        console.log("[APP] UC8 Metadata:", ucDataLayer.getMetadata());
      } catch (uc8Error) {
        console.warn(
          "[APP] ⚠️ UC8 Data Layer failed to load (non-blocking):",
          uc8Error
        );
      }

      try {
        setProcessingMessage("Initializing...");
        setIsProcessing(true);
        await simplifiedRespecService.initialize(
          formFieldsData.field_definitions
        );
        const sessionId = simplifiedRespecService.getSessionId();
        console.log("[APP] Simplified Respec initialized:", sessionId);
      } catch (err) {
        console.error("[APP] Simplified Respec init failed:", err);
      } finally {
        setIsProcessing(false);
        setProcessingMessage("");
      }

      try {
        console.log("[APP] Initializing artifact state management...");

        await uc1ValidationEngine.loadSchema("/uc1.json");

        const manager = new ArtifactManager(uc1ValidationEngine);
        await manager.initialize();
        setArtifactManager(manager);

        const compatibility = new CompatibilityLayer(
          manager,
          uc1ValidationEngine
        );
        setCompatibilityLayer(compatibility);

        simplifiedRespecService.initializeSemanticMatching(
          uc1ValidationEngine,
          manager,
          compatibility
        );

        const unsubscribeConflicts = simplifiedRespecService.onConflictChange(
          (conflicts) => {
            setActiveConflicts(conflicts);
            const hasCriticalConflicts = conflicts.some(
              (c) => c.severity === "critical" || c.severity === "error"
            );
            if (hasCriticalConflicts) {
              setShowConflicts(true);
            }
          }
        );

        return unsubscribeConflicts;
      } catch (err) {
        console.error("[APP] Artifact state management init failed:", err);
      }
    };

    initializeApp();
  }, [simplifiedRespecService]);

  useEffect(() => {
    const syncInterval = setInterval(() => {
      console.log("[UI-ReSpec] Polling ready - waiting for ReSpec integration");
    }, 5000); // Reduced frequency until ReSpec is integrated

    return () => clearInterval(syncInterval);
  }, []);

  useEffect(() => {
    if (!compatibilityLayer || !artifactManager) return;

    const syncToArtifacts = async () => {
      try {
        const syncResult =
          compatibilityLayer.syncRequirementsToArtifact(requirements);

        if (syncResult.updated.length > 0) {
          console.log(
            `[APP] Synced ${syncResult.updated.length} fields to artifact state:`,
            syncResult.updated
          );

          artifactManager
            .detectConflicts()
            .then((conflictResult) => {
              if (conflictResult.hasConflict) {
                console.warn(
                  "[APP] CONFLICTS DETECTED:",
                  conflictResult.conflicts
                );
                conflictResult.conflicts.forEach((conflict) => {
                  console.warn(`🚨 Conflict: ${conflict.description}`);
                  console.warn(`   Resolution: ${conflict.resolution}`);
                });
              } else {
                console.log("[APP] No conflicts detected");
              }
            })
            .catch((error) => {
              console.error("[APP] Conflict detection failed:", error);
            });
        }

        if (syncResult.errors.length > 0) {
          console.warn("[APP] Artifact sync errors:", syncResult.errors);
        }
      } catch (error) {
        console.error("[APP] Artifact sync failed:", error);
      }
    };

    syncToArtifacts();
  }, [requirements, compatibilityLayer, artifactManager]);

  useEffect(() => {
    if (!artifactManager) return;

    artifactManager.on("form_updates_from_respec", (data) => {
      // TODO zeev seemes to be never used
      console.log(
        "[APP] 📝 Form updates from conflict resolution:",
        data.updates
      );

      data.updates.forEach(
        (update: {
          section: string;
          field: string;
          value: unknown;
          isSystemGenerated?: boolean;
        }) => {
          setRequirements((prev) => ({
            ...prev,
            [update.section]: {
              ...prev[update.section],
              [update.field]: {
                value: update.value,
                isComplete: true,
                source: "conflict_resolution",
                lastUpdated: new Date().toISOString(),
              },
            },
          }));
        }
      );

      const metadata = {
        isFormUpdate: true,
        updates: data.updates,
      };
      addChatMessage(
        "system",
        `Form updated: ${data.updates.length} field(s) changed`,
        `form-update-${Date.now()}`,
        metadata
      );
    });
  }, [artifactManager]);

  const toggleGroup = (section, group) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [group]: !prev[section]?.[group],
      },
    }));
  };

  const getPriority = (fieldKey: string) => {
    for (const [level, config] of Object.entries(
      formFieldsData.priority_system.priority_levels
    )) {
      if (config.fields.includes(fieldKey)) {
        return parseInt(level);
      }
    }
    return 4;
  };

  const updateField = useCallback(
    (
      section: string,
      field: string,
      value: unknown,
      isAssumption = false,
      source = "user"
    ) => {
      setRequirements((prev) => {
        const updated = {
          ...prev,
          [section]: {
            ...prev[section],
            [field]: {
              ...prev[section][field],
              value,
              isComplete: value !== "" && value !== null,
              isAssumption,
              lastUpdated: new Date().toISOString(),
              source, // Use the provided source parameter
            },
          },
        };

        const autoUpdates = autoCalculateFields(field, value, updated);
        Object.entries(autoUpdates).forEach(([path, autoValue]) => {
          const [autoSection, autoField] = path.split(".");
          if (autoSection && autoField) {
            updated[autoSection][autoField] = {
              ...updated[autoSection][autoField],
              value: autoValue,
              isComplete: true,
              isAssumption: false,
              dataSource: "requirement",
              priority: updated[autoSection][autoField]?.priority || 1,
              source: "system",
              lastUpdated: new Date().toISOString(),
              toggleHistory:
                updated[autoSection][autoField]?.toggleHistory || [],
            };
          }
        });

        return updated;
      });

      const fieldDef = FIELD_DEFS[section]?.[field];
      if (fieldDef) {
        const errors = validateField(field, value, fieldDef);
        if (errors.length > 0) {
          uiUtils.flashField(`field-${field}`, "error");
        } else {
          if (value && value !== "") {
            uiUtils.flashField(`field-${field}`, "success");
          }
        }
      }

      if (
        fieldDef?.group &&
        formFieldsData.priority_system.must_fields.includes(field)
      ) {
        setExpandedGroups((prev) => ({
          ...prev,
          [section]: {
            ...prev[section],
            [fieldDef.group]: true,
          },
        }));
      }

      if (source !== "system") {
        simplifiedRespecService
          .detectFieldConflicts(
            `${section}.${field}`,
            value,
            requirements,
            source === "user" ? "manual" : "semantic"
          )
          .catch((error) => {
            console.warn("[APP] Conflict detection failed:", error);
          });
      }

      communicateWithMAS("form_update", {
        field: `${section}.${field}`,
        value,
        isAssumption,
      });
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      const formattedRequirements = {};
      Object.entries(requirements).forEach(([section, fields]) => {
        Object.entries(fields).forEach(([fieldKey, fieldData]) => {
          if (fieldData.value && fieldData.value !== "") {
            formattedRequirements[fieldKey] = {
              value: fieldData.value,
              priority: fieldData.priority,
              isAssumption: fieldData.isAssumption,
              required:
                formFieldsData.priority_system.must_fields.includes(fieldKey),
            };
          }
        });
      });
      if (Object.keys(formattedRequirements).length > 0) {
        dataServices.project.autoSave(formattedRequirements, projectName);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [requirements, projectName]);

  const calculateCompletion = () => {
    const formattedRequirements = {};
    Object.entries(requirements).forEach(([section, fields]) => {
      Object.entries(fields).forEach(([fieldKey, fieldData]) => {
        formattedRequirements[fieldKey] = {
          value: fieldData.value,
          priority: fieldData.priority,
          isAssumption: fieldData.isAssumption,
        };
      });
    });
    return uiUtils.calculateCompletionScore(formattedRequirements);
  };

  const calculateAccuracy = () => {
    const TOTAL_FIELDS = 37; // Total number of fields in the system
    const REQUIREMENT_WEIGHT = 100 / TOTAL_FIELDS; // ~2.7% per field
    const ASSUMPTION_WEIGHT = 60 / TOTAL_FIELDS; // ~1.62% per field

    let accuracyScore = 0;
    let fieldCount = 0;

    Object.values(requirements).forEach((section) => {
      Object.values(section).forEach((field) => {
        fieldCount++;

        if (field.isComplete) {
          if (!field.isAssumption) {
            accuracyScore += REQUIREMENT_WEIGHT;
          } else {
            accuracyScore += ASSUMPTION_WEIGHT;
          }
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

  const getMustFieldsStatus = () => {
    const mustFields = formFieldsData.priority_system.must_fields;
    let completed = 0;
    const missing: string[] = [];

    mustFields.forEach((fieldKey) => {
      let found = false;
      Object.values(requirements).forEach((section) => {
        if (section[fieldKey]?.isComplete) {
          found = true;
          completed++;
        }
      });
      if (!found) missing.push(fieldKey);
    });

    return { total: mustFields.length, completed, missing };
  };

  const scrollToField = (fieldKey: string) => {
    for (const [section, fields] of Object.entries(FIELD_DEFS)) {
      if (fields[fieldKey]) {
        const fieldDef = fields[fieldKey];
        // Expand the group containing this field
        if (fieldDef.group) {
          setExpandedGroups((prev) => ({
            ...prev,
            [section]: {
              ...prev[section],
              [fieldDef.group]: true,
            },
          }));
        }
        // Find the right tab and activate it
        for (const [tab, sections] of Object.entries(SECTION_MAPPING)) {
          if (sections.includes(section)) {
            setActiveTab(tab);
            break;
          }
        }
        // Scroll to field after state updates
        setTimeout(() => {
          const element = document.getElementById(`field-${fieldKey}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.focus();
          } else {
            console.error(`ui element ${fieldKey} not found!`);
          }
        }, 100);
        break;
      }
    }
  };

  const autofillAll = async () => {
    await communicateWithMAS("trigger_autofill", {
      trigger: "button_header",
    });
  };

  const autofillSection = (tabName: string) => {
    communicateWithMAS("autofill", { section: tabName });

    const sections = SECTION_MAPPING[tabName];
    const updatedRequirements = { ...requirements };

    sections.forEach((section) => {
      Object.entries(FIELD_DEFS[section] || {}).forEach(
        ([fieldKey, fieldDef]) => {
          if (
            !updatedRequirements[section][fieldKey].isComplete &&
            fieldDef.autofill_default
          ) {
            updatedRequirements[section][fieldKey] = {
              ...updatedRequirements[section][fieldKey],
              value: fieldDef.autofill_default,
              isComplete: true,
              isAssumption: true,
              dataSource: "assumption",
              priority: updatedRequirements[section][fieldKey]?.priority || 1,
              source: "system",
              lastUpdated: new Date().toISOString(),
              toggleHistory:
                updatedRequirements[section][fieldKey]?.toggleHistory || [],
            };
          }
        }
      );
    });

    setRequirements(updatedRequirements);
  };

  const handleExport = useCallback(async () => {
    try {
      const formattedRequirements = {};
      Object.entries(requirements).forEach(([section, fields]) => {
        Object.entries(fields).forEach(([fieldKey, fieldData]) => {
          formattedRequirements[fieldKey] = {
            value: fieldData.value,
            priority: fieldData.priority,
            isAssumption: fieldData.isAssumption,
            required:
              formFieldsData.priority_system.must_fields.includes(fieldKey),
          };
        });
      });

      const metadata = {
        name: projectName,
        created: new Date(),
        lastModified: new Date(),
        description: "Industrial requirements project",
      };

      const blob = await dataServices.export.exportToPDF(
        formattedRequirements,
        metadata
      );
      dataServices.utils.downloadBlob(
        blob,
        dataServices.utils.generateFilename(
          projectName.replace(/\s+/g, "_"),
          "pdf"
        )
      );
    } catch (error: unknown) {
      console.error("Export failed:", error);
      alert("Export failed: " + error.message);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "s":
            e.preventDefault();
            (async () => {
              try {
                const formattedRequirements = {};
                Object.entries(requirements).forEach(([section, fields]) => {
                  Object.entries(fields).forEach(([fieldKey, fieldData]) => {
                    if (fieldData.value && fieldData.value !== "") {
                      formattedRequirements[fieldKey] = {
                        value: fieldData.value,
                        priority: fieldData.priority,
                        isAssumption: fieldData.isAssumption,
                        required:
                          formFieldsData.priority_system.must_fields.includes(
                            fieldKey
                          ),
                      };
                    }
                  });
                });
                const metadata = {
                  name: projectName,
                  created: new Date(),
                  lastModified: new Date(),
                  description: "Industrial requirements project",
                };
                await dataServices.project.saveProject(
                  projectName,
                  formattedRequirements,
                  metadata
                );
                uiUtils.flashField("project-header", "success");
              } catch (error: unknown) {
                console.error("Save failed:", error);
              }
            })();
            break;
          case "e":
            if (!e.shiftKey) {
              e.preventDefault();
              handleExport();
            }
            break;
          case "S":
            if (e.shiftKey) {
              e.preventDefault();
              alert("Share functionality: Ctrl+Shift+S pressed");
            }
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [requirements, projectName, handleExport]);

  const mustFieldsStatus = getMustFieldsStatus();

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="flex-1 flex flex-col">
        <HeaderBar
          ids={{ rootId: "project-header" }}
          title="Requirements"
          projectName={projectName}
          onAutofillAll={autofillAll}
          onExport={handleExport}
          disabled={{ share: true, configure: true }}
        />

        <ProgressSummary
          className="bg-white px-6 py-4 border-b"
          completion={calculateCompletion()}
          accuracy={calculateAccuracy()}
          missingFields={mustFieldsStatus.missing}
          getFieldLabel={(fieldKey) => {
            for (const [, fields] of Object.entries(
              formFieldsData.field_definitions
            )) {
              const def: any = (fields as any)[fieldKey];
              if (def?.label) return def.label as string;
            }
            return fieldKey;
          }}
          onClickField={(fieldKey) => scrollToField(fieldKey)}
        />

        <TabsNav
          className="bg-white px-6 py-3 border-b"
          tabs={Object.keys(SECTION_MAPPING)}
          active={activeTab}
          onChange={setActiveTab}
        />

        <div className="flex-1 overflow-auto p-6">
          {currentStage === 1 && (
            <div className="bg-white rounded-lg shadow-sm">
              <RequirementsHeader
                activeTabTitle={activeTab}
                onAutoFillClick={() => autofillSection(activeTab)}
              />
              <RequirementsForm
                sections={(SECTION_MAPPING as any)[activeTab] || []}
                requirements={requirements}
                fieldDefs={FIELD_DEFS}
                groups={FIELD_GROUPS}
                expandedGroups={expandedGroups}
                onToggleGroup={toggleGroup}
                onChangeField={updateField}
                isRequired={(fieldKey: string) =>
                  formFieldsData.priority_system.must_fields.includes(fieldKey)
                }
              />
            </div>
          )}
          {currentStage === 2 && (
            <RequirementsReview
              requirements={requirements}
              getFieldLabel={(section: string, fieldKey: string) =>
                FIELD_DEFS[section]?.[fieldKey]?.label ?? fieldKey
              }
            />
          )}
        </div>

        <div className="h-20"></div>
      </div>

      <EnhancedChatWindow
        onSendMessage={sendMessageWrapper}
        messages={chatMessages}
        pendingClarification={null} // TODO zeev seems to be not used
        isLoading={isLoading}
        width={chatWidth}
        onMouseDown={handleMouseDown}
        isResizing={isResizing}
        onConflictResolve={handleConflictResolve}
      />

      {activeConflicts.length > 0 && showConflicts && (
        <ConflictPanelContainer
          visible={showConflicts}
          conflicts={activeConflicts}
          onResolve={handleConflictResolve}
          onDismiss={(conflictId) =>
            setActiveConflicts((prev) =>
              prev.filter((c) => c.id !== conflictId)
            )
          }
        />
      )}

      <ConflictToggleButton
        count={activeConflicts.length}
        onToggle={() => setShowConflicts(!showConflicts)}
        hasCritical={activeConflicts.some(
          (c) => c.severity === "critical" || c.severity === "error"
        )}
      />

      <StepProgressIndicator
        currentStep={currentStage}
        setCurrentStage={setCurrentStage}
        chatWindowWidth={chatWidth}
      />

      <ProcessingPopup visible={isProcessing} message={processingMessage} />
    </div>
  );
}
