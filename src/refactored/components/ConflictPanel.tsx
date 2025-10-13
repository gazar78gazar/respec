import React, { useState, useEffect } from "react";
import {
  FieldConflict,
  ConflictSuggestion,
} from "../../legacy_isolated/ConflictDetectionService";

interface ConflictPanelProps {
  conflicts: FieldConflict[];
  onResolveConflict: (
    conflictId: string,
    action: ConflictSuggestion["action"],
    newValue?: string
  ) => Promise<void>;
  onDismissConflict?: (conflictId: string) => void;
  className?: string;
}

export const ConflictPanel: React.FC<ConflictPanelProps> =({
  conflicts,
  onResolveConflict,
  onDismissConflict,
  className = "",
}) => {
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(
    new Set()
  );
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [processingConflicts, setProcessingConflicts] = useState<Set<string>>(
    new Set()
  );

  // Auto-expand high severity conflicts
  useEffect(() => {
    const highSeverityConflicts = conflicts
      .filter((c) => c.severity === "error" || c.severity === "critical")
      .map((c) => c.id);

    if (highSeverityConflicts.length > 0) {
      setExpandedConflicts(
        (prev) => new Set([...prev, ...highSeverityConflicts])
      );
    }
  }, [conflicts]);

  const toggleConflictExpansion = (conflictId: string) => {
    setExpandedConflicts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(conflictId)) {
        newSet.delete(conflictId);
      } else {
        newSet.add(conflictId);
      }
      return newSet;
    });
  };

  const handleResolveConflict = async (
    conflictId: string,
    action: ConflictSuggestion["action"],
    newValue?: string
  ) => {
    setProcessingConflicts((prev) => new Set([...prev, conflictId]));

    try {
      await onResolveConflict(conflictId, action, newValue);

      // Clear custom value after resolution
      setCustomValues((prev) => {
        const newValues = { ...prev };
        delete newValues[conflictId];
        return newValues;
      });

      // Remove from expanded set
      setExpandedConflicts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(conflictId);
        return newSet;
      });
    } catch (error) {
      console.error("Failed to resolve conflict:", error);
    } finally {
      setProcessingConflicts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(conflictId);
        return newSet;
      });
    }
  };

  const getSeverityIcon = (severity: FieldConflict["severity"]) => {
    switch (severity) {
      case "critical":
        return "🔴";
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      case "info":
        return "ℹ️";
      default:
        return "❓";
    }
  };

  const getSeverityColor = (severity: FieldConflict["severity"]) => {
    switch (severity) {
      case "critical":
        return "border-red-500 bg-red-50";
      case "error":
        return "border-red-400 bg-red-50";
      case "warning":
        return "border-yellow-400 bg-yellow-50";
      case "info":
        return "border-blue-400 bg-blue-50";
      default:
        return "border-gray-400 bg-gray-50";
    }
  };

  const getTypeLabel = (type: FieldConflict["type"]) => {
    switch (type) {
      case "value_change":
        return "Value Change";
      case "constraint_violation":
        return "Constraint Violation";
      case "incompatible_specs":
        return "Compatibility Issue";
      case "overwrite_warning":
        return "Overwrite Warning";
      default:
        return "Unknown";
    }
  };

  if (conflicts.length === 0) {
    return null;
  }

  // Group conflicts by severity
  const groupedConflicts = conflicts.reduce((groups, conflict) => {
    const severity = conflict.severity;
    if (!groups[severity]) groups[severity] = [];
    groups[severity].push(conflict);
    return groups;
  }, {} as Record<FieldConflict["severity"], FieldConflict[]>);

  const severityOrder: FieldConflict["severity"][] = [
    "critical",
    "error",
    "warning",
    "info",
  ];

  return (
    <div className={`bg-white border rounded-lg shadow-sm ${className}`}>
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 flex items-center">
            ⚡ Conflicts Detected ({conflicts.length})
          </h3>
          <div className="flex space-x-2 text-xs">
            {Object.entries(groupedConflicts).map(
              ([severity, conflictList]) => (
                <span
                  key={severity}
                  className={`px-2 py-1 rounded-full ${getSeverityColor(
                    severity
                  )}`}
                >
                  {getSeverityIcon(severity)} {conflictList.length}
                </span>
              )
            )}
          </div>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {severityOrder.map((severity) => {
          const severityConflicts = groupedConflicts[severity];
          if (!severityConflicts) return null;

          return (
            <div key={severity}>
              {severityConflicts.map((conflict) => {
                const isExpanded = expandedConflicts.has(conflict.id);
                const isProcessing = processingConflicts.has(conflict.id);
                const customValue = customValues[conflict.id] || "";

                return (
                  <div
                    key={conflict.id}
                    className={`border-b border-l-4 ${getSeverityColor(
                      conflict.severity
                    )} last:border-b-0`}
                  >
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleConflictExpansion(conflict.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">
                            {getSeverityIcon(conflict.severity)}
                          </span>
                          <div>
                            <div className="font-medium text-gray-800">
                              {conflict.field}
                            </div>
                            <div className="text-sm text-gray-600">
                              {getTypeLabel(conflict.type)} •{" "}
                              {Math.round(conflict.confidence * 100)}%
                              confidence
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {onDismissConflict && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDismissConflict(conflict.id);
                              }}
                              className="text-gray-400 hover:text-gray-600 text-sm"
                            >
                              ✕
                            </button>
                          )}
                          <span className="text-gray-400">
                            {isExpanded ? "▼" : "▶"}
                          </span>
                        </div>
                      </div>

                      {!isExpanded && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-mono text-red-600">
                            {conflict.currentValue}
                          </span>
                          {" → "}
                          <span className="font-mono text-green-600">
                            {conflict.newValue}
                          </span>
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 bg-white">
                        {/* Conflict Details */}
                        <div className="text-sm text-gray-700">
                          <div className="font-medium mb-1">Reason:</div>
                          <div>{conflict.reason}</div>
                        </div>

                        {/* Value Change Display */}
                        <div className="bg-gray-50 rounded p-3">
                          <div className="text-sm">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">
                                Proposed Change:
                              </span>
                              <span className="text-xs text-gray-500">
                                {conflict.metadata.source} •{" "}
                                {conflict.metadata.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="font-mono text-sm">
                              <div className="text-red-600">
                                - {conflict.currentValue || "(empty)"}
                              </div>
                              <div className="text-green-600">
                                + {conflict.newValue}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Original Context */}
                        {conflict.metadata.originalContext && (
                          <div className="bg-blue-50 rounded p-3 text-sm">
                            <div className="font-medium text-blue-800 mb-1">
                              Original Request:
                            </div>
                            <div className="text-blue-700 italic">
                              "{conflict.metadata.originalContext}"
                            </div>
                          </div>
                        )}

                        {/* Affected Fields */}
                        {conflict.metadata.affectedFields &&
                          conflict.metadata.affectedFields.length > 0 && (
                            <div className="text-sm">
                              <div className="font-medium mb-1">
                                May Affect:
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {conflict.metadata.affectedFields.map(
                                  (field) => (
                                    <span
                                      key={field}
                                      className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs"
                                    >
                                      {field}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                        {/* Suggestions */}
                        {conflict.suggestions &&
                          conflict.suggestions.length > 0 && (
                            <div>
                              <div className="font-medium text-gray-800 mb-2">
                                Suggestions:
                              </div>
                              <div className="space-y-2">
                                {conflict.suggestions.map((suggestion) => (
                                  <div
                                    key={suggestion.id}
                                    className="border rounded p-3 hover:bg-gray-50"
                                  >
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <div className="font-medium">
                                          {suggestion.label}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          {suggestion.description}
                                        </div>
                                      </div>
                                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                        {Math.round(
                                          suggestion.confidence * 100
                                        )}
                                        %
                                      </span>
                                    </div>

                                    {suggestion.consequences && (
                                      <div className="text-xs text-gray-500 mb-2">
                                        Consequences:{" "}
                                        {suggestion.consequences.join(", ")}
                                      </div>
                                    )}

                                    {suggestion.action === "modify" && (
                                      <div className="mb-2">
                                        <input
                                          type="text"
                                          placeholder={
                                            suggestion.newValue ||
                                            conflict.newValue
                                          }
                                          value={customValue}
                                          onChange={(e) =>
                                            setCustomValues((prev) => ({
                                              ...prev,
                                              [conflict.id]: e.target.value,
                                            }))
                                          }
                                          className="w-full px-2 py-1 border rounded text-sm"
                                          disabled={isProcessing}
                                        />
                                      </div>
                                    )}

                                    <button
                                      onClick={() =>
                                        handleResolveConflict(
                                          conflict.id,
                                          suggestion.action,
                                          suggestion.action === "modify"
                                            ? customValue || suggestion.newValue
                                            : suggestion.newValue
                                        )
                                      }
                                      disabled={isProcessing}
                                      className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
                                    >
                                      {isProcessing ? "⏳" : suggestion.label}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Quick Actions */}
                        <div className="flex space-x-2 pt-2 border-t">
                          <button
                            onClick={() =>
                              handleResolveConflict(conflict.id, "accept")
                            }
                            disabled={isProcessing}
                            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
                          >
                            ✓ Accept
                          </button>
                          <button
                            onClick={() =>
                              handleResolveConflict(conflict.id, "reject")
                            }
                            disabled={isProcessing}
                            className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 disabled:opacity-50"
                          >
                            ✗ Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ConflictPanel;
