import React from "react";
import ConflictPanel from "./ConflictPanel";
import type { FieldConflict } from "../../legacy_isolated/ConflictDetectionService";

export interface ConflictPanelContainerProps {
  visible: boolean;
  conflicts: FieldConflict[];
  onResolve: (
    conflictId: string,
    action: "accept" | "reject" | "modify",
    newValue?: string
  ) => Promise<void>;
  onDismiss?: (conflictId: string) => void;
  className?: string;
}

export const ConflictPanelContainer: React.FC<ConflictPanelContainerProps> = ({
  visible,
  conflicts,
  onResolve,
  onDismiss,
  className,
}) => {
  if (!visible || conflicts.length === 0) return null;
  return (
    <div
      className={
        className || "fixed bottom-4 right-4 w-96 max-h-80 z-50"
      }
    >
      <ConflictPanel
        conflicts={conflicts}
        onResolveConflict={onResolve}
        onDismissConflict={onDismiss}
      />
    </div>
  );
};

