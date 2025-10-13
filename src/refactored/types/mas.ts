// MAS action typing for strongly-typed communicateWithMAS

export type FieldValue =
  | string
  | number
  | boolean
  | string[]
  | null
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

export interface PayloadMap {
  chat_message: { message: string };
  form_update: {
    section: string;
    field: string;
    value: FieldValue;
    source?: "user" | "system";
  };
  trigger_autofill: { trigger: string };
  autofill: { section: string };
  system_populate_field: {
    section: string;
    field: string;
    value: FieldValue;
    isSystemGenerated?: boolean;
  };
  system_populate_multiple: {
    updates: Array<{
      section: string;
      field: string;
      value: FieldValue;
      isSystemGenerated?: boolean;
    }>;
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
