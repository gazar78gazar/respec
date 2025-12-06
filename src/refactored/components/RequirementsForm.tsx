import React from "react";
import type { Requirements } from "../types/requirements.types";
import { SectionAccordionGroup } from "./SectionAccordionGroup";
import { FormField } from "./FormField";
import type { FieldDef, FieldValue } from "./FormField";

export interface RequirementsFormProps {
  sections: string[];
  requirements: Requirements;
  fieldDefs: Record<string, Record<string, FieldDef>>;
  groups: Record<
    string,
    Record<string, { label: string; fields: string[]; defaultOpen?: boolean }>
  >;
  expandedGroups: Record<string, Record<string, boolean>>;
  onToggleGroup: (section: string, group: string) => void;
  onChangeField: (
    section: string,
    field: string,
    value: unknown,
    isAssumption: boolean,
  ) => void;
  isRequired: (fieldKey: string) => boolean;
}

export const RequirementsForm: React.FC<RequirementsFormProps> = ({
  sections,
  requirements,
  fieldDefs,
  groups,
  expandedGroups,
  onToggleGroup,
  onChangeField,
  isRequired,
}) => {
  return (
    <div className="p-6">
      {sections.map((section) => {
        const sectionGroups = groups[section];
        if (!sectionGroups) return null;

        return (
          <div key={section} className="space-y-4">
            {Object.entries(sectionGroups).map(([groupKey, groupDef]) => {
              const isExpanded = expandedGroups[section]?.[groupKey] || false;

              const groupFields = groupDef.fields
                .map((fieldKey) => ({
                  fieldKey,
                  fieldDef: fieldDefs[section][fieldKey],
                  data: (
                    requirements[section] as
                      | Record<
                          string,
                          { value?: FieldValue; isAssumption?: boolean }
                        >
                      | undefined
                  )?.[fieldKey],
                }))
                .filter((f) => f.fieldDef);

              const completedInGroup = groupFields.filter(
                (f) => f.data?.isComplete,
              ).length;
              const totalInGroup = groupFields.length;

              return (
                <SectionAccordionGroup
                  key={groupKey}
                  label={groupDef.label}
                  isExpanded={isExpanded}
                  completedCount={completedInGroup}
                  totalCount={totalInGroup}
                  onToggle={() => onToggleGroup(section, groupKey)}
                >
                  {groupFields.map(({ fieldKey, fieldDef, data }) => (
                    <FormField
                      key={fieldKey}
                      fieldKey={fieldKey}
                      fieldDef={fieldDef}
                      data={data}
                      section={section}
                      required={isRequired(fieldKey)}
                      onChange={(value, isAssumption) =>
                        onChangeField(section, fieldKey, value, isAssumption)
                      }
                    />
                  ))}
                </SectionAccordionGroup>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
