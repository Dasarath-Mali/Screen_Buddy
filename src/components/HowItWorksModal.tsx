import React from 'react';
import { X, Smartphone, Scan, CircleDot, ShieldCheck } from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: string;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-cream rounded-3xl border-2 border-line shadow-float w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💡</span>
            <h2 className="text-2xl font-black text-ink">How Screen Buddy Helps</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-cream-soft active:scale-95 text-ink-soft transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 3 Colorful Steps */}
        <div className="space-y-5 py-2">
          {/* Step 1: Orange accent */}
          <div className="flex items-start gap-4 p-3 rounded-2xl bg-orange-soft/50 border border-orange/20">
            <div className="p-3 bg-orange text-white rounded-2xl shadow-colorful flex-shrink-0">
              <Smartphone className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-ink">1. Take a screenshot</h3>
              <p className="text-ink-soft text-base mt-1">
                Whenever a payment screen, message, or popup looks unfamiliar, take a screenshot of your screen.
              </p>
            </div>
          </div>

          {/* Step 2: Blue / Cream accent */}
          <div className="flex items-start gap-4 p-3 rounded-2xl bg-brand-soft/50 border border-brand/20">
            <div className="p-3 bg-brand text-white rounded-2xl shadow-sm flex-shrink-0">
              <Scan className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-ink">2. We inspect it safely</h3>
              <p className="text-ink-soft text-base mt-1">
                Your screen is analyzed for scam patterns and buttons. Your picture is never saved or shared.
              </p>
            </div>
          </div>

          {/* Step 3: Green / Emerald accent */}
          <div className="flex items-start gap-4 p-3 rounded-2xl bg-green-soft/50 border border-green/20">
            <div className="p-3 bg-green text-white rounded-2xl shadow-green flex-shrink-0">
              <CircleDot className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-ink">3. Circle the right button</h3>
              <p className="text-ink-soft text-base mt-1">
                If safe, we circle the exact button to tap. If it looks like a scam, we alert you with a loud red warning.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-line">
          <div className="p-3.5 bg-surface rounded-2xl border border-line text-xs text-ink-soft leading-relaxed flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-green flex-shrink-0" />
            <span>
              Screen Buddy provides guidance for seniors. When in doubt, always call your trusted family or bank.
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-4 py-3.5 rounded-2xl bg-orange text-white font-bold text-lg hover:bg-orange-dark active:scale-95 shadow-colorful transition-all"
          >
            I understand
          </button>
        </div>
      </div>
    </div>
  );
};
