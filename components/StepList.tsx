import React, { useEffect, useRef } from 'react';
import { CheckCircle2, Circle, PlayCircle } from 'lucide-react';
import { ExplanationStep } from '../types';
import clsx from 'clsx';

interface StepListProps {
  steps: ExplanationStep[];
  currentStepIndex: number;
  onStepClick: (index: number) => void;
}

export const StepList: React.FC<StepListProps> = ({ steps, currentStepIndex, onStepClick }) => {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentStepIndex]);

  if (steps.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 w-full">
      <h3 className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
        <span>教學步驟</span>
        <span className="bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded text-[10px]">{steps.length}</span>
      </h3>
      {steps.map((step, index) => {
        const isActive = index === currentStepIndex;
        const isPast = index < currentStepIndex;
        
        return (
          <button
            key={index}
            onClick={() => onStepClick(index)}
            ref={isActive ? activeRef : null}
            className={clsx(
              "text-left p-3 rounded-xl border transition-all duration-200 group relative overflow-hidden",
              isActive 
                ? "bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                : "bg-stone-800/40 border-stone-700/30 hover:bg-stone-800 hover:border-stone-600"
            )}
          >
            <div className="flex items-start gap-3 relative z-10">
              <div className={clsx("mt-0.5 shrink-0 transition-colors", isActive ? "text-emerald-400" : "text-stone-600")}>
                {isActive ? <PlayCircle size={16} /> : (isPast ? <CheckCircle2 size={16} /> : <Circle size={16} />)}
              </div>
              <div className="min-w-0 flex-1">
                 <div className="flex items-center gap-2 mb-0.5">
                    <span className={clsx("text-[10px] font-mono uppercase tracking-wider", isActive ? "text-emerald-500" : "text-stone-500")}>
                      Step {index + 1}
                    </span>
                 </div>
                 <h4 className={clsx("text-sm font-medium line-clamp-2 leading-snug", isActive ? "text-stone-200" : "text-stone-400 group-hover:text-stone-300")}>
                   {step.title}
                 </h4>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
