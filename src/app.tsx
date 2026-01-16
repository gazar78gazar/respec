import { useState, useEffect, useCallback, useRef } from "react";

import { RespecService } from "./services/RespecService";
import type {
  AutofillResult,
  ChatResult,
  EnhancedFormUpdate,
  // StructuredConflicts,
} from "./types/service.types";
import { DataServices } from "./services/dataServices";
import { ArtifactManager } from "./services/ArtifactManager";
import { ucDataLayer } from "./services/DataLayer";

import * as uiUtils from "./utils/ui-utils";
import "./styles/animations.css"; // TODO zeev - to move

import type {
  Requirements,
  ChatMessage,
  MASCommunicationResult,
  UserRole,
} from "./types/form-state.types";
import EnhancedChatWindow from "./components/EnhancedChatWindow";
import type { FieldDef, FieldValue } from "./components/FormField";
import type { MASAction, PayloadMap } from "./types/mas.types";
import { StepProgressIndicator } from "./components/StepProgressIndicator";
import { TabsNav } from "./components/TabsNav";
import { ProgressSummary } from "./components/ProgressSummary";
import { HeaderBar } from "./components/HeaderBar";
import { RequirementsReview } from "./components/RequirementsReview";
import { formFieldsData, SECTION_MAPPING } from "./config/uiConfig";
import { ProcessingPopup } from "./components/ProcessingPopup";
import { RequirementsForm } from "./components/RequirementsForm";
import { RequirementsHeader } from "./components/RequirementsHeader";
import {
  mapValueToFormField,
  validateField,
  validateSystemFieldUpdate,
  getPriority,
  calculateCompletion,
  calculateAccuracy,
  getMustFieldsStatus,
  getFieldLabel,
  applyFieldUpdate,
  resolveFieldLocation,
  focusAndScrollField,
} from "./utils/fields-utils";

// Safe index helpers for dynamic section keys (string index access)
type FieldDefExt = FieldDef & { group?: string; autofill_default?: FieldValue };
type FieldDefsMap = Record<string, Record<string, FieldDefExt>>;
type FieldGroupsMap = Record<
  string,
  Record<string, { label: string; fields: string[]; defaultOpen?: boolean }>
>;
type ExportRequirements = Record<
  string,
  {
    value?: unknown;
    priority: 1 | 2 | 3 | 4;
    isAssumption?: boolean;
    required?: boolean;
  }
>;
const FIELD_DEFS = formFieldsData.field_definitions as unknown as FieldDefsMap;
const FIELD_GROUPS = formFieldsData.field_groups as unknown as FieldGroupsMap;

