import React from 'react';
import { Volume2, Square } from 'lucide-react';

interface VoiceControlsProps {
  isSpeaking: boolean;
  onToggleSpeech: () => void;
  speed: number;
  onToggleSpeed: () => void;
  lang: string;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  isSpeaking,
  onToggleSpeech,
  speed,
  onToggleSpeed,
}) => {
  return (
    <div className="flex items-center gap-3 w-full">
      {/* Primary Read Aloud / Waveform button */}
      <button
        onClick={onToggleSpeech}
        className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-bold text-xl shadow-md transition-all active:scale-95 ${
          isSpeaking
            ? 'bg-ink text-white ring-4 ring-orange-soft'
            : 'bg-green hover:bg-green-dark text-white shadow-green'
        }`}
      >
        {isSpeaking ? (
          <>
            {/* 5-bar animated multi-colored waveform */}
            <div className="flex items-center gap-1.5 h-6">
              <span className="wave-bar wave-bar-green"></span>
              <span className="wave-bar wave-bar-orange"></span>
              <span className="wave-bar wave-bar-red"></span>
              <span className="wave-bar wave-bar-blue"></span>
              <span className="wave-bar wave-bar-emerald"></span>
            </div>
            <span>Reading aloud</span>
            <Square className="w-4 h-4 ml-2 fill-white" />
          </>
        ) : (
          <>
            <div className="p-1 rounded-full bg-white/20">
              <Volume2 className="w-6 h-6 flex-shrink-0" />
            </div>
            <span>Read to me</span>
          </>
        )}
      </button>

      {/* Speed toggle: 🐢 Slow / Normal */}
      <button
        onClick={onToggleSpeed}
        title="Toggle reading speed"
        className="flex items-center justify-center gap-1.5 py-4 px-4 rounded-2xl bg-cream border-2 border-line text-ink font-bold text-base shadow-soft active:scale-95 hover:bg-cream-soft transition-all"
      >
        <span className="text-xl">{speed < 1.0 ? '🐢' : '⚡'}</span>
        <span className="text-orange font-extrabold">{speed < 1.0 ? 'Slow' : 'Fast'}</span>
      </button>
    </div>
  );
};
