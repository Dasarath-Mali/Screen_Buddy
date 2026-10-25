import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelperSettings, saveSettings, cleanIndianPhone } from '../lib/storage';
import { X, Check, ArrowRight, ArrowLeft, HeartHandshake, Phone, Globe, Key, AlertCircle } from 'lucide-react';

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: HelperSettings;
  onSaved: (newSettings: HelperSettings) => void;
}

export const SetupModal: React.FC<SetupModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onSaved,
}) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(currentSettings.contactName || '');
  // Store only raw 10 digits
  const [phoneDigits, setPhoneDigits] = useState(cleanIndianPhone(currentSettings.contactPhone || ''));
  const [lang, setLang] = useState(currentSettings.lang || 'en');
  const [groqKey, setGroqKey] = useState(currentSettings.userGroqKey || '');
  const [phoneError, setPhoneError] = useState('');

  if (!isOpen) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits 0-9, max 10 characters
    const numeric = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhoneDigits(numeric);
    if (numeric.length === 10) {
      setPhoneError('');
    }
  };

  const handleNextFromStep1 = () => {
    if (phoneDigits.length !== 10) {
      setPhoneError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setPhoneError('');
    setStep(2);
  };

  const handleFinish = () => {
    if (phoneDigits.length !== 10) {
      setStep(1);
      setPhoneError('Please enter a valid 10-digit mobile number.');
      return;
    }

    const updated = saveSettings({
      contactName: name.trim() || 'Family',
      contactPhone: phoneDigits,
      lang,
      userGroqKey: groqKey.trim(),
    });
    onSaved(updated);
    onClose();
  };

  const isPhoneComplete = phoneDigits.length === 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-cream rounded-3xl border-2 border-line shadow-float w-full max-w-md p-6 overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-soft text-orange rounded-xl">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink">Family Helper Setup</h2>
              <span className="text-xs text-orange font-semibold uppercase tracking-wider">India (+91)</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-cream-soft active:scale-95 text-ink-soft transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 3-Step Stepper Dots */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                step === i
                  ? 'w-9 bg-orange shadow-colorful'
                  : step > i
                  ? 'w-2.5 bg-green shadow-green'
                  : 'w-2.5 bg-line'
              }`}
            />
          ))}
        </div>

        {/* Step Contents */}
        <div className="min-h-[290px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-ink font-bold text-lg">
                  <div className="p-1.5 bg-green-soft text-green rounded-lg">
                    <Phone className="w-5 h-5" />
                  </div>
                  <span>Emergency Family Contact</span>
                </div>
                <p className="text-ink-soft text-sm">
                  If a scam is detected, Screen Buddy shows a 1-tap call button directly to this 10-digit number.
                </p>

                {/* Name Input */}
                <div>
                  <label className="block text-sm font-semibold text-ink-soft mb-1">
                    Your Name (e.g. Ramesh / Beta)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Son / Daughter"
                    className="w-full text-lg p-3.5 rounded-2xl border border-line bg-surface focus:border-orange focus:outline-none transition-colors"
                  />
                </div>

                {/* 10-Digit Indian Phone Input with +91 Prefix */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-ink-soft">
                      Mobile Number (India)
                    </label>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full transition-colors ${
                        isPhoneComplete
                          ? 'bg-green-soft text-green border border-green'
                          : 'bg-orange-soft text-orange'
                      }`}
                    >
                      {phoneDigits.length} / 10 digits
                    </span>
                  </div>

                  <div className="flex items-center rounded-2xl border-2 border-line bg-surface overflow-hidden focus-within:border-orange transition-colors">
                    {/* Fixed India Country Code Badge */}
                    <div className="flex items-center gap-1.5 px-3.5 py-3.5 bg-cream-soft border-r border-line text-ink font-bold select-none">
                      <span className="text-lg">🇮🇳</span>
                      <span className="text-base text-ink font-extrabold">+91</span>
                    </div>

                    {/* Numeric 10-Digit Input */}
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      value={phoneDigits}
                      onChange={handlePhoneChange}
                      placeholder="98765 43210"
                      className="w-full text-xl font-bold tracking-wider px-3.5 py-3 bg-transparent text-ink focus:outline-none"
                    />

                    {isPhoneComplete && (
                      <div className="pr-3 text-green">
                        <Check className="w-5 h-5 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  {phoneError ? (
                    <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-red">
                      <AlertCircle className="w-4 h-4" />
                      <span>{phoneError}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-ink-soft mt-1.5 block">
                      Enter standard 10-digit mobile number without leading 0 or +91.
                    </span>
                  )}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-ink font-bold text-lg">
                  <div className="p-1.5 bg-orange-soft text-orange rounded-lg">
                    <Globe className="w-5 h-5" />
                  </div>
                  <span>Preferred Language</span>
                </div>
                <p className="text-ink-soft text-sm">
                  Screen Buddy explains screens and speaks aloud in this language:
                </p>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {[
                    { id: 'en', label: 'English', color: 'border-blue-300 hover:border-brand bg-blue-50/50' },
                    { id: 'hi', label: 'हिन्दी (Hindi)', color: 'border-orange-300 hover:border-orange bg-orange-50/50' },
                    { id: 'te', label: 'తెలుగు (Telugu)', color: 'border-emerald-300 hover:border-green bg-emerald-50/50' },
                    { id: 'ta', label: 'தமிழ் (Tamil)', color: 'border-rose-300 hover:border-red bg-rose-50/50' },
                    { id: 'mr', label: 'मराठी (Marathi)', color: 'border-amber-300 hover:border-orange bg-amber-50/50' },
                    { id: 'bn', label: 'বাংলা (Bengali)', color: 'border-purple-300 hover:border-brand bg-purple-50/50' },
                  ].map(l => (
                    <button
                      key={l.id}
                      onClick={() => setLang(l.id)}
                      className={`p-3 rounded-2xl border-2 text-base font-bold text-left transition-all ${
                        lang === l.id
                          ? 'border-orange bg-orange-soft text-orange shadow-colorful'
                          : `${l.color} text-ink`
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-ink font-bold text-lg">
                  <div className="p-1.5 bg-brand-soft text-brand rounded-lg">
                    <Key className="w-5 h-5" />
                  </div>
                  <span>Optional: Groq API Key</span>
                </div>
                <p className="text-ink-soft text-sm">
                  Screen Buddy works 100% free without this. Adding your own key bypasses public quotas. It stays strictly stored on this phone.
                </p>

                <div>
                  <input
                    type="password"
                    value={groqKey}
                    onChange={e => setGroqKey(e.target.value)}
                    placeholder="gsk_..."
                    className="w-full text-base p-3.5 rounded-2xl border border-line bg-surface focus:border-brand focus:outline-none font-mono"
                  />
                  <span className="text-xs text-ink-soft mt-1.5 block">
                    Never sent to or stored on any remote server.
                  </span>
                </div>

                <div className="p-3.5 bg-green-soft border border-green rounded-2xl text-green flex items-center gap-2.5 text-sm font-bold shadow-sm">
                  <Check className="w-5 h-5 flex-shrink-0" />
                  <span>Configured with +91 {phoneDigits.slice(0, 5)} {phoneDigits.slice(5)}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center justify-between pt-5 border-t border-line mt-4">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-ink-soft font-bold hover:bg-cream-soft"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {step === 1 ? (
              <button
                onClick={handleNextFromStep1}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-orange text-white font-bold hover:bg-orange-dark active:scale-95 shadow-colorful transition-all"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : step === 2 ? (
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-orange text-white font-bold hover:bg-orange-dark active:scale-95 shadow-colorful transition-all"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-green text-white font-bold hover:opacity-95 active:scale-95 transition-all shadow-green"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>All set. Hand phone back</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
