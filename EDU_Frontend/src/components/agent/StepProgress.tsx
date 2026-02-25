import React from 'react';

interface StepProgressProps {
  totalSteps: number;
  currentStep: number;
}

export const StepProgress: React.FC<StepProgressProps> = ({ totalSteps, currentStep }) => {
  return (
    <div className="flex gap-1 w-full px-1">
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <div
            key={index}
            className={`h-1 rounded-full flex-1 transition-all duration-500 ease-out ${
              isActive 
                ? 'bg-primary shadow-[0_0_8px_rgba(0,111,238,0.4)]' 
                : isCompleted 
                  ? 'bg-primary/50' 
                  : 'bg-default-300'
            }`}
          />
        );
      })}
    </div>
  );
};

export default StepProgress;
