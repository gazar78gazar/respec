// MAS action typing for strongly-typed communicateWithMAS

import type { Maybe, RequirementField } from "./service.types";

export type FieldValue =
  | Maybe<string | number | boolean | string[]>
  | undefined;

export type MASAction =
  | "chat_message"
  | "form_update"
  | "trigger_autofill"
  | "autofill"
  | "system_populate_field"
  | "system_populate_multiple"
  | "system_send_message"
  | "system_toggle_assumption"
  | "grant_override_permission"
  | "revoke_override_permission";

interface FieldPayload extends RequirementField {
  source?: "user" | "system";
}

export interface PayloadMap {
  chat_message: { message: string };
  form_update: FieldPayload;
  trigger_autofill: { trigger: string };
  autofill: { section: string };
  system_populate_field: FieldPayloadData;
  system_populate_multiple: {
    updates: Array<FieldPayloadData>;
  };
  system_send_message: { message: string };
  system_toggle_assumption: { section: string; field: string; reason?: string };
  grant_override_permission: {
    section: string;
    field: string;
    grantedBy?: string;
  };
  revoke_override_permission: { section: string; field: string };
}

export interface FieldPayloadData extends RequirementField {
  isSystemGenerated?: boolean;
}
