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
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem('gemini_api_key'));

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
  const [isPracticeLoading, setIsPracticeLoading] = useState(false); // Changed from isGeneratingPractice
  const [isPracticeVisible, setIsPracticeVisible] = useState(false); // Controls UI visibility

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
        // CRITICAL FIX: Remove the onended callback before stopping.
        // This prevents the "auto-next" logic from firing when we manually stop/switch tracks.
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
      const base64Audio = await generateTeacherVoice(apiKey, step.spokenText, voice);
      const audioBuffer = await decodeAudioData(base64Audio);
      audioCacheRef.current.set(index, audioBuffer);
    } catch (err: any) {
      console.error(`Failed to load audio for step ${index}`, err);
      // If we hit a rate limit or quota error, disable audio for this session to prevent spamming
      if (err.status === 429 || (err.message && err.message.includes("429"))) {
         console.warn("Audio generation disabled due to quota limits.");
         isAudioDisabledRef.current = true;
      }
      throw err; 
    }
  };

  const playCurrentStepAudio = async () => {
    // Ensure any previous audio is stopped cleanly without triggering next step
    stopAudio(); 

    if (!steps[currentStepIndex]) return;
    if (isAudioDisabledRef.current) return; // Skip if audio is disabled

    let buffer = audioCacheRef.current.get(currentStepIndex);

    if (!buffer) {
       try {
         // Priority fetch for current step
         if (apiKey) {
            await fetchAudioForStep(steps[currentStepIndex], currentStepIndex, voiceRef.current);
            buffer = audioCacheRef.current.get(currentStepIndex);
         }
       } catch (e) {
         console.error("Could not play audio", e);
         setIsPlaying(false);
         return;
       }
    }

    if (buffer) {
      activeSourceRef.current = playAudio(buffer, () => {
        // MANUAL MODE: Just stop playing when finished, do not auto-advance
        setIsPlaying(false);
      });
    }
  };

  useEffect(() => {
    if (isPlaying && steps.length > 0) {
      playCurrentStepAudio();
    } else {
      stopAudio();
    }
    return () => {
      // Always stop audio on cleanup (unmount or dependency change)
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
    // Clear chat history on new topic
    setChatHistory([]); 
    setIsQAMode(false);
    
    // --- Practice Question Reset & Background Fetch ---
    setPracticeQuestion(null);
    setIsPracticeVisible(false); // Hide the section initially
    setIsPracticeLoading(true); // Start loading state for background process

    audioCacheRef.current.clear();
    voiceRef.current = voice;
    isAudioDisabledRef.current = false; // Reset circuit breaker on new request

    // Kick off Practice Question generation in BACKGROUND (Parallel)
    // We do NOT await this here, allowing the lesson to render first.
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

    try {
      // 1. Generate the explanation steps (Text) - Main Thread
      const generatedSteps = await generateExplanationSteps(apiKey, text, imageBase64);
      
      if (loadingSessionRef.current !== currentSession) return;

      // 2. IMPORTANT: Pre-fetch the first step's audio BEFORE rendering the UI.
      if (generatedSteps.length > 0 && !isAudioDisabledRef.current) {
         try {
           await fetchAudioForStep(generatedSteps[0], 0, voice);
         } catch (e) {
           console.warn("Initial audio fetch failed, but proceeding to show text.", e);
         }
      }

      if (loadingSessionRef.current !== currentSession) return;

      // 3. Now render the steps and stop the spinner
      setSteps(generatedSteps);
      setIsThinking(false);

      if (generatedSteps.length > 0) {
        // 4. BACKGROUND PRE-FETCHING for remaining steps
        (async () => {
          for (let i = 1; i < generatedSteps.length; i++) {
             if (loadingSessionRef.current !== currentSession) break;
             if (isAudioDisabledRef.current) break; // Stop fetching if quota exceeded

             // Wait 7 seconds between background requests to avoid 429 errors
             await new Promise(resolve => setTimeout(resolve, 7000));
             
             if (loadingSessionRef.current !== currentSession) break;
             if (isAudioDisabledRef.current) break;

             if (!audioCacheRef.current.has(i)) {
               try {
                 await fetchAudioForStep(generatedSteps[i], i, voice); 
               } catch (e) {
                 console.warn(`Background fetch for step ${i} failed. Will retry when reached.`);
               }
             }
          }
        })();
      }
    } catch (error) {
      console.error("Error generating content:", error);
      setIsThinking(false);
    }
  };

  const handleQASend = async (text: string) => {
    if (!apiKey) return;
    
    // Add User Message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: text,
      timestamp: Date.now()
    };
    setChatHistory(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
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

  // When user clicks the "AI 出題" button
  const handleShowPractice = () => {
     setIsPracticeVisible(true);
     // If it failed or is null but not loading, we might want to retry?
     // For now, assume background fetch works or is pending.
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
        // Fullscreen Logic:
        // If Fullscreen: Fixed to inset-0 (full viewport), high Z-index.
        // If Normal: Standard mobile height or desktop flex.
        isFullscreen 
          ? "fixed inset-0 z-50 h-[100dvh] w-full bg-inherit" 
          : "h-[38dvh] md:h-auto md:flex-1"
      )}>
        
        {/* Floating Header Controls */}
        <div className="absolute top-0 left-0 right-0 p-2 md:p-6 flex justify-between items-start z-30 pointer-events-none">
           {/* Title Badge - Hidden on very small screens if needed, but generally okay */}
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

           {/* Top Right Action Buttons */}
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

             {/* Fullscreen Toggle */}
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

        {/* Floating Player Controls (Only visible in Fullscreen mode when there are steps) */}
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

      {/* --- RIGHT COLUMN: Sidebar (Controls & Input & Chat) --- */}
      {/* Hidden when in fullscreen mode */}
      <aside className={clsx(
        "w-full md:w-[340px] xl:w-[380px] border-l flex flex-col shrink-0 shadow-2xl z-40 order-2",
        "h-[62dvh] md:h-full overflow-hidden transition-all duration-300",
        isDark ? "bg-stone-900 border-stone-800" : "bg-white border-stone-200",
        isFullscreen && "hidden"
      )}>
         
         {/* -- View: Standard Lesson Mode -- */}
         {!isQAMode && (
           <>
             <div className={clsx(
               "border-b shrink-0 transition-colors",
               "p-2 md:p-4", // Smaller padding on mobile
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
               // Flex-1 allows it to take remaining height.
               "flex-1 overflow-y-auto custom-scrollbar min-h-0 transition-colors",
               // Bottom padding ensures input doesn't overlap last item
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

         {/* -- View: QA Mode -- */}
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
              由 Google Gemini 3 Flash 與 Web Audio API 強力驅動
            </footer>
         </div>
      </aside>

    </div>
  );
};

export default App;