export default function App() {
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [activeTab, setActiveTab] = useState("Compute Performance");
  const [requirements, setRequirements] = useState<Requirements>({});
  const [expandedGroups, setExpandedGroups] = useState<
    Record<string, Record<string, boolean>>
  >({});

  const [projectName] = useState("Untitled Project");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "initial",
      role: "assistant",
      content: "How can I help you with filling out these requirements?",
      timestamp: new Date(),
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  // const lastConflictSignatureRef = useRef<string | null>(null);

  const [switchedToAutofill, setSwitchToAutoFill] = useState(false);

  const [respecService] = useState(() => new RespecService());
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
    [isResizing],
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
      status: "SUCCESS" | "FAILED" | "BLOCKED" | "WARNING",
    ) => {
      const entry = {
        timestamp: new Date().toISOString(),
        action,
        details,
        status,
        id: Date.now(),
      };

      console.log(
        `!!! [TRACE] ${entry.timestamp} | ${action} | ${status}`,
        details,
      );
    },
    [],
  );

  const sendMessageWrapper = async (
    message: string,
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
        "Sorry, I encountered an error processing your message. Please try again.",
      );

      return { success: false, error: "Processing failed" };
    } finally {
      setIsLoading(false);
    }
  };

  const addChatMessage = useCallback(
    (
      role: UserRole,
      content: string,
      id?: string,
      metadata?: ChatMessage["metadata"],
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
    },
    [],
  );

  const applyArtifactUpdates = useCallback(
    (
      updates: EnhancedFormUpdate[],
      traceAction: string,
      verificationAction: string,
    ) => {
      if (!updates.length) return;

      console.log(
        `!!! [DEBUG] ${traceAction} returned ${updates.length} form updates:`,
        updates,
      );
      addTrace(traceAction, { count: updates.length, updates }, "SUCCESS");

      updates.forEach((update) => {
        const mappedValue = mapValueToFormField(
          update.section,
          update.field,
          update.value,
        );

        setRequirements((prev) => {
          const prevSection = prev[update.section] || {};
          const prevField = prevSection[update.field] || {};

          return {
            ...prev,
            [update.section]: {
              ...prevSection,
              [update.field]: {
                ...prevField,
                value: mappedValue as FieldValue,
                isComplete:
                  mappedValue !== "" &&
                  mappedValue !== null &&
                  mappedValue !== undefined,
                isAssumption: update.isAssumption || false,
                dataSource:
                  update.isAssumption || false ? "assumption" : "requirement",
                priority: prevField.priority || 1,
                source: "system",
                lastUpdated: new Date().toISOString(),
                toggleHistory: prevField.toggleHistory || [],
              },
            },
          };
        });

        setTimeout(() => {
          setRequirements((currentReqs) => {
            const actualValue =
              currentReqs[update.section]?.[update.field]?.value;
            const expectedValue = mappedValue;

            if (actualValue !== expectedValue) {
              console.error(
                `[VALIDATION FAILED] Field ${update.section}.${update.field}: expected "${expectedValue}", got "${actualValue}"`,
              );
              addTrace(
                verificationAction,
                {
                  section: update.section,
                  field: update.field,
                  expected: expectedValue,
                  actual: actualValue,
                  source: "system",
                },
                "FAILED",
              );
            } else {
              console.log(
                `!!! [VALIDATION OK] Field ${update.section}.${update.field} = "${actualValue}"`,
              );
              addTrace(
                verificationAction,
                {
                  section: update.section,
                  field: update.field,
                  value: actualValue,
                  source: "system",
                },
                "SUCCESS",
              );
            }

            return currentReqs;
          });
        }, 150);

        const substitutionNote = update.substitutionNote?.trim();
        if (
          substitutionNote &&
          substitutionNote !== "Cleared because no specification is selected"
        ) {
          const id = `sub-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          const metadata = {
            isAssumption: false,
            confidence: update.confidence || 0.9,
          };
          addChatMessage("system", `📝 ${substitutionNote}`, id, metadata);
          console.log(
            `!!! [DEBUG] Added substitution note for ${update.section}.${update.field}:`,
            substitutionNote,
          );
          addTrace(
            "substitution_note",
            {
              section: update.section,
              field: update.field,
              originalRequest: update.originalRequest,
              substitutionNote,
            },
            "SUCCESS",
          );
        }
      });
    },
    [addChatMessage, addTrace],
  );
  // const presentConflictQuestion = useCallback(
  //   async (
  //     conflictStatus: StructuredConflicts,
  //   ): Promise<MASCommunicationResult> => {
  //     console.log(`!!! [APP] ?? Conflicts detected - presenting to user`);

  //     const conflictSignature = conflictStatus.conflicts
  //       .map((conflict) => conflict.id)
  //       .sort()
  //       .join("|");
  //     if (conflictSignature) {
  //       lastConflictSignatureRef.current = conflictSignature;
  //     }

  //     const binaryQuestion =
  //       await respecService.generateConflictQuestion(conflictStatus);

  //     addChatMessage(
  //       "assistant",
  //       binaryQuestion,
  //       `conflict-question-${Date.now()}`,
  //     );

  //     return { success: true };
  //   },
  //   [addChatMessage, respecService],
  // );

  const communicateWithMAS = useCallback(
    async <A extends MASAction>(
      action: A,
      data: PayloadMap[A],
    ): Promise<MASCommunicationResult> => {
      console.log(`!!! [UI-RESPEC] ${action}:`, { data, switchedToAutofill });

      setIsProcessing(true);

      let chatResult: ChatResult;
      // let conflictStatus: StructuredConflicts;
      let autofillResult: AutofillResult;
      // const handleConflicts = async () =>
      //   await presentConflictQuestion(conflictStatus);

      let actionToComplete: string = action;
      let message: string = "";
      if (action === "chat_message" && switchedToAutofill) {
        console.log("[UI-RESPEC] switched to autoifill intercepted");
        actionToComplete = "trigger_autofill";
        const d = data as PayloadMap["chat_message"];
        message = d.message;
      }

      try {
        switch (actionToComplete) {
          case "chat_message": {
            const d = data as PayloadMap["chat_message"];
            setProcessingMessage("Processing your message...");
            addTrace("chat_message", { message: d.message }, "SUCCESS");

            chatResult = await respecService.processChatMessage(d.message);

            if (chatResult.systemMessage) {
              addChatMessage("assistant", chatResult.systemMessage);
            }

            if (chatResult.formUpdates && chatResult.formUpdates.length) {
              applyArtifactUpdates(
                chatResult.formUpdates,
                "chat_form_updates",
                "chat_field_verification",
              );
            }

            // conflictStatus = respecService.getActiveConflictsForAgent();

            // if (conflictStatus.hasConflicts) {
            //   await handleConflicts();
            // }

            return { success: true };
          }
          case "form_update": {
            const d = data as PayloadMap["form_update"];
            const source = d.source ?? "user";
            if (source === "user") {
              setProcessingMessage("Noting selection...");
            }
            addTrace(
              "form_update",
              {
                section: d.section,
                field: d.field,
                value: d.value,
                source,
              },
              "SUCCESS",
            );
            const formResult = await respecService.processFormUpdate(
              d.section,
              d.field,
              d.value,
              { source, skipAcknowledgment: source === "system" },
            );

            if (formResult.formUpdates?.length) {
              applyArtifactUpdates(
                formResult.formUpdates,
                "form_update_updates",
                "form_update_field_verification",
              );
            }

            if (formResult.acknowledgment) {
              addChatMessage("assistant", formResult.acknowledgment);
            }
            return { success: true };
          }
          case "trigger_autofill": {
            setSwitchToAutoFill(true);
            const d = data as PayloadMap["trigger_autofill"];
            setProcessingMessage("Autofilling requirements...");
            addTrace("trigger_autofill", { section: d.section }, "SUCCESS");
            autofillResult = await respecService.triggerAutofill(
              d.section,
              message,
            );
            if (autofillResult.message) {
              addChatMessage("assistant", autofillResult.message);
            }

            if (
              autofillResult.mode !== "selections" ||
              autofillResult.fields.length === 0
            )
              return { success: true };

            for (const field of autofillResult.fields) {
              const currentValue =
                requirements[field.section]?.[field.field]?.value;
              const isEmptySelection =
                currentValue === null ||
                currentValue === undefined ||
                currentValue === "" ||
                (Array.isArray(currentValue) && currentValue.length === 0);

              if (!isEmptySelection) continue;

              const formResult = await respecService.processFormUpdate(
                field.section,
                field.field,
                field.value,
                {
                  source: "system",
                  skipAcknowledgment: true,
                  isAssumption: true,
                },
              );

              if (formResult.formUpdates?.length) {
                applyArtifactUpdates(
                  formResult.formUpdates,
                  "autofill_updates",
                  "autofill_field_verification",
                );
              }
              if (formResult.acknowledgment) {
                addChatMessage("assistant", formResult.acknowledgment);
              }
            }

            return { success: true };
          }
          case "autofill": {
            const d = data as PayloadMap["autofill"];
            return await communicateWithMAS("trigger_autofill", {
              section: d.section,
            });
          }

          case "system_populate_field": {
            const d = data as PayloadMap["system_populate_field"];
            try {
              if (
                !validateSystemFieldUpdate(
                  requirements,
                  fieldPermissions,
                  d.section,
                  d.field,
                  d.value,
                )
              ) {
                addTrace(
                  "system_populate_field",
                  {
                    section: d.section,
                    field: d.field,
                    value: d.value,
                    reason: "validation_failed",
                  },
                  "FAILED",
                );
                return { success: false, error: "Field validation failed" };
              }

              addTrace(
                "system_populate_field",
                { section: d.section, field: d.field, value: d.value },
                "SUCCESS",
              );
              console.log(`!!! [DEBUG] system_populate_field called with:`, {
                section: d.section,
                field: d.field,
                value: d.value,
                isSystemGenerated: d.isSystemGenerated,
                rawData: d,
              });

              const mappedValue = mapValueToFormField(
                d.section,
                d.field,
                d.value,
              );
              console.log(
                `!!! [DEBUG] System populate value mapped from ${d.value} to ${mappedValue}`,
              );

              setProcessingMessage("Updating field...");
              setRequirements((prev) => {
                const prevSection = prev[d.section] || {};
                const prevField = prevSection[d.field] || {};
                const newValue: Requirements = {
                  ...prev,
                  [d.section]: {
                    ...prevSection,
                    [d.field]: {
                      ...prevField,
                      value: mappedValue as FieldValue,
                      isComplete: true,
                      isAssumption: d.isSystemGenerated || false,
                      dataSource:
                        d.isSystemGenerated || false
                          ? "assumption"
                          : "requirement",
                      priority: prevField.priority || 1,
                      source: "system",
                      lastUpdated: new Date().toISOString(),
                      toggleHistory: prevField.toggleHistory || [],
                    },
                  },
                };

                console.log(
                  `!!! [DEBUG] Updated requirements for ${d.section}.${d.field}:`,
                  {
                    oldValue: prev[d.section]?.[d.field],
                    newValue: newValue[d.section][d.field],
                    fullSection: newValue[d.section],
                  },
                );

                return newValue;
              });

              setTimeout(() => {
                setRequirements((currentReqs) => {
                  const actualValue = currentReqs[d.section]?.[d.field]?.value;
                  const expectedValue = mappedValue;

                  if (actualValue !== expectedValue) {
                    console.error(
                      `[VALIDATION FAILED] Field ${d.section}.${d.field}: expected "${expectedValue}", got "${actualValue}"`,
                    );
                    addTrace(
                      "system_populate_field_verification",
                      {
                        section: d.section,
                        field: d.field,
                        expected: expectedValue,
                        actual: actualValue,
                      },
                      "FAILED",
                    );
                  } else {
                    console.log(
                      `!!! [VALIDATION OK] Field ${d.section}.${d.field} = "${actualValue}"`,
                    );
                    addTrace(
                      "system_populate_field_verification",
                      {
                        section: d.section,
                        field: d.field,
                        value: actualValue,
                      },
                      "SUCCESS",
                    );
                  }

                  return currentReqs; // Return unchanged state
                });
              }, 100);

              const formResult = await respecService.processFormUpdate(
                d.section,
                d.field,
                mappedValue,
                {
                  source: "system",
                  skipAcknowledgment: true,
                  isAssumption: d.isSystemGenerated || false,
                },
              );
              if (formResult.formUpdates?.length) {
                applyArtifactUpdates(
                  formResult.formUpdates,
                  "system_populate_updates",
                  "system_populate_artifact_verification",
                );
              }
              if (formResult.acknowledgment) {
                addChatMessage("assistant", formResult.acknowledgment);
              }

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
                "FAILED",
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
                "SUCCESS",
              );
              setProcessingMessage("Updating multiple fields...");
              setRequirements((prev) => {
                const updated: Requirements = { ...prev };
                d.updates.forEach((update) => {
                  const sectionState = updated[update.section] || {};
                  updated[update.section] = sectionState;
                  updated[update.section][update.field] = {
                    ...(sectionState[update.field] || {}),
                    value: update.value,
                    isComplete: true,
                    isAssumption: update.isSystemGenerated || false,
                    dataSource:
                      update.isSystemGenerated || false
                        ? "assumption"
                        : "requirement",
                    priority: sectionState[update.field]?.priority || 1,
                    source: "system",
                    lastUpdated: new Date().toISOString(),
                    toggleHistory:
                      sectionState[update.field]?.toggleHistory || [],
                  };
                });
                return updated;
              });
              const artifactUpdates: EnhancedFormUpdate[] = [];
              for (const update of d.updates || []) {
                const formResult = await respecService.processFormUpdate(
                  update.section,
                  update.field,
                  update.value,
                  {
                    source: "system",
                    skipAcknowledgment: true,
                    isAssumption: update.isSystemGenerated || false,
                  },
                );
                if (formResult.formUpdates?.length) {
                  artifactUpdates.push(...formResult.formUpdates);
                }
                if (formResult.acknowledgment) {
                  addChatMessage("assistant", formResult.acknowledgment);
                }
              }
              if (artifactUpdates.length) {
                applyArtifactUpdates(
                  artifactUpdates,
                  "system_populate_updates",
                  "system_populate_artifact_verification",
                );
              }
              return { success: true };
            } catch (error: unknown) {
              console.error(
                `[UI-RESPEC] System multiple update failed:`,
                error,
              );
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
                  `[TOGGLE FAILED] Field not found: ${section}.${field}`,
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
                  ...(prev[section] || {}),
                  [field]: {
                    ...((prev[section] || {})[field] || {}),
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
                `!!! [TOGGLE] ${section}.${field}: ${previousState} -> ${newState}`,
              );
              addTrace(
                "toggle_assumption",
                { section, field, from: previousState, to: newState },
                "SUCCESS",
              );

              return { success: true, newState };
            } catch (error: unknown) {
              console.error(`[TOGGLE ERROR]`, error);
              addTrace(
                "toggle_assumption",
                { error: (error as Error).message },
                "FAILED",
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

              console.log(`!!! [PERMISSION GRANTED] ${permissionKey}`);
              addTrace(
                "permission_granted",
                { section: d.section, field: d.field },
                "SUCCESS",
              );

              return { success: true };
            } catch (error: unknown) {
              console.error(`[PERMISSION ERROR]`, error);
              addTrace(
                "permission_granted",
                { error: (error as Error).message },
                "FAILED",
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

              console.log(`!!! [PERMISSION REVOKED] ${revokeKey}`);
              addTrace(
                "permission_revoked",
                { section: d.section, field: d.field },
                "SUCCESS",
              );

              return { success: true };
            } catch (error: unknown) {
              console.error(`[PERMISSION ERROR]`, error);
              addTrace(
                "permission_revoked",
                { error: (error as Error).message },
                "FAILED",
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
    },
    [
      addChatMessage,
      addTrace,
      applyArtifactUpdates,
      fieldPermissions,
      requirements,
      respecService,
      switchedToAutofill,
    ],
  );

  // const applyArtifactUpdates = useCallback((updates: EnhancedFormUpdate[]) => {
  //   if (!updates.length) return;

  //   setRequirements((prev) => {
  //     const next: Requirements = { ...prev };

  //     updates.forEach((update) => {
  //       const mappedValue = mapValueToFormField(
  //         update.section,
  //         update.field,
  //         update.value,
  //       );
  //       const prevSection = next[update.section] || {};
  //       const prevField = prevSection[update.field] || {};

  //       next[update.section] = {
  //         ...prevSection,
  //         [update.field]: {
  //           ...prevField,
  //           value: mappedValue as FieldValue,
  //           isComplete:
  //             mappedValue !== "" &&
  //             mappedValue !== null &&
  //             mappedValue !== undefined,
  //           isAssumption: update.isAssumption || false,
  //           dataSource:
  //             update.isAssumption || false ? "assumption" : "requirement",
  //           priority: prevField.priority || 1,
  //           source: "system",
  //           lastUpdated: new Date().toISOString(),
  //           toggleHistory: prevField.toggleHistory || [],
  //         },
  //       };
  //     });

  //     return next;
  //   });
  // }, []);

  useEffect(() => {
    const initializeApp = async () => {
      const initialRequirements: Requirements = {};
      const initialExpanded: Record<string, Record<string, boolean>> = {};

      Object.entries(formFieldsData.field_definitions).forEach(
        ([section, fields]) => {
          initialRequirements[section] = {};
          initialExpanded[section] = {};

          Object.entries(fields).forEach(([fieldKey]) => {
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
        },
      );

      Object.entries(formFieldsData.field_definitions).forEach(([section]) => {
        if (FIELD_GROUPS[section]) {
          Object.entries(FIELD_GROUPS[section]).forEach(
            ([groupKey, groupDef]) => {
              initialExpanded[section][groupKey] =
                groupDef.defaultOpen || false;
            },
          );
        }
      });

      setRequirements(initialRequirements);
      setExpandedGroups(initialExpanded);

      try {
        console.log("!!! [APP] Loading UC8 Data Layer...");
        await ucDataLayer.load();
        console.log("!!! [APP] ✅ UC8 Data Layer loaded successfully");
        console.log("!!! [APP] UC8 Metadata:", ucDataLayer.getMetadata());
      } catch (uc8Error) {
        console.warn(
          "[APP] ⚠️ UC8 Data Layer failed to load (non-blocking):",
          uc8Error,
        );
      }

      try {
        setProcessingMessage("Initializing...");
        setIsProcessing(true);
        await respecService.initialize(formFieldsData.field_definitions);
        console.log("!!! [APP] Simplified Respec initialized");
      } catch (err) {
        console.error("[APP] Simplified Respec init failed:", err);
      } finally {
        setIsProcessing(false);
        setProcessingMessage("");
      }

      try {
        console.log("!!! [APP] Initializing artifact state management...");

        const artifactManager = new ArtifactManager();
        await artifactManager.initialize();
        respecService.setArtifactManager(artifactManager);
      } catch (err) {
        console.error("[APP] Artifact state management init failed:", err);
      }
    };

    initializeApp();
  }, [respecService]);

  // useEffect(() => {
  //   if (!artifactManager) return;

  // const syncToArtifacts = async () => {
  //   try {
  //     console.log("!!! syncToArtifacts started", { requirements });
  //     const updates = await artifactManager.syncWithFormState(requirements);
  //     if (updates.length > 0) applyArtifactUpdates(updates);

  // const conflictStatus = respecService.getActiveConflictsForAgent();
  // if (conflictStatus.hasConflicts) {
  //   const conflictSignature = conflictStatus.conflicts
  //     .map((conflict) => conflict.id)
  //     .sort()
  //     .join("|");
  //   if (
  //     conflictSignature &&
  //     conflictSignature !== lastConflictSignatureRef.current
  //   )
  //     await presentConflictQuestion(conflictStatus);
  // } else if (lastConflictSignatureRef.current)
  //   lastConflictSignatureRef.current = null;

  // if (syncResult.updated.length > 0) {
  //   console.log(
  //     `[APP] Synced ${syncResult.updated.length} fields to artifact state:`,
  //     syncResult.updated
  //   );

  //   artifactManager
  //     .detectConflicts()
  //     .then((conflictResult) => {
  //       if (conflictResult.hasConflict) {
  //         console.warn(
  //           "[APP] CONFLICTS DETECTED:",
  //           conflictResult.conflicts
  //         );
  //         conflictResult.conflicts.forEach((conflict) => {
  //           console.warn(`🚨 Conflict: ${conflict.description}`);
  //           console.warn(`   Resolution: ${conflict.resolution}`);
  //         });
  //       } else {
  //         console.log("!!! [APP] No conflicts detected");
  //       }
  //     })
  //     .catch((error) => {
  //       console.error("[APP] Conflict detection failed:", error);
  //     });
  // }

  // if (syncResult.errors.length > 0) {
  //   console.warn("[APP] Artifact sync errors:", syncResult.errors);
  // }
  //     } catch (error) {
  //       console.error("[APP] Artifact sync failed:", error);
  //     }
  //   };

  //   // syncToArtifacts();
  // }, [
  //   requirements,
  //   artifactManager,
  //   applyArtifactUpdates,
  //   respecService,
  //   // presentConflictQuestion,
  // ]);

  const toggleGroup = (section: string, group: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] || {}),
        [group]: !prev[section]?.[group],
      },
    }));
  };

  const updateField = useCallback(
    (
      section: string,
      field: string,
      value: unknown,
      isAssumption = false,
      source = "user",
    ) => {
      setRequirements((prev) =>
        applyFieldUpdate(prev, section, field, value, isAssumption, source),
      );

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

      const groupKey = fieldDef?.group;
      if (
        groupKey &&
        formFieldsData.priority_system.must_fields.includes(field)
      ) {
        setExpandedGroups((prev) => ({
          ...prev,
          [section]: {
            ...(prev[section] || {}),
            [groupKey]: true,
          },
        }));
      }

      communicateWithMAS("form_update", {
        section,
        field,
        value: value as FieldValue,
        source: source === "system" ? "system" : "user",
      });
    },
    [communicateWithMAS],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      const formattedRequirements: ExportRequirements = {};
      Object.entries(requirements).forEach(([_, fields]) => {
        Object.entries(fields).forEach(([fieldKey, fieldData]) => {
          if (fieldData.value && fieldData.value !== "") {
            formattedRequirements[fieldKey] = {
              value: fieldData.value,
              priority: (fieldData.priority || 4) as 1 | 2 | 3 | 4,
              isAssumption: fieldData.isAssumption,
              required:
                formFieldsData.priority_system.must_fields.includes(fieldKey),
            };
          }
        });
      });
      if (Object.keys(formattedRequirements).length > 0) {
        DataServices.project.autoSave(formattedRequirements, projectName);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [requirements, projectName]);

  const scrollToField = (fieldKey: string) => {
    const loc = resolveFieldLocation(fieldKey);
    if (!loc) return;
    if (loc.group) {
      setExpandedGroups((prev) => ({
        ...prev,
        [loc.section]: {
          ...(prev[loc.section] || {}),
          [loc.group!]: true,
        },
      }));
    }
    if (loc.tab) setActiveTab(loc.tab);
    setTimeout(() => {
      const ok = focusAndScrollField(fieldKey);
      if (!ok) console.error(`ui element ${fieldKey} not found!`);
    }, 100);
  };

  const autofillAll = async () => {
    await communicateWithMAS("trigger_autofill", {
      section: "all",
    });
  };

  const autofillSection = (tabName: string) => {
    communicateWithMAS("autofill", { section: tabName });
  };

  const handleExport = useCallback(async () => {
    try {
      const formattedRequirements: ExportRequirements = {};
      Object.entries(requirements).forEach(([_, fields]) => {
        Object.entries(fields).forEach(([fieldKey, fieldData]) => {
          formattedRequirements[fieldKey] = {
            value: fieldData.value,
            priority: (fieldData.priority || 4) as 1 | 2 | 3 | 4,
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

      const blob = await DataServices.export.exportToPDF(
        formattedRequirements,
        metadata,
      );
      DataServices.utils.downloadBlob(
        blob,
        DataServices.utils.generateFilename(
          projectName.replace(/\s+/g, "_"),
          "pdf",
        ),
      );
    } catch (error: unknown) {
      console.error("Export failed:", error);
      alert(
        "Export failed: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }, [projectName, requirements]);

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
                const formattedRequirements: ExportRequirements = {};
                Object.entries(requirements).forEach(([_, fields]) => {
                  Object.entries(fields).forEach(([fieldKey, fieldData]) => {
                    if (fieldData.value && fieldData.value !== "") {
                      formattedRequirements[fieldKey] = {
                        value: fieldData.value,
                        priority: (fieldData.priority || 4) as 1 | 2 | 3 | 4,
                        isAssumption: fieldData.isAssumption,
                        required:
                          formFieldsData.priority_system.must_fields.includes(
                            fieldKey,
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
                await DataServices.project.saveProject(
                  projectName,
                  formattedRequirements,
                  metadata,
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

  const mustFieldsStatus = getMustFieldsStatus(requirements);

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
          completion={calculateCompletion(requirements)}
          accuracy={calculateAccuracy(requirements)}
          missingFields={mustFieldsStatus.missing}
          getFieldLabel={(fieldKey) => getFieldLabel(fieldKey)}
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
                sections={
                  (SECTION_MAPPING as Record<string, string[]>)[activeTab] || []
                }
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
