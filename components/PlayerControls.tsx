import React from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import clsx from 'clsx';

interface PlayerControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentStep: number;
  totalSteps: number;
  isDark: boolean;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
  currentStep,
  totalSteps,
  isDark,
}) => {
  const progress = totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 0;

  return (
    <div className={clsx(
      "p-2 md:p-4 rounded-xl border flex flex-col md:flex-row items-center gap-2 md:gap-4 backdrop-blur-md transition-colors",
      isDark ? "bg-stone-900/80 border-stone-700" : "bg-white/80 border-stone-200"
    )}>
      {/* Playback Buttons - Compact on mobile */}
      <div className="flex items-center gap-4 md:gap-4 justify-center w-full md:w-auto">
        <button 
          onClick={onPrev}
          disabled={currentStep === 0}
          className={clsx(
            "p-2 md:p-2 rounded-full transition-all disabled:opacity-30",
            isDark ? "text-stone-400 hover:text-white hover:bg-white/10" : "text-stone-400 hover:text-stone-700 hover:bg-black/5"
          )}
        >
          <SkipBack size={22} className="md:w-6 md:h-6" fill="currentColor" />
        </button>

        <button 
          onClick={onPlayPause}
          className="w-12 h-12 md:w-12 md:h-12 flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-900/50 transition-all transform hover:scale-105"
        >
          {isPlaying ? 
            <Pause size={22} className="md:w-6 md:h-6" fill="currentColor" /> : 
            <Play size={22} className="md:w-6 md:h-6 ml-1" fill="currentColor" />
          }
        </button>

        <button 
          onClick={onNext}
          disabled={currentStep >= totalSteps - 1}
          className={clsx(
            "p-2 md:p-2 rounded-full transition-all disabled:opacity-30",
            isDark ? "text-stone-400 hover:text-white hover:bg-white/10" : "text-stone-400 hover:text-stone-700 hover:bg-black/5"
          )}
        >
          <SkipForward size={22} className="md:w-6 md:h-6" fill="currentColor" />
        </button>
      </div>

      {/* Progress Slider */}
      <div className="flex-1 w-full flex items-center gap-3 px-2 md:px-0">
        <span className="text-xs text-stone-500 font-mono whitespace-nowrap min-w-[3rem] text-right">
          {currentStep + 1} / {totalSteps || 1}
        </span>
        <div className={clsx(
          "relative flex-1 h-2 md:h-2 rounded-full overflow-hidden",
          isDark ? "bg-stone-700" : "bg-stone-200"
        )}>
          <div 
            className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};