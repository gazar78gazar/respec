import React from "react";

export interface ProcessingPopupProps {
  visible: boolean;
  message?: string;
  className?: string;
}

export const ProcessingPopup: React.FC<ProcessingPopupProps> = ({
  visible,
  message,
  className,
}) => {
  if (!visible) return null;
  return (
    <div
      className={
        className ||
        "fixed bottom-20 right-8 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50"
      }
    >
      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
      <span>{message || "Processing..."}</span>
    </div>
  );
};

