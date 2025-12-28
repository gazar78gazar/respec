import React from "react";

export interface ConflictToggleButtonProps {
  count: number;
  hasCritical?: boolean;
  onToggle: () => void;
  className?: string;
}

export const ConflictToggleButton: React.FC<ConflictToggleButtonProps> = ({
  count,
  hasCritical = false,
  onToggle,
  className,
}) => {
  if (count <= 0) return null;
  const base =
    "fixed bottom-4 right-4 w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white font-semibold z-40";
  const tone = hasCritical
    ? "bg-red-500 hover:bg-red-600"
    : "bg-yellow-500 hover:bg-yellow-600";
  return (
    <button
      onClick={onToggle}
      className={className ? `${base} ${className}` : `${base} ${tone}`}
      title={`${count} conflicts detected`}
      aria-label={`Toggle conflicts (${count})`}
    >
      ⚠️
    </button>
  );
};
