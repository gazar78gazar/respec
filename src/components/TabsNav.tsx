import React from "react";

export interface TabsNavProps {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
  className?: string;
  getLabel?: (tab: string) => string;
}

export const TabsNav: React.FC<TabsNavProps> = ({
  tabs,
  active,
  onChange,
  className,
  getLabel,
}) => {
  return (
    <div className={className ?? ""}>
      <div className="flex space-x-8">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className={
              `pb-2 text-sm font-medium transition-all ` +
              (active === tab
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700")
            }
          >
            {getLabel ? getLabel(tab) : tab}
          </button>
        ))}
      </div>
    </div>
  );
};
