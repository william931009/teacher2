import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Hand, AlertTriangle } from 'lucide-react';
import { ExplanationStep, PracticeQuestion } from '../types';
import { PracticeSection } from './PracticeSection';
import clsx from 'clsx';

interface BlackboardProps {
  steps: ExplanationStep[];
  currentStepIndex: number;
  isThinking: boolean;
  isDark: boolean;
  error?: string | null;
  onRaiseHand?: () => void;
  isQAMode?: boolean;
  
  // Practice Question Props
  practiceQuestion?: PracticeQuestion | null;
  isPracticeLoading?: boolean;
  isPracticeVisible?: boolean;
  onShowPractice?: () => void;
}

// AnimatedMathText that handles dynamic text coloring
const AnimatedMathText = ({ text, isDark }: { text: string; isDark: boolean }) => {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    // Trigger fade-in on mount
    requestAnimationFrame(() => {
        setOpacity(1);
    });
  }, []);

  return (
    <div 
        className="transition-opacity duration-700 ease-out" 
        style={{ opacity: opacity }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Use dynamic class for text color
          p: ({node, ...props}) => (
            <p className={clsx("mb-2 md:mb-5 leading-relaxed", isDark ? "text-chalk-white" : "text-stone-800")} {...props} />
          ),
          // Ensure math blocks have plenty of space
          div: ({node, ...props}) => <div className="my-3 md:my-4" {...props} />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};

export const Blackboard: React.FC<BlackboardProps> = ({ 
  steps, 
  currentStepIndex, 
  isThinking, 
  isDark,
  error,
  onRaiseHand,
  isQAMode,
  practiceQuestion,
  isPracticeLoading,
  isPracticeVisible,
  onShowPractice
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto scroll effect
  useEffect(() => {
    if (containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  }, [steps, currentStepIndex, isThinking, practiceQuestion, isPracticeLoading, isPracticeVisible, error]);

  // Determine if we are at the last step
  const isLastStep = steps.length > 0 && currentStepIndex === steps.length - 1;

  return (
    <div className={clsx(
      "flex-1 min-h-0 relative rounded-2xl md:rounded-3xl border-4 shadow-2xl overflow-hidden flex flex-col w-full transition-all duration-300 group",
      isDark 
        ? "border-blackboard-frame bg-blackboard" 
        : "border-stone-300 bg-white"
    )}>
      
      {/* Raise Hand Button - Bottom Right */}
      {steps.length > 0 && !isQAMode && !error && (
         <button
            onClick={onRaiseHand}
            className={clsx(
              "absolute bottom-3 right-3 md:bottom-4 md:right-4 z-30 flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full shadow-xl border transform transition-all duration-200 hover:scale-105 active:scale-95",
              isDark 
                ? "bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500" 
                : "bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-400"
            )}
         >
            <Hand size={16} className="md:w-[18px] md:h-[18px]" />
            <span className="font-bold text-xs md:text-sm">舉手發問</span>
         </button>
      )}

      {/* Realistic Texture Overlay */}
      {isDark && (
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] mix-blend-overlay z-0"></div>
      )}
      <div className={clsx("absolute inset-0 pointer-events-none opacity-10 bg-gradient-to-br from-white/5 to-transparent z-0", !isDark && "opacity-0")}></div>
      
      {/* Scrollable Container */}
      <div 
        ref={containerRef}
        className={clsx(
          "flex-1 overflow-y-auto font-hand text-xl md:text-3xl tracking-wide leading-relaxed custom-scrollbar relative z-10 scroll-smooth",
          isDark ? "text-chalk-white" : "text-stone-800"
        )}
      >
        {/* Content Wrapper */}
        <div className="p-3 md:p-12 min-h-full">
            {/* Error Display */}
            {error && (
               <div className="h-[60vh] flex flex-col items-center justify-center text-center px-4 animate-in fade-in slide-in-from-bottom-5">
                   <div className="p-4 bg-red-500/10 rounded-full mb-4">
                      <AlertTriangle size={48} className="text-red-500" />
                   </div>
                   <h3 className={clsx("text-2xl font-bold mb-2", isDark ? "text-stone-200" : "text-stone-800")}>
                     發生錯誤
                   </h3>
                   <p className={clsx("text-lg max-w-md", isDark ? "text-stone-400" : "text-stone-600")}>
                     {error}
                   </p>
               </div>
            )}

            {/* Empty State / Ready State */}
            {steps.length === 0 && !isThinking && !error && (
              <div className="h-[60vh] flex flex-col items-center justify-center select-none transition-colors duration-300">
                <p className={clsx(
                  "text-3xl md:text-5xl font-hand tracking-widest rotate-[-2deg]",
                  isDark ? "text-stone-500/20" : "text-stone-300/40"
                )}>
                  {isDark ? "準備上課..." : "準備開始..."}
                </p>
              </div>
            )}

            {/* Steps Content */}
            {!error && steps.map((step, index) => {
              const isFutureStep = index > currentStepIndex;
              if (isFutureStep) return null;

              const isCurrentStep = index === currentStepIndex;
              
              return (
                <div key={index} className={clsx("mb-6 md:mb-16 transition-all duration-500", isCurrentStep ? "opacity-100 scale-100" : "opacity-50 blur-[1px] scale-[0.99] origin-left")}>
                  <h3 className={clsx(
                    "text-lg md:text-2xl font-bold mb-2 md:mb-4 border-b-2 pb-1 md:pb-2 inline-block",
                    isDark ? "text-chalk-yellow border-stone-600/30" : "text-blue-600 border-stone-200"
                  )}>
                    {step.title}
                  </h3>
                  <div>
                    <AnimatedMathText 
                      text={step.blackboardText} 
                      isDark={isDark}
                    />
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isThinking && !error && (
              <div className={clsx("flex items-center gap-3 mt-6 md:mt-8 animate-pulse", isDark ? "text-chalk-blue" : "text-indigo-500")}>
                <div className="flex gap-1">
                    <span className={clsx("w-2 h-2 md:w-2.5 md:h-2.5 rounded-full", isDark ? "bg-chalk-blue" : "bg-indigo-500")}></span>
                    <span className={clsx("w-2 h-2 md:w-2.5 md:h-2.5 rounded-full animation-delay-200", isDark ? "bg-chalk-blue" : "bg-indigo-500")}></span>
                    <span className={clsx("w-2 h-2 md:w-2.5 md:h-2.5 rounded-full animation-delay-400", isDark ? "bg-chalk-blue" : "bg-indigo-500")}></span>
                </div>
                <span className={clsx("text-base md:text-xl font-hand", isDark ? "text-stone-400" : "text-stone-500")}>老師正在準備課程內容...</span>
              </div>
            )}

            {/* Practice Section - Appears ONLY at the last step */}
            {onShowPractice && isLastStep && !error && (
               <PracticeSection 
                  practiceQuestion={practiceQuestion || null} 
                  isLoading={!!isPracticeLoading}
                  isVisible={!!isPracticeVisible}
                  onShow={onShowPractice}
                  isDark={isDark}
               />
            )}
            
            {/* Extra space at bottom for scrolling */}
            <div className="h-20 md:h-24"></div>
        </div>
      </div>
    </div>
  );
};