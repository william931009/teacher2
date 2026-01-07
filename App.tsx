import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Eraser } from 'lucide-react';
import { Blackboard } from './components/Blackboard';
import { PlayerControls } from './components/PlayerControls';
import { InputSection } from './components/InputSection';
import { StepList } from './components/StepList';
import { ExplanationStep } from './types';
import { resumeAudioContext, decodeAudioData, playAudio } from './services/audioUtils';
import { generateExplanationSteps, generateTeacherVoice } from './services/geminiService';

const App = () => {
  // --- State ---
  const [steps, setSteps] = useState<ExplanationStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // --- Refs for Audio Management ---
  const audioCacheRef = useRef<Map<number, AudioBuffer>>(new Map());
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const voiceRef = useRef<string>('Kore');
  
  // Track the current generation session to prevent stale async tasks
  const loadingSessionRef = useRef(0);

  // --- Core Logic ---

  const stopAudio = () => {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch (e) { }
      activeSourceRef.current = null;
    }
  };

  const fetchAudioForStep = async (step: ExplanationStep, index: number, voice: string) => {
    if (audioCacheRef.current.has(index)) return; 
    try {
      const base64Audio = await generateTeacherVoice(step.spokenText, voice);
      const audioBuffer = await decodeAudioData(base64Audio);
      audioCacheRef.current.set(index, audioBuffer);
    } catch (err) {
      console.error(`Failed to load audio for step ${index}`, err);
    }
  };

  const playCurrentStepAudio = async () => {
    stopAudio(); 

    if (!steps[currentStepIndex]) return;

    let buffer = audioCacheRef.current.get(currentStepIndex);

    if (!buffer) {
       try {
         await fetchAudioForStep(steps[currentStepIndex], currentStepIndex, voiceRef.current);
         buffer = audioCacheRef.current.get(currentStepIndex);
       } catch (e) {
         console.error("Could not play audio", e);
         // If audio fails, we might want to just stay on the step or auto-advance after a delay
         // For now, let's just stop playing
         setIsPlaying(false);
         return;
       }
    }

    if (buffer) {
      activeSourceRef.current = playAudio(buffer, () => {
        setIsPlaying(prevIsPlaying => {
          if (prevIsPlaying) {
             handleNext(true); 
             return true; 
          }
          return false;
        });
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
      if (!isPlaying) stopAudio(); 
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex, isPlaying]);


  // --- Event Handlers ---

  const handleSend = async (text: string, imageBase64: string | null, voice: string) => {
    await resumeAudioContext();
    stopAudio();
    
    // Increment session ID to cancel any pending background fetches from previous runs
    loadingSessionRef.current += 1;
    const currentSession = loadingSessionRef.current;

    setIsThinking(true);
    setSteps([]);
    setCurrentStepIndex(0);
    setIsPlaying(false);
    audioCacheRef.current.clear();
    voiceRef.current = voice;

    try {
      const generatedSteps = await generateExplanationSteps(text, imageBase64);
      
      // If session changed while generating (user clicked send again), abort
      if (loadingSessionRef.current !== currentSession) return;

      setSteps(generatedSteps);
      setIsThinking(false);

      if (generatedSteps.length > 0) {
        setIsPlaying(true); 
        
        // Fetch the first step immediately so playback starts quickly
        try {
           await fetchAudioForStep(generatedSteps[0], 0, voice);
        } catch (e) {
           console.error("Failed to fetch first audio", e);
        }

        // Fetch remaining steps in the background sequentially with a delay
        // This prevents "500 Internal Error" from flooding the API with too many concurrent requests
        (async () => {
          for (let i = 1; i < generatedSteps.length; i++) {
             // Check if session is still valid
             if (loadingSessionRef.current !== currentSession) break;
             
             // Add a small delay between requests to be gentle on the API
             await new Promise(resolve => setTimeout(resolve, 1000));
             
             if (loadingSessionRef.current !== currentSession) break;

             await fetchAudioForStep(generatedSteps[i], i, voice); 
          }
        })();
      }
    } catch (error) {
      console.error("Error generating content:", error);
      setIsThinking(false);
    }
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

  const handleStepJump = (index: number) => {
    setCurrentStepIndex(index);
    setIsPlaying(true); // Auto play when clicking a step
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleClear = () => {
    stopAudio();
    loadingSessionRef.current += 1; // Invalidate any pending fetches
    setSteps([]);
    setCurrentStepIndex(0);
    setIsPlaying(false);
    audioCacheRef.current.clear();
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-stone-950 font-sans text-stone-100 overflow-hidden">
      
      {/* --- LEFT COLUMN: Blackboard Display --- */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative order-1 md:order-1">
        
        {/* Floating Header (Desktop & Mobile) */}
        <div className="absolute top-0 left-0 right-0 p-3 md:p-6 flex justify-between items-start z-30 pointer-events-none">
           {/* Logo */}
           <div className="bg-stone-900/90 backdrop-blur-md p-2 pr-4 rounded-full border border-stone-800 shadow-2xl flex items-center gap-3 pointer-events-auto">
              <div className="p-2 bg-emerald-600/20 rounded-full text-emerald-400 border border-emerald-500/20">
                 <BookOpen size={20} />
               </div>
               <h1 className="font-bold text-stone-200 hidden sm:block tracking-wide">AI 智慧黑板老師</h1>
           </div>

           {/* Clear Button */}
           <button 
             onClick={handleClear} 
             className="pointer-events-auto bg-stone-900/90 backdrop-blur-md p-2 px-4 rounded-full border border-stone-800 shadow-2xl text-stone-400 hover:text-white hover:bg-stone-800 transition-all flex items-center gap-2 group"
             title="清除黑板"
           >
              <Eraser size={18} className="group-hover:rotate-12 transition-transform" />
              <span className="text-sm font-medium hidden sm:inline">清除</span>
           </button>
        </div>

        {/* Blackboard Component - Full Size */}
        <div className="flex-1 p-2 md:p-4 h-full flex flex-col pt-16 md:pt-4">
           <Blackboard 
             steps={steps} 
             currentStepIndex={currentStepIndex} 
             isThinking={isThinking} 
           />
        </div>
      </main>

      {/* --- RIGHT COLUMN: Sidebar (Controls & Input) --- */}
      <aside className="w-full md:w-[420px] bg-stone-900 border-l border-stone-800 flex flex-col shrink-0 shadow-2xl z-40 order-2 md:order-2 h-auto md:h-full">
         
         {/* Top: Player Controls (Sticky on Mobile?) */}
         <div className="p-4 border-b border-stone-800 bg-stone-900/95 backdrop-blur shrink-0">
            {steps.length > 0 ? (
               <PlayerControls 
                  isPlaying={isPlaying}
                  onPlayPause={handlePlayPause}
                  onNext={() => handleNext(false)}
                  onPrev={handlePrev}
                  currentStep={currentStepIndex}
                  totalSteps={steps.length}
               />
            ) : (
               <div className="h-[60px] flex items-center justify-center text-stone-600 text-sm italic border border-dashed border-stone-800 rounded-xl bg-stone-900/50">
                  等待課程開始...
               </div>
            )}
         </div>

         {/* Middle: Step List (Hidden on Mobile, Visible Scrollable on Desktop) */}
         <div className="hidden md:flex flex-1 overflow-y-auto p-4 custom-scrollbar bg-stone-900/50 min-h-0">
            <StepList 
              steps={steps} 
              currentStepIndex={currentStepIndex} 
              onStepClick={handleStepJump}
            />
         </div>

         {/* Bottom: Input Section */}
         <div className="p-3 md:p-4 bg-stone-900 border-t border-stone-800 shrink-0 pb-safe">
            <InputSection onSend={handleSend} isProcessing={isThinking} />
            <footer className="mt-3 text-center text-[10px] text-stone-600 hidden md:block">
              由 Google Gemini 3 Flash 與 Web Audio API 強力驅動
            </footer>
         </div>
      </aside>

    </div>
  );
};

export default App;
