import React, { useState, useRef } from 'react';
import { Send, Image as ImageIcon, X, Mic } from 'lucide-react';

interface InputSectionProps {
  onSend: (text: string, imageBase64: string | null, voice: string) => void;
  isProcessing: boolean;
}

const VOICES = [
  { id: 'Kore', name: 'Kore 老師' },
  { id: 'Fenrir', name: 'Fenrir 老師' },
  { id: 'Puck', name: 'Puck 老師' },
  { id: 'Charon', name: 'Charon 老師' },
];

export const InputSection: React.FC<InputSectionProps> = ({ onSend, isProcessing }) => {
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

  return (
    <div className="flex flex-col gap-3">
      {/* Image Preview */}
      {selectedImage && (
        <div className="relative group self-start">
          <img src={selectedImage} alt="Upload preview" className="h-20 rounded-lg border border-stone-700 shadow-md object-cover" />
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
            placeholder={isProcessing ? "老師正在思考中..." : "輸入問題..."}
            disabled={isProcessing}
            className="w-full bg-stone-950 text-stone-200 text-sm rounded-xl border border-stone-800 p-3 pr-12 resize-none focus:outline-none focus:border-emerald-600/50 focus:ring-1 focus:ring-emerald-900/50 min-h-[80px] font-sans disabled:opacity-50 placeholder:text-stone-600 shadow-inner"
        />
        
        {/* Send Button Absolute */}
        <button 
            onClick={handleSend}
            disabled={isProcessing || (!input.trim() && !selectedImage)}
            className="absolute right-2 bottom-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-stone-800 disabled:text-stone-600 text-white p-2 rounded-lg transition-all shadow-lg flex items-center justify-center"
        >
            <Send size={18} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
         <div className="flex items-center gap-2">
            <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageUpload}
            />
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-stone-400 hover:text-emerald-400 hover:bg-stone-800 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium"
                title="上傳圖片"
            >
                <ImageIcon size={16} />
                <span className="hidden xs:inline">圖片</span>
            </button>
         </div>

         <div className="flex items-center gap-2 bg-stone-950 rounded-lg p-1 border border-stone-800">
             <span className="text-[10px] text-stone-500 px-1 uppercase font-bold tracking-wider">Voice</span>
             <select 
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="bg-transparent text-stone-300 text-xs outline-none cursor-pointer hover:text-emerald-400 transition-colors py-1"
             >
                {VOICES.map(v => <option key={v.id} value={v.id} className="bg-stone-900">{v.name}</option>)}
             </select>
         </div>
      </div>
    </div>
  );
};
