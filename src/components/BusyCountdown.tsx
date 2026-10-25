import React, { useEffect, useState } from 'react';
import { Phone, RefreshCw, Clock } from 'lucide-react';

interface BusyCountdownProps {
  retryAfterSeconds: number;
  onRetry: () => void;
  familyPhone: string;
  isDailyExhausted?: boolean;
}

export const BusyCountdown: React.FC<BusyCountdownProps> = ({
  retryAfterSeconds,
  onRetry,
  familyPhone,
  isDailyExhausted = false,
}) => {
  const [remaining, setRemaining] = useState(retryAfterSeconds);
  const total = Math.max(1, retryAfterSeconds);

  useEffect(() => {
    setRemaining(retryAfterSeconds);
  }, [retryAfterSeconds]);

  useEffect(() => {
    if (isDailyExhausted) return;

    if (remaining <= 0) {
      onRetry();
      return;
    }

    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onRetry();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remaining, isDailyExhausted, onRetry]);

  const strokeDashoffset = (remaining / total) * 283; // 2 * PI * 45 ≈ 283
  const hrefCall = familyPhone.startsWith('tel:') ? familyPhone : `tel:${familyPhone}`;

  return (
    <div className="flex flex-col items-center text-center p-6 bg-cream rounded-3xl border-2 border-line shadow-soft max-w-sm mx-auto">
      {isDailyExhausted ? (
        <div className="mb-4 p-4 bg-orange-soft rounded-full text-orange">
          <Clock className="w-12 h-12" />
        </div>
      ) : (
        /* Soft Countdown Ring with Breathing Animation in Warm Orange */
        <div className="relative w-28 h-28 my-4 flex items-center justify-center animate-breathing">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background ring */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#EADEC8"
              strokeWidth="6"
            />
            {/* Depleting progress ring in vibrant orange */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#EA580C"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="283"
              strokeDashoffset={283 - strokeDashoffset}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-3xl font-black text-ink">{remaining}</span>
            <span className="text-xs font-bold text-orange uppercase tracking-wider">sec</span>
          </div>
        </div>
      )}

      <h3 className="text-2xl font-black text-ink mt-2">
        {isDailyExhausted
          ? 'Screen Buddy is resting'
          : 'Lots of people are asking right now.'}
      </h3>

      <p className="text-ink-soft text-base mt-2 mb-6 leading-relaxed font-medium">
        {isDailyExhausted
          ? 'We have reached our free daily limit. Please try again tomorrow morning.'
          : `I'll try again automatically in ${remaining} seconds.`}
      </p>

      {/* Manual retry button in vibrant orange */}
      {!isDailyExhausted && (
        <button
          onClick={onRetry}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-orange text-white font-black text-lg shadow-colorful hover:bg-orange-dark active:scale-95 transition-all mb-3"
        >
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Try right now</span>
        </button>
      )}

      {/* "Call my family" is always visible with green border */}
      <a
        href={hrefCall}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-surface border-2 border-green text-green font-black text-lg shadow-soft active:scale-95 hover:bg-green-soft transition-all"
      >
        <Phone className="w-5 h-5" />
        <span>Call someone you trust</span>
      </a>
    </div>
  );
};
