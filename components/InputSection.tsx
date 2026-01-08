import React, { useState, useRef } from 'react';
import { Send, Image as ImageIcon, X, Mic } from 'lucide-react';
import clsx from 'clsx';

interface InputSectionProps {
  onSend: (text: string, imageBase64: string | null, voice: string) => void;
  isProcessing: boolean;
  isDark: boolean;
  isQAMode?: boolean;
}

// Updated voice list with 5 distinct options and clearer descriptions
const VOICES = [
  { id: 'Kore', name: '👩‍🏫 溫柔的女老師 (Kore)' },
  { id: 'Zephyr', name: '👩‍🔬 知性的女老師 (Zephyr)' },
  { id: 'Fenrir', name: '👨‍🏫 沉穩的男老師 (Fenrir)' },
  { id: 'Puck', name: '🙋‍♂️ 活潑的男老師 (Puck)' },
  { id: 'Charon', name: '🧔 磁性的男老師 (Charon)' },
];

export const InputSection: React.FC<InputSectionProps> = ({ onSend, isProcessing, isDark, isQAMode = false }) => {
  const [input, setInput] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = () => {
    if (!input.trim() && !selectedImage) return;
    onSend(input, selectedImage, selectedVoice);
    setInput('');
    setSelectedImage(null);
  };

  const placeholderText = isProcessing 
    ? (isQAMode ? "老師正在回答..." : "老師正在思考中...") 
    : (isQAMode ? "針對目前的步驟提問..." : "輸入問題 (支援圖片)...");

  return (
    <div className="flex flex-col gap-3">
      {/* Image Preview */}
      {selectedImage && (
        <div className="relative group self-start">
          <img src={selectedImage} alt="Upload preview" className="h-16 md:h-20 rounded-lg border border-stone-700 shadow-md object-cover" />
          <button 
            onClick={() => setSelectedImage(null)}
            className="absolute -top-2 -right-2 bg-stone-800 text-stone-400 border border-stone-600 rounded-full p-1 shadow hover:bg-red-900/80 hover:text-white hover:border-red-500 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="relative">
        <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={placeholderText}
            disabled={isProcessing}
            className={clsx(
              "w-full text-sm rounded-xl border p-3 pr-12 resize-none focus:outline-none focus:ring-1 min-h-[60px] md:min-h-[80px] font-sans disabled:opacity-50 shadow-inner transition-colors",
              isDark 
                ? "bg-stone-950 text-stone-200 border-stone-800 focus:border-emerald-600/50 focus:ring-emerald-900/50 placeholder:text-stone-600" 
                : "bg-white text-stone-800 border-stone-200 focus:border-emerald-500/50 focus:ring-emerald-200 placeholder:text-stone-400"
            )}
        />
        
        {/* Send Button Absolute */}
        <button 
            onClick={handleSend}
            disabled={isProcessing || (!input.trim() && !selectedImage)}
            className={clsx(
               "absolute right-2 bottom-2 text-white p-2 rounded-lg transition-all shadow-lg flex items-center justify-center",
               isQAMode 
                 ? "bg-blue-600 hover:bg-blue-500 disabled:bg-stone-500/50" 
                 : "bg-emerald-700 hover:bg-emerald-600 disabled:bg-stone-500/50"
            )}
        >
            <Send size={18} />
        </button>
      </div>

      {/* Toolbar - Only show Image/Voice in non-QA mode (or simplify for QA) */}
      {!isQAMode && (
        <div className="flex items-center justify-between gap-2">
           <div className="flex items-center gap-2 shrink-0">
              <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload}
              />
              <button 
                  onClick={() => fileInputRef.current?.click()}
                  className={clsx(
                    "p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium",
                    isDark 
                      ? "text-stone-400 hover:text-emerald-400 hover:bg-stone-800" 
                      : "text-stone-500 hover:text-emerald-600 hover:bg-stone-100"
                  )}
                  title="上傳圖片"
              >
                  <ImageIcon size={16} />
                  <span className="hidden xs:inline">圖片</span>
              </button>
           </div>

           {/* Voice Selector - Use Flex-1 to fill remaining space properly on mobile */}
           <div className={clsx(
             "flex items-center gap-2 rounded-lg p-1 border flex-1 min-w-0 transition-colors",
             isDark ? "bg-stone-950 border-stone-800" : "bg-white border-stone-200"
           )}>
               <span className="text-[10px] text-stone-500 px-1 uppercase font-bold tracking-wider shrink-0 hidden sm:inline">Voice</span>
               <select 
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className={clsx(
                    "bg-transparent text-xs outline-none cursor-pointer transition-colors py-1 pl-1 w-full text-ellipsis",
                    isDark ? "text-stone-300 hover:text-emerald-400" : "text-stone-700 hover:text-emerald-600"
                  )}
               >
                  {VOICES.map(v => (
                    <option key={v.id} value={v.id} className={isDark ? "bg-stone-900" : "bg-white"}>
                      {v.name}
                    </option>
                  ))}
               </select>
           </div>
        </div>
      )}
    </div>
  );
};