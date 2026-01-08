import React, { useState } from 'react';
import { KeyRound, ArrowRight, BookOpen, Loader2 } from 'lucide-react';
import { validateApiKey } from '../services/geminiService';

interface LoginScreenProps {
  onLogin: (apiKey: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) {
      setError('請輸入 API Key');
      return;
    }
    
    // Simple length check for Gemini keys (usually starts with AIza, but avoiding strict prefix to be future proof)
    if (key.length < 20) {
       setError('API Key 格式似乎不正確');
       return;
    }

    setIsChecking(true);
    setError('');

    try {
      // Validate the key against the actual API
      const isValid = await validateApiKey(key.trim());
      
      if (isValid) {
        onLogin(key.trim());
      } else {
        setError('驗證失敗：API Key 無效或帳戶額度不足');
      }
    } catch (err) {
      setError('連線錯誤，請檢查網路狀態');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-stone-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
       {/* Background Elements */}
       <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[100px]"></div>
       </div>

       <div className="max-w-md w-full bg-stone-900/80 backdrop-blur-xl border border-stone-800 rounded-3xl shadow-2xl p-8 relative z-10">
          <div className="flex flex-col items-center mb-8">
             <div className="p-4 bg-emerald-500/10 rounded-2xl mb-4 border border-emerald-500/20 text-emerald-400">
                <BookOpen size={40} />
             </div>
             <h1 className="text-3xl font-bold text-stone-100 mb-2 tracking-tight">AI 智慧黑板老師</h1>
             <p className="text-stone-500 text-sm text-center">
               請輸入您的 Gemini API Key 以開始課程
             </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-2">
               <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">API Key</label>
               <div className="relative">
                 <input 
                    type="password" 
                    value={key}
                    onChange={(e) => {
                      setKey(e.target.value);
                      setError('');
                    }}
                    placeholder="AIza..."
                    disabled={isChecking}
                    className="w-full bg-stone-950/50 border border-stone-700 rounded-xl p-4 pl-12 text-stone-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-stone-700 font-mono text-sm disabled:opacity-50"
                 />
                 <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" size={18} />
               </div>
               {error && <p className="text-red-400 text-xs ml-1">{error}</p>}
            </div>

            <button 
              type="submit"
              disabled={isChecking}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-700 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 group mt-2"
            >
               {isChecking ? (
                 <>
                   <Loader2 size={18} className="animate-spin" />
                   <span>驗證中...</span>
                 </>
               ) : (
                 <>
                   <span>進入教室</span>
                   <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                 </>
               )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-stone-800 text-center">
             <a 
               href="https://aistudio.google.com/app/apikey" 
               target="_blank" 
               rel="noopener noreferrer"
               className="text-xs text-stone-500 hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
             >
               還沒有 API Key? 前往 Google AI Studio 取得
             </a>
          </div>
       </div>
    </div>
  );
};