import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ExplanationStep } from '../types';
import clsx from 'clsx';

interface BlackboardProps {
  steps: ExplanationStep[];
  currentStepIndex: number;
  isThinking: boolean;
}

const TypewriterText = ({ text, isComplete, onComplete }: { text: string, isComplete: boolean, onComplete?: () => void }) => {
  const [displayedText, setDisplayedText] = useState('');
  const indexRef = useRef(0);
  
  useEffect(() => {
    if (isComplete) {
      setDisplayedText(text);
      return;
    }

    setDisplayedText('');
    indexRef.current = 0;

    const intervalId = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayedText((prev) => prev + text.charAt(indexRef.current));
        indexRef.current++;
      } else {
        clearInterval(intervalId);
        if (onComplete) onComplete();
      }
    }, 15);

    return () => clearInterval(intervalId);
  }, [text, isComplete, onComplete]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({node, ...props}) => <p className="mb-3 md:mb-5 leading-relaxed" {...props} />,
        code: ({node, ...props}) => <code className="bg-white/5 px-1 rounded font-mono text-[90%]" {...props} />
      }}
    >
      {displayedText}
    </ReactMarkdown>
  );
};

export const Blackboard: React.FC<BlackboardProps> = ({ steps, currentStepIndex, isThinking }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      // Small timeout to allow render to complete before scrolling
      setTimeout(() => {
        containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  }, [steps, currentStepIndex, isThinking]);

  return (
    <div className="flex-1 min-h-0 relative rounded-2xl md:rounded-3xl border-4 border-blackboard-frame bg-blackboard shadow-2xl overflow-hidden flex flex-col w-full h-full">
      {/* Realistic Texture Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] mix-blend-overlay"></div>
      <div className="absolute inset-0 pointer-events-none opacity-10 bg-gradient-to-br from-white/5 to-transparent"></div>
      
      {/* Content Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-5 md:p-12 font-hand text-xl md:text-3xl tracking-wide leading-relaxed text-chalk-white custom-scrollbar relative z-10 scroll-smooth"
      >
        {steps.length === 0 && !isThinking && (
          <div className="h-full flex flex-col items-center justify-center text-stone-500/20 select-none">
            <p className="text-3xl md:text-5xl font-hand tracking-widest opacity-80 rotate-[-2deg]">
              準備上課...
            </p>
          </div>
        )}

        {steps.map((step, index) => {
          const isFutureStep = index > currentStepIndex;
          if (isFutureStep) return null;

          const isCurrentStep = index === currentStepIndex;
          const isComplete = !isCurrentStep; 

          return (
            <div key={index} className={clsx("mb-10 md:mb-16 transition-all duration-500", isCurrentStep ? "opacity-100 scale-100" : "opacity-50 blur-[1px] scale-[0.99] origin-left")}>
              <h3 className="text-chalk-yellow text-xl md:text-2xl font-bold mb-3 md:mb-4 border-b-2 border-stone-600/30 pb-2 inline-block">
                {step.title}
              </h3>
              <div className="text-chalk-white">
                <TypewriterText 
                  text={step.blackboardText} 
                  isComplete={isComplete} 
                />
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div className="flex items-center gap-3 text-chalk-blue mt-8 animate-pulse">
            <div className="flex gap-1">
                <span className="w-2.5 h-2.5 bg-chalk-blue rounded-full"></span>
                <span className="w-2.5 h-2.5 bg-chalk-blue rounded-full animation-delay-200"></span>
                <span className="w-2.5 h-2.5 bg-chalk-blue rounded-full animation-delay-400"></span>
            </div>
            <span className="text-lg md:text-xl font-hand text-stone-400">老師正在思考中...</span>
          </div>
        )}
        
        {/* Extra space at bottom for scrolling */}
        <div className="h-12"></div>
      </div>
    </div>
  );
};