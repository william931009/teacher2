import React, { useEffect, useRef } from 'react';
import { CheckCircle2, Circle, PlayCircle, Volume2 } from 'lucide-react';
import { ExplanationStep } from '../types';
import clsx from 'clsx';

interface StepListProps {
  steps: ExplanationStep[];
  currentStepIndex: number;
  onStepClick: (index: number, shouldPlay: boolean) => void;
  isDark: boolean;
  isPlaying: boolean;
}

export const StepList: React.FC<StepListProps> = ({ steps, currentStepIndex, onStepClick, isDark, isPlaying }) => {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      // Changed block: 'nearest' to 'center' to keep the active card (and its buttons) more centrally visible
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStepIndex]);

  if (steps.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 w-full">
      <h3 className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
        <span>教學步驟</span>
        <span className={clsx(
          "px-1.5 py-0.5 rounded text-[10px]",
          isDark ? "bg-stone-800 text-stone-400" : "bg-stone-200 text-stone-600"
        )}>{steps.length}</span>
      </h3>
      {steps.map((step, index) => {
        const isActive = index === currentStepIndex;
        const isPast = index < currentStepIndex;
        
        // Show play button if not playing or if it's not the active step (user can click to jump and play)
        // If it is active and playing, we don't show the "Hear Explanation" button to avoid redundancy, 
        // or we could show a "Playing..." state.
        const showPlayButton = !isActive || (isActive && !isPlaying);
        
        return (
          <div
            key={index}
            onClick={() => onStepClick(index, false)} // Click card: just navigate, don't play
            ref={isActive ? activeRef : null}
            className={clsx(
              "text-left p-3 rounded-xl border transition-all duration-200 group relative overflow-hidden cursor-pointer",
              // Active State
              isActive && isDark && "bg-emerald-900/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]",
              isActive && !isDark && "bg-emerald-50 border-emerald-400/50 shadow-sm",
              // Inactive State
              !isActive && isDark && "bg-stone-800/40 border-stone-700/30 hover:bg-stone-800 hover:border-stone-600",
              !isActive && !isDark && "bg-white border-stone-200 hover:bg-gray-50 hover:border-stone-300"
            )}
          >
            <div className="flex items-start gap-3 relative z-10">
              <div className={clsx(
                "mt-0.5 shrink-0 transition-colors", 
                isActive 
                  ? (isDark ? "text-emerald-400" : "text-emerald-600")
                  : "text-stone-400"
              )}>
                {isActive ? <PlayCircle size={16} /> : (isPast ? <CheckCircle2 size={16} /> : <Circle size={16} />)}
              </div>
              <div className="min-w-0 flex-1">
                 <div className="flex items-center gap-2 mb-0.5">
                    <span className={clsx(
                      "text-[10px] font-mono uppercase tracking-wider", 
                      isActive 
                        ? (isDark ? "text-emerald-500" : "text-emerald-600")
                        : "text-stone-500"
                    )}>
                      Step {index + 1}
                    </span>
                 </div>
                 <h4 className={clsx(
                   "text-sm font-medium line-clamp-2 leading-snug mb-2", 
                   isActive 
                     ? (isDark ? "text-stone-200" : "text-stone-800")
                     : (isDark ? "text-stone-400 group-hover:text-stone-300" : "text-stone-500 group-hover:text-stone-700")
                  )}>
                   {step.title}
                 </h4>

                 {/* Explicit Play Button */}
                 {showPlayButton && (
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       onStepClick(index, true); // Click button: navigate AND play
                     }}
                     className={clsx(
                       "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors w-fit mb-1",
                       isDark 
                         ? "bg-stone-700 text-stone-300 hover:bg-emerald-700 hover:text-white" 
                         : "bg-stone-100 text-stone-600 hover:bg-emerald-600 hover:text-white"
                     )}
                   >
                     <Volume2 size={14} />
                     <span>聽講解</span>
                   </button>
                 )}
                 {isActive && isPlaying && (
                    <div className={clsx("flex items-center gap-2 text-xs font-medium animate-pulse", isDark ? "text-emerald-400" : "text-emerald-600")}>
                        <div className="flex gap-0.5 items-end h-3">
                             <div className="w-0.5 bg-current h-1 animate-[bounce_1s_infinite]"></div>
                             <div className="w-0.5 bg-current h-2 animate-[bounce_1.2s_infinite]"></div>
                             <div className="w-0.5 bg-current h-1.5 animate-[bounce_0.8s_infinite]"></div>
                        </div>
                        <span>講解中...</span>
                    </div>
                 )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};