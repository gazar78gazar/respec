import { Check } from "lucide-react";

// Component Props types
export interface StepHeaderProps {
  currentStep: number;
  setCurrentStage: (stage: number) => void;
  chatWindowWidth?: number;
}

export const StepProgressIndicator: React.FC<StepHeaderProps> = ({
  currentStep,
  setCurrentStage,
  chatWindowWidth = 384,
}: StepHeaderProps) => {
  const steps = [
    {
      id: 1,
      label: "Require",
      completed: currentStep > 1,
      current: currentStep === 1,
    },
    {
      id: 3,
      label: "Configure",
      completed: currentStep > 3,
      current: currentStep === 3,
    },
    { id: 4, label: "Review", completed: false, current: currentStep === 4 },
  ];

  // Calculate progress based on the index of current step, not the step ID
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);
  const progressPercentage =
    currentStepIndex >= 0
      ? (currentStepIndex / (steps.length - 1)) * 100
      : 0;

  const handleStepNavigation = (stepId: number) => {
    setCurrentStage(stepId);
  };

  return (
    <div
      className="fixed bottom-0 left-0 bg-white border-t border-gray-200 px-6 py-4 z-10"
      style={{ right: `${chatWindowWidth}px` }}
    >
      <div className="max-w-3xl mx-auto">
        <div className="relative">
          {/* Background Track */}
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 rounded-full transform -translate-y-1/2"></div>

          {/* Progress Fill */}
          <div
            className="absolute top-1/2 left-0 h-1 bg-blue-500 rounded-full transform -translate-y-1/2 transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          ></div>

          {/* Stage Pills */}
          <div className="relative flex items-center justify-between">
            {steps.map((step) => (
              <button
                key={step.id}
                onClick={() => handleStepNavigation(step.id)}
                className={`
                  relative px-8 py-3 rounded-full font-medium text-sm
                  transition-all duration-300 transform hover:scale-105
                  ${
                    step.completed
                      ? "bg-blue-500 text-white shadow-lg hover:bg-blue-600"
                      : step.current
                        ? "bg-blue-500 text-white shadow-xl scale-105 ring-4 ring-blue-100"
                        : "bg-white text-gray-600 border-2 border-gray-300 hover:border-blue-400 hover:text-blue-600"
                  }
                `}
              >
                <div className="flex items-center">
                  {step.completed && (
                    <Check size={18} className="mr-2" strokeWidth={3} />
                  )}
                  <span className="whitespace-nowrap">{step.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
