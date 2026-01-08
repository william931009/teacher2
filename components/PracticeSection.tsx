import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Lightbulb, Eye, PenTool, Loader2 } from 'lucide-react';
import { PracticeQuestion } from '../types';
import clsx from 'clsx';

// Define helper components at the top to avoid hoisting issues
const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

interface PracticeSectionProps {
  practiceQuestion: PracticeQuestion | null;
  isLoading: boolean;
  isVisible: boolean;
  onShow: () => void;
  isDark: boolean;
}

export const PracticeSection: React.FC<PracticeSectionProps> = ({
  practiceQuestion,
  isLoading,
  isVisible,
  onShow,
  isDark,
}) => {
  const [showAnswer, setShowAnswer] = useState(false);

  // Styling constants based on theme
  const borderColor = isDark ? "border-stone-600" : "border-stone-300";
  
  // Adjusted button base for smaller size
  const buttonBase = "transition-all duration-200 transform hover:scale-105 active:scale-95 font-bold rounded-full flex items-center gap-2 px-5 py-2 shadow-md";
  
  const generateBtnColor = isDark 
    ? "bg-stone-700 text-stone-200 hover:bg-stone-600 border border-stone-500" 
    : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-300";

  // State 1: Not Visible yet (User sees "AI 出題" button)
  // Simplified: No extra container, no header text. Just the button.
  if (!isVisible) {
      return (
        <div className="mt-8 mb-4 flex justify-center">
          <button 
            onClick={onShow}
            className={`${generateBtnColor} ${buttonBase}`}
          >
            <PenTool size={16} />
            <span>AI 出題</span>
          </button>
        </div>
      );
  }

  // State 2: Visible but Loading (Data not ready yet)
  if (isLoading || !practiceQuestion) {
    return (
      <div className={clsx("mt-14 p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 animate-pulse", borderColor)}>
        <Loader2 className={clsx("animate-spin", isDark ? "text-emerald-400" : "text-emerald-600")} size={24} />
        <span className={clsx("font-hand text-lg", isDark ? "text-stone-400" : "text-stone-500")}>
          出題中...
        </span>
      </div>
    );
  }

  // State 3: Visible and Ready (Show Question Card)
  return (
    <div className={clsx(
      "mt-14 border-2 border-dashed rounded-2xl relative transition-all duration-500 animate-in fade-in zoom-in-95", // Increased margin, removed overflow-hidden to allow label pop-out
      borderColor,
      isDark ? "bg-blackboard-dark/30" : "bg-stone-50/50"
    )}>
      {/* Header Label - Kept for expanded state context, but ensuring it doesn't block by adding top margin in parent content */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 z-10">
        <span className={clsx("font-hand text-lg font-bold px-3 py-1 rounded shadow-sm border", isDark ? "bg-stone-800 text-emerald-400" : "bg-white text-emerald-600", borderColor)}>
          隨堂練習
        </span>
      </div>

      <div className="p-5 md:p-6 pt-8">
        {/* Question */}
        <div className={clsx("mb-5 text-lg font-hand leading-relaxed", isDark ? "text-chalk-white" : "text-stone-800")}>
           <div className="flex items-start gap-3">
             <span className={clsx("font-bold text-xl shrink-0 mt-[-2px]", isDark ? "text-chalk-yellow" : "text-blue-600")}>Q.</span>
             <div className="w-full">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {practiceQuestion.question}
                </ReactMarkdown>
             </div>
           </div>
        </div>

        {/* Hint (Optional) */}
        {practiceQuestion.hint && !showAnswer && (
          <div className={clsx("mb-5 p-3 rounded-lg text-base font-hand border flex items-start gap-3", isDark ? "bg-yellow-900/20 border-yellow-700/30 text-yellow-100/80" : "bg-yellow-50 border-yellow-200 text-yellow-800")}>
             <Lightbulb size={18} className="shrink-0 mt-1" />
             <div>
               <span className="font-bold opacity-70 block text-xs mb-1 uppercase tracking-wider">Hint</span>
               {practiceQuestion.hint}
             </div>
          </div>
        )}

        {/* Action Button or Answer */}
        <div className="flex flex-col items-center mt-6">
          {!showAnswer ? (
             <button 
               onClick={() => setShowAnswer(true)}
               className={clsx(
                 buttonBase,
                 isDark 
                   ? "bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500" 
                   : "bg-emerald-500 hover:bg-emerald-400 text-white border border-emerald-300"
               )}
             >
               <Eye size={16} />
               <span>查看答案與解析</span>
             </button>
          ) : (
            <div className={clsx(
                "w-full rounded-xl p-5 border-l-4 animate-in fade-in slide-in-from-bottom-4 duration-500", 
                isDark 
                  ? "bg-stone-800/50 border-emerald-500 text-emerald-50" 
                  : "bg-emerald-50/50 border-emerald-400 text-emerald-900"
            )}>
               <h5 className="font-bold mb-2 flex items-center gap-2 opacity-80 text-sm">
                 <CheckCircleIcon />
                 解析
               </h5>
               <div className="text-lg font-hand leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {practiceQuestion.answer}
                  </ReactMarkdown>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};