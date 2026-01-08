import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Bot, User, X } from 'lucide-react';
import clsx from 'clsx';
import { ChatMessage, MessageRole } from '../types';

interface ChatPanelProps {
  history: ChatMessage[];
  onClose: () => void;
  isDark: boolean;
  isThinking: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ history, onClose, isDark, isThinking }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isThinking]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className={clsx(
        "flex items-center justify-between p-4 border-b shrink-0",
        isDark ? "border-stone-800 bg-stone-900/95" : "border-stone-200 bg-white/95"
      )}>
        <h3 className={clsx("font-bold flex items-center gap-2", isDark ? "text-emerald-400" : "text-emerald-700")}>
          <Bot size={20} />
          <span>課堂問答</span>
        </h3>
        <button 
          onClick={onClose}
          className={clsx(
            "p-1.5 rounded-full transition-colors",
            isDark ? "hover:bg-stone-800 text-stone-400" : "hover:bg-stone-100 text-stone-500"
          )}
        >
          <X size={20} />
        </button>
      </div>

      {/* Message List */}
      <div className={clsx(
        "flex-1 overflow-y-auto p-4 custom-scrollbar",
        isDark ? "bg-stone-900/50" : "bg-stone-50/50"
      )}>
        {history.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 opacity-50">
            <Bot size={48} className="mb-4" />
            <p className="text-sm">對目前的步驟有疑問嗎？<br/>隨時舉手發問！</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {history.map((msg) => (
              <div 
                key={msg.id} 
                className={clsx(
                  "flex gap-3 max-w-[90%]",
                  msg.role === MessageRole.USER ? "self-end flex-row-reverse" : "self-start"
                )}
              >
                <div className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                  msg.role === MessageRole.USER 
                    ? (isDark ? "bg-stone-700" : "bg-stone-200") 
                    : "bg-emerald-600"
                )}>
                  {msg.role === MessageRole.USER ? <User size={14} /> : <Bot size={14} className="text-white" />}
                </div>
                
                <div className={clsx(
                  "p-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                  msg.role === MessageRole.USER 
                    ? (isDark ? "bg-stone-800 text-stone-100 rounded-tr-none" : "bg-white text-stone-800 border border-stone-200 rounded-tr-none")
                    : (isDark ? "bg-emerald-900/30 text-emerald-100 border border-emerald-500/20 rounded-tl-none" : "bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-tl-none")
                )}>
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                       p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            
            {isThinking && (
              <div className="self-start flex gap-3 max-w-[85%]">
                 <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 mt-1">
                    <Bot size={14} className="text-white" />
                 </div>
                 <div className={clsx(
                    "p-3 rounded-2xl rounded-tl-none flex items-center gap-2",
                    isDark ? "bg-emerald-900/30 border border-emerald-500/20" : "bg-emerald-50 border border-emerald-200"
                 )}>
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce delay-100"></div>
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce delay-200"></div>
                 </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
};