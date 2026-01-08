import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Eraser, LogOut, Sun, Moon, Maximize2, Minimize2 } from 'lucide-react';
import { Blackboard } from './components/Blackboard';
import { PlayerControls } from './components/PlayerControls';
import { InputSection } from './components/InputSection';
import { StepList } from './components/StepList';
import { LoginScreen } from './components/LoginScreen';
import { ChatPanel } from './components/ChatPanel';
import { ExplanationStep, ChatMessage, MessageRole, PracticeQuestion } from './types';
import { resumeAudioContext, decodeAudioData, playAudio } from './services/audioUtils';
import { 
  generateExplanationSteps, 
  generateTeacherVoice, 
  generateChatResponse, 
  generatePracticeQuestion 
} from './services/geminiService';
import clsx from 'clsx';

const App = () => {
  // --- Auth State ---
  // Priority: 
  // 1. Environment Variable (Vercel Setting)
  // 2. Local Storage (User previous input)
  const [apiKey, setApiKey] = useState<string | null>(() => {
    // Check for VITE_ prefixed environment variable
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (envKey) return envKey;
    
    return localStorage.getItem('gemini_api_key');
  });

  // --- App State ---
  const [steps, setSteps] = useState<ExplanationStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // --- Chat/QA State ---
  const [isQAMode, setIsQAMode] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  
  // --- Practice Question State ---
  const [practiceQuestion, setPracticeQuestion] = useState<PracticeQuestion | null>(null);
  const [isPracticeLoading, setIsPracticeLoading] = useState(false); 
  const [isPracticeVisible, setIsPracticeVisible] = useState(false); 

  const isDark = theme === 'dark';

  // --- Refs for Audio Management ---
  const audioCacheRef = useRef<Map<number, AudioBuffer>>(new Map());
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const voiceRef = useRef<string>('Kore');
  const isAudioDisabledRef = useRef(false); // Circuit breaker for 429 errors
  
  // Track the current generation session to prevent stale async tasks
  const loadingSessionRef = useRef(0);

  // --- Core Logic ---

  const handleLogin = (key: string) => {
    localStorage.setItem('gemini_api_key', key);
    setApiKey(key);
    // Reset states on login
    setSteps([]);
    setCurrentStepIndex(0);
    isAudioDisabledRef.current = false;
  };

  const handleLogout = () => {
    stopAudio();
    localStorage.removeItem('gemini_api_key');
    // If env key exists, logout effectively just resets the view but stays logged in
    // unless we strictly enforce null. But for user experience, let's allow re-login manually if they want.
    if ((import.meta as any).env?.VITE_GEMINI_API_KEY) {
      alert("您目前使用系統預設 Key，重新整理頁面將會自動登入。");
    }
    setApiKey(null);
    setSteps([]);
    setCurrentStepIndex(0);
    setChatHistory([]);
    setIsQAMode(false);
    setPracticeQuestion(null);
    setIsPracticeVisible(false);
    audioCacheRef.current.clear();
  };

  const stopAudio = () => {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.onended = null;
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch (e) { }
      activeSourceRef.current = null;
    }
  };

  const fetchAudioForStep = async (step: ExplanationStep, index: number, voice: string) => {
    if (!apiKey || isAudioDisabledRef.current) return;
    if (audioCacheRef.current.has(index)) return; 
    
    try {
      // STRICT: Pass apiKey explicitly as first argument
      const base64Audio = await generateTeacherVoice(apiKey, step.spokenText, voice);
      
      // Handle potential undefined return if no audio was generated
      if (base64Audio) {
        const audioBuffer = await decodeAudioData(base64Audio);
        audioCacheRef.current.set(index, audioBuffer);
      }
    } catch (err: any) {
      if (err.message === "QUOTA_EXCEEDED" || err.status === 429 || (err.message && err.message.includes("429"))) {
         console.warn(`Audio quota exceeded at step ${index}. Disabling audio for this session.`);
         isAudioDisabledRef.current = true;
      } else {
         console.error(`Failed to load audio for step ${index}`, err);
      }
      throw err; 
    }
  };

  const playCurrentStepAudio = async () => {
    stopAudio(); 

    if (!steps[currentStepIndex]) return;
    if (isAudioDisabledRef.current) return; 

    let buffer = audioCacheRef.current.get(currentStepIndex);

    if (!buffer) {
       try {
         if (apiKey) {
            await fetchAudioForStep(steps[currentStepIndex], currentStepIndex, voiceRef.current);
            buffer = audioCacheRef.current.get(currentStepIndex);
         }
       } catch (e) {
         setIsPlaying(false);
         return;
       }
    }

    if (buffer) {
      activeSourceRef.current = playAudio(buffer, () => {
        setIsPlaying(false);
      });
      
      const nextIndex = currentStepIndex + 1;
      if (nextIndex < steps.length && !audioCacheRef.current.has(nextIndex) && !isAudioDisabledRef.current) {
        fetchAudioForStep(steps[nextIndex], nextIndex, voiceRef.current).catch(e => {
            console.debug(`Lazy pre-fetch for step ${nextIndex} failed or skipped.`);
        });
      }
    }
  };

  useEffect(() => {
    if (isPlaying && steps.length > 0) {
      playCurrentStepAudio();
    } else {
      stopAudio();
    }
    return () => {
      stopAudio(); 
    };
  }, [currentStepIndex, isPlaying]);


  // --- Event Handlers ---

  const handleSend = async (text: string, imageBase64: string | null, voice: string) => {
    if (!apiKey) return;
    
    // BRANCH: If in QA Mode, handle as chat message
    if (isQAMode) {
       await handleQASend(text);
       return;
    }

    // BRANCH: Standard Lesson Mode
    await resumeAudioContext();
    stopAudio();
    
    loadingSessionRef.current += 1;
    const currentSession = loadingSessionRef.current;

    setIsThinking(true);
    setSteps([]);
    setCurrentStepIndex(0);
    setIsPlaying(false);
    setChatHistory([]); 
    setIsQAMode(false);
    
    setPracticeQuestion(null);
    setIsPracticeVisible(false); 
    setIsPracticeLoading(true); 

    audioCacheRef.current.clear();
    voiceRef.current = voice;
    isAudioDisabledRef.current = false; 

    try {
      // 1. Generate Explanation - Pass apiKey first
      // Note: we convert null to undefined to match strict signature if needed, or rely on JS flexibility
      const safeImage = imageBase64 === null ? undefined : imageBase64;
      const generatedSteps = await generateExplanationSteps(apiKey, text, safeImage);
      
      if (loadingSessionRef.current !== currentSession) return;

      if (generatedSteps.length > 0 && !isAudioDisabledRef.current) {
         try {
           await fetchAudioForStep(generatedSteps[0], 0, voice);
         } catch (e) {
           console.warn("Initial audio fetch failed. Switching to text-only mode.");
         }
      }

      if (loadingSessionRef.current !== currentSession) return;

      setSteps(generatedSteps);
      setIsThinking(false);

      // 4. Generate Practice - Pass apiKey first
      generatePracticeQuestion(apiKey, text)
        .then((data) => {
           if (loadingSessionRef.current === currentSession) {
              setPracticeQuestion(data);
              setIsPracticeLoading(false);
           }
        })
        .catch((err) => {
           console.warn("Background practice generation failed:", err);
           if (loadingSessionRef.current === currentSession) {
              setIsPracticeLoading(false);
           }
        });
      
    } catch (error) {
      console.error("Error generating content:", error);
      setIsThinking(false);
      setIsPracticeLoading(false);
    }
  };

  const handleQASend = async (text: string) => {
    if (!apiKey) return;
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: text,
      timestamp: Date.now()
    };
    setChatHistory(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      // Pass apiKey first
      const answer = await generateChatResponse(apiKey, chatHistory, steps, text);
      
      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.MODEL,
        content: answer,
        timestamp: Date.now()
      };
      setChatHistory(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error("Chat Error", error);
      const errorMsg: ChatMessage = {
         id: (Date.now() + 1).toString(),
         role: MessageRole.SYSTEM,
         content: "抱歉，發生錯誤，請稍後再試。",
         timestamp: Date.now()
      };
      setChatHistory(prev => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleShowPractice = () => {
     setIsPracticeVisible(true);
  };

  const handleNext = (isAutoAdvance = false) => {
    setCurrentStepIndex(prev => {
      if (prev < steps.length - 1) {
        return prev + 1;
      } else {
        if (isAutoAdvance) setIsPlaying(false);
        return prev;
      }
    });
  };

  const handlePrev = () => {
    setCurrentStepIndex(prev => (prev > 0 ? prev - 1 : prev));
  };

  const handleStepJump = (index: number, shouldPlay: boolean = false) => {
    setCurrentStepIndex(index);
    setIsPlaying(shouldPlay);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleClear = () => {
    stopAudio();
    loadingSessionRef.current += 1;
    setSteps([]);
    setCurrentStepIndex(0);
    setIsPlaying(false);
    setChatHistory([]);
    setIsQAMode(false);
    setPracticeQuestion(null);
    setIsPracticeVisible(false);
    setIsPracticeLoading(false);
    audioCacheRef.current.clear();
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // --- Render Login Screen if no API Key ---
  if (!apiKey) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className={clsx(
      "flex flex-col md:flex-row h-[100dvh] w-full font-sans overflow-hidden transition-colors duration-300",
      isDark ? "bg-stone-950 text-stone-100" : "bg-stone-50 text-stone-900"
    )}>
      
      {/* --- LEFT COLUMN: Blackboard Display --- */}
      <main className={clsx(
        "flex flex-col min-w-0 min-h-0 relative order-1 transition-all duration-300",
        isFullscreen 
          ? "fixed inset-0 z-50 h-[100dvh] w-full bg-inherit" 
          : "h-[38dvh] md:h-auto md:flex-1"
      )}>
        
        {/* Floating Header Controls */}
        <div className="absolute top-0 left-0 right-0 p-2 md:p-6 flex justify-between items-start z-30 pointer-events-none">
           <div className={clsx(
             "backdrop-blur-md p-1.5 pr-3 md:p-2 md:pr-4 rounded-full border shadow-2xl flex items-center gap-2 md:gap-3 pointer-events-auto transition-colors transform scale-90 md:scale-100 origin-top-left",
             isDark ? "bg-stone-900/90 border-stone-800" : "bg-white/90 border-stone-200"
           )}>
              <div className="p-1.5 md:p-2 bg-emerald-600/20 rounded-full text-emerald-500 border border-emerald-500/20">
                 <BookOpen size={16} className="md:w-5 md:h-5" />
               </div>
               <h1 className={clsx("font-bold hidden sm:block tracking-wide text-sm md:text-base", isDark ? "text-stone-200" : "text-stone-700")}>
                 AI 智慧{isDark ? '黑板' : '白板'}老師
               </h1>
           </div>

           <div className="flex items-center gap-2 pointer-events-auto transform scale-90 md:scale-100 origin-top-right">
             <button
               onClick={toggleTheme}
               className={clsx(
                 "backdrop-blur-md p-2 rounded-full border shadow-2xl transition-all flex items-center justify-center group",
                 isDark 
                   ? "bg-stone-900/90 border-stone-800 text-amber-400 hover:bg-stone-800" 
                   : "bg-white/90 border-stone-200 text-indigo-500 hover:bg-gray-50"
               )}
               title={isDark ? "切換至淺色模式" : "切換至深色模式"}
             >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
             </button>

             <button
               onClick={toggleFullscreen}
               className={clsx(
                 "backdrop-blur-md p-2 rounded-full border shadow-2xl transition-all flex items-center justify-center group",
                 isDark 
                   ? "bg-stone-900/90 border-stone-800 text-emerald-400 hover:bg-stone-800" 
                   : "bg-white/90 border-stone-200 text-emerald-600 hover:bg-gray-50"
               )}
               title={isFullscreen ? "離開全螢幕" : "全螢幕模式"}
             >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
             </button>

             {!isFullscreen && (
               <>
                 <button 
                   onClick={handleClear} 
                   className={clsx(
                     "backdrop-blur-md p-2 px-3 md:px-4 rounded-full border shadow-2xl transition-all flex items-center gap-2 group",
                     isDark 
                      ? "bg-stone-900/90 border-stone-800 text-stone-400 hover:text-white hover:bg-stone-800" 
                      : "bg-white/90 border-stone-200 text-stone-500 hover:text-stone-900 hover:bg-gray-50"
                   )}
                   title="清除"
                 >
                    <Eraser size={18} className="group-hover:rotate-12 transition-transform" />
                    <span className="text-sm font-medium hidden sm:inline">清除</span>
                 </button>

                 <button 
                   onClick={handleLogout} 
                   className={clsx(
                     "backdrop-blur-md p-2 rounded-full border shadow-2xl transition-all flex items-center justify-center group",
                     isDark 
                      ? "bg-stone-900/90 border-stone-800 text-stone-500 hover:text-red-400 hover:bg-stone-800" 
                      : "bg-white/90 border-stone-200 text-stone-400 hover:text-red-500 hover:bg-gray-50"
                   )}
                   title="登出"
                 >
                    <LogOut size={18} />
                 </button>
               </>
             )}
           </div>
        </div>

        <div className="flex-1 min-h-0 p-2 md:p-3 flex flex-col pt-14 md:pt-4">
           <Blackboard 
             steps={steps} 
             currentStepIndex={currentStepIndex} 
             isThinking={isThinking} 
             isDark={isDark}
             onRaiseHand={() => setIsQAMode(true)}
             isQAMode={isQAMode}
             practiceQuestion={practiceQuestion}
             isPracticeLoading={isPracticeLoading}
             isPracticeVisible={isPracticeVisible}
             onShowPractice={handleShowPractice}
           />
        </div>

        {isFullscreen && steps.length > 0 && (
           <div className="absolute bottom-6 left-4 right-4 z-40 animate-in fade-in slide-in-from-bottom-4">
               <PlayerControls 
                  isPlaying={isPlaying}
                  onPlayPause={handlePlayPause}
                  onNext={() => handleNext(false)}
                  onPrev={handlePrev}
                  currentStep={currentStepIndex}
                  totalSteps={steps.length}
                  isDark={isDark}
               />
           </div>
        )}
      </main>

      <aside className={clsx(
        "w-full md:w-[340px] xl:w-[380px] border-l flex flex-col shrink-0 shadow-2xl z-40 order-2",
        "h-[62dvh] md:h-full overflow-hidden transition-all duration-300",
        isDark ? "bg-stone-900 border-stone-800" : "bg-white border-stone-200",
        isFullscreen && "hidden"
      )}>
         
         {!isQAMode && (
           <>
             <div className={clsx(
               "border-b shrink-0 transition-colors",
               "p-2 md:p-4", 
               isDark ? "border-stone-800 bg-stone-900/95" : "border-stone-200 bg-white/95"
             )}>
                {steps.length > 0 ? (
                   <PlayerControls 
                      isPlaying={isPlaying}
                      onPlayPause={handlePlayPause}
                      onNext={() => handleNext(false)}
                      onPrev={handlePrev}
                      currentStep={currentStepIndex}
                      totalSteps={steps.length}
                      isDark={isDark}
                   />
                ) : (
                   <div className={clsx(
                     "h-[50px] md:h-[60px] flex items-center justify-center text-xs md:text-sm italic border border-dashed rounded-xl",
                     isDark ? "text-stone-600 border-stone-800 bg-stone-900/50" : "text-stone-400 border-stone-300 bg-stone-50"
                   )}>
                      等待課程開始...
                   </div>
                )}
             </div>

             <div className={clsx(
               "flex-1 overflow-y-auto custom-scrollbar min-h-0 transition-colors",
               "p-3 md:p-4 pb-20 md:pb-32",
               isDark ? "bg-stone-900/50" : "bg-stone-50/50"
             )}>
                <StepList 
                  steps={steps} 
                  currentStepIndex={currentStepIndex} 
                  onStepClick={handleStepJump}
                  isDark={isDark}
                  isPlaying={isPlaying}
                />
             </div>
           </>
         )}

         {isQAMode && (
            <div className="flex-1 flex flex-col min-h-0">
               <ChatPanel 
                  history={chatHistory} 
                  onClose={() => setIsQAMode(false)}
                  isDark={isDark}
                  isThinking={isThinking}
               />
            </div>
         )}

         <div className={clsx(
           "p-3 md:p-4 border-t shrink-0 pb-safe transition-colors z-20",
           isDark ? "bg-stone-900 border-stone-800" : "bg-white border-stone-200"
         )}>
            <InputSection 
               onSend={handleSend} 
               isProcessing={isThinking} 
               isDark={isDark} 
               isQAMode={isQAMode}
            />
            <footer className={clsx("mt-3 text-center text-[10px] hidden md:block", isDark ? "text-stone-600" : "text-stone-400")}>
              Powered by Google Gemini 3 Flash & Web Audio API
            </footer>
         </div>
      </aside>

    </div>
  );
};

export default App;