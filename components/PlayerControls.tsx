import React from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface PlayerControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentStep: number;
  totalSteps: number;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
  currentStep,
  totalSteps,
}) => {
  const progress = totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 0;

  return (
    <div className="bg-stone-900/80 p-2 md:p-4 rounded-xl border border-stone-700 flex flex-col md:flex-row items-center gap-2 md:gap-4 backdrop-blur-md">
      {/* Playback Buttons - Compact on mobile */}
      <div className="flex items-center gap-3 md:gap-4 justify-center w-full md:w-auto">
        <button 
          onClick={onPrev}
          disabled={currentStep === 0}
          className="p-1.5 md:p-2 text-stone-400 hover:text-white disabled:opacity-30 hover:bg-white/10 rounded-full transition-all"
        >
          <SkipBack size={20} className="md:w-6 md:h-6" fill="currentColor" />
        </button>

        <button 
          onClick={onPlayPause}
          className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-900/50 transition-all transform hover:scale-105"
        >
          {isPlaying ? 
            <Pause size={20} className="md:w-6 md:h-6" fill="currentColor" /> : 
            <Play size={20} className="md:w-6 md:h-6 ml-1" fill="currentColor" />
          }
        </button>

        <button 
          onClick={onNext}
          disabled={currentStep >= totalSteps - 1}
          className="p-1.5 md:p-2 text-stone-400 hover:text-white disabled:opacity-30 hover:bg-white/10 rounded-full transition-all"
        >
          <SkipForward size={20} className="md:w-6 md:h-6" fill="currentColor" />
        </button>
      </div>

      {/* Progress Slider */}
      <div className="flex-1 w-full flex items-center gap-3 px-2 md:px-0">
        <span className="text-xs text-stone-500 font-mono w-8 md:w-12 text-right">
          {currentStep + 1} / {totalSteps || 1}
        </span>
        <div className="relative flex-1 h-1.5 md:h-2 bg-stone-700 rounded-full overflow-hidden">
          <div 
            className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};