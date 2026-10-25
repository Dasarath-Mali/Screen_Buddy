import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ImagePlus,
  HelpCircle,
  Settings,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Phone,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Volume2,
} from 'lucide-react';

import { AnnotatedScreenshot } from './components/AnnotatedScreenshot';
import { VoiceControls } from './components/VoiceControls';
import { BusyCountdown } from './components/BusyCountdown';
import { SetupModal } from './components/SetupModal';
import { HowItWorksModal } from './components/HowItWorksModal';
import { SAMPLE_SCREENS, SampleScreen } from './components/SampleScreenshots';

import { resizeImageClient } from './lib/resize';
import { detectElementsClient, DetectedElement } from './lib/ocr';
import { speakText, stopSpeaking } from './lib/speech';
import { loadSettings, HelperSettings, cleanIndianPhone, formatIndianPhone } from './lib/storage';
import { evaluateRules } from '../server/services/rules';
import translationsData from './i18n/translations.json';

const translations: Record<string, any> = translationsData;

type AppState = 'home' | 'analyzing' | 'result' | 'busy' | 'error';

interface AnalysisResultData {
  verdict: 'safe' | 'caution' | 'scam';
  confidence: number;
  scam_reasons: string[];
  screen_summary: string;
  next_action: {
    element_id: number;
    label: string;
    box: [number, number, number, number];
  } | null;
  explanation: string;
  call_for_help: boolean;
  source?: string;
}

export const App: React.FC = () => {
  const [settings, setSettings] = useState<HelperSettings>(loadSettings());
  const [appState, setAppState] = useState<AppState>('home');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentBox, setCurrentBox] = useState<[number, number, number, number] | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResultData | null>(null);

  // Loading & cycling captions
  const [captionIndex, setCaptionIndex] = useState(0);

  // Rate limiting / Busy states
  const [busyRetrySeconds, setBusyRetrySeconds] = useState(20);
  const [isDailyExhausted, setIsDailyExhausted] = useState(false);
  const [checksRemaining, setChecksRemaining] = useState<number | null>(null);

  // Voice playback state
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Modals
  const [showSetup, setShowSetup] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showSamples, setShowSamples] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentLang = settings.lang || 'en';
  const t = translations[currentLang] || translations['en'];

  // Clean 10-digit phone for India
  const rawDigits = cleanIndianPhone(settings.contactPhone);
  const formattedPhone = formatIndianPhone(rawDigits);
  const telLink = `tel:+91${rawDigits}`;

  // Update language setting
  const handleSelectLang = (langCode: string) => {
    const updated = { ...settings, lang: langCode };
    setSettings(updated);
    localStorage.setItem('screenbuddy_settings_v1', JSON.stringify(updated));
  };

  // Toggle voice reading speed
  const handleToggleSpeed = () => {
    const newSpeed = settings.speechRate < 1.0 ? 1.0 : 0.85;
    const updated = { ...settings, speechRate: newSpeed };
    setSettings(updated);
    localStorage.setItem('screenbuddy_settings_v1', JSON.stringify(updated));
  };

  // Cycling captions during analyzing state
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (appState === 'analyzing') {
      setCaptionIndex(0);
      interval = setInterval(() => {
        setCaptionIndex(prev => (prev + 1) % (t.analyzingSubtitles?.length || 3));
      }, 1600);
    }
    return () => clearInterval(interval);
  }, [appState, t.analyzingSubtitles]);

  // Read aloud automatically when result is ready in user's language
  useEffect(() => {
    if (appState === 'result' && analysisResult) {
      let textToRead = '';
      if (analysisResult.verdict === 'scam') {
        textToRead = `${t.verdictScam}. ${analysisResult.explanation}. ${t.scamWarningDetail}`;
      } else {
        const verdictLabel = analysisResult.verdict === 'safe' ? t.verdictSafe : t.verdictCaution;
        textToRead = `${verdictLabel}. ${analysisResult.explanation}`;
      }

      speakText({
        text: textToRead,
        lang: currentLang,
        rate: settings.speechRate,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }
    return () => {
      stopSpeaking();
      setIsSpeaking(false);
    };
  }, [appState, analysisResult]);

  // Voice toggle handler
  const handleToggleSpeech = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }

    if (!analysisResult) return;

    let fullSpeech = '';
    if (analysisResult.verdict === 'scam') {
      fullSpeech = `${t.verdictScam}. ${analysisResult.explanation}`;
    } else {
      const verdictLabel = analysisResult.verdict === 'safe' ? t.verdictSafe : t.verdictCaution;
      fullSpeech = `${verdictLabel}. ${analysisResult.explanation}`;
    }

    speakText({
      text: fullSpeech,
      lang: currentLang,
      rate: settings.speechRate,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  // Process and analyze an image (file upload or sample)
  const processAndAnalyze = async (
    imageSource: string | File,
    presetElements?: DetectedElement[],
    presetOcrText?: string
  ) => {
    try {
      setAppState('analyzing');
      stopSpeaking();
      setIsSpeaking(false);

      // Speak initial caption once
      speakText({
        text: t.analyzingTitle || 'Looking at your screen',
        lang: currentLang,
        rate: settings.speechRate,
      });

      // 1. Client-side resize and compression (<1024px, JPEG 0.8)
      const resized = await resizeImageClient(imageSource, 1024, 0.8);
      setCurrentImage(resized.dataUrl);

      // 2. Client-side OCR with Tesseract.js (or precomputed sample)
      let ocrText = presetOcrText || '';
      let elements = presetElements || [];

      if (!presetElements) {
        const ocrData = await detectElementsClient(resized.dataUrl, currentLang);
        ocrText = ocrData.fullText;
        elements = ocrData.elements;
      }

      // 3. Send to POST /api/analyze
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (settings.userGroqKey) {
        headers['x-groq-key'] = settings.userGroqKey;
      }

      let data: AnalysisResultData;

      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            image: resized.base64,
            lang: currentLang,
            ocr_text: ocrText,
            elements,
          }),
        });

        // Read remaining limit hints
        const remainingHeader = res.headers.get('X-RateLimit-Remaining');
        if (remainingHeader) {
          setChecksRemaining(parseInt(remainingHeader, 10));
        }

        // Handle rate limits and busy responses
        if (res.status === 429 || res.status === 503) {
          const busyData = await res.json();
          const retryAfter = busyData.retry_after || 20;
          setBusyRetrySeconds(retryAfter);

          if (busyData.fallback) {
            setAnalysisResult(busyData.fallback);
            if (busyData.fallback.next_action?.box) {
              setCurrentBox(busyData.fallback.next_action.box);
            }
          }

          if (res.status === 503 && busyData.error === 'busy' && retryAfter > 300) {
            setIsDailyExhausted(true);
          }

          setAppState('busy');
          return;
        }

        if (res.ok) {
          data = await res.json();
        } else {
          // If server returned 404 (e.g. static hosting on Netlify) or error, seamlessly fall back to local rule engine!
          console.warn('API returned status', res.status, '- executing local client rules fallback');
          data = evaluateRules(ocrText, elements, currentLang);
        }
      } catch (networkErr) {
        // Network offline or failed -> seamlessly evaluate rules locally on client!
        console.warn('API network error, executing local client rules fallback:', networkErr);
        data = evaluateRules(ocrText, elements, currentLang);
      }

      setAnalysisResult(data);

      if (data.next_action?.box) {
        setCurrentBox(data.next_action.box);
      } else {
        setCurrentBox(null);
      }

      setAppState('result');
    } catch (err) {
      console.error('Error analyzing screen:', err);
      // Final fallback: try local evaluation even on unexpected error
      try {
        const fallbackResult = evaluateRules('', [], currentLang);
        setAnalysisResult(fallbackResult);
        setAppState('result');
      } catch {
        setAppState('error');
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndAnalyze(file);
    }
  };

  // Clipboard Paste (Ctrl+V) listener - allows seniors & helpers to paste screenshots anywhere
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processAndAnalyze(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [currentLang, settings]);

  const handleSelectSample = (sample: SampleScreen) => {
    setShowSamples(false);
    processAndAnalyze(
      sample.dataUrl,
      sample.elements.map(e => ({ ...e, confidence: 0.9 })),
      sample.ocrText
    );
  };

  const handleReset = () => {
    stopSpeaking();
    setIsSpeaking(false);
    setAppState('home');
    setCurrentImage(null);
    setCurrentBox(null);
    setAnalysisResult(null);
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
          processAndAnalyze(file);
        }
      }}
      className={`min-h-screen flex flex-col justify-between max-w-md mx-auto px-5 py-6 transition-colors duration-500 ${
        appState === 'result' && analysisResult?.verdict === 'scam'
          ? 'bg-red-soft'
          : 'bg-bg'
      }`}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Top Bar: Brand, India Tag, and Helper Settings */}
      <header className="flex items-center justify-between pb-4 border-b-2 border-line">
        <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={handleReset} role="button">
          <div className="w-11 h-11 rounded-2xl sb-logo-badge text-white flex items-center justify-center font-black text-xl">
            SB
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-black text-ink leading-tight">Screen Buddy</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-soft text-green font-bold border border-green/30">
                🇮🇳 +91
              </span>
            </div>
            <span className="text-xs text-orange font-bold uppercase tracking-wide">For Seniors &amp; Family</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Helper Setup button */}
          <button
            onClick={() => setShowSetup(true)}
            title="Helper Settings"
            className="flex items-center gap-1.5 p-2.5 rounded-2xl bg-cream border-2 border-line text-ink hover:border-orange active:scale-95 shadow-soft transition-all"
          >
            <Settings className="w-5 h-5 text-orange" />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col justify-center py-4">
        {/* ================= SCREEN 1: HOME ================= */}
        {appState === 'home' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col space-y-6"
          >
            {/* Colorful Regional Language Selector */}
            <div className="flex items-center justify-between bg-cream p-1.5 rounded-2xl border-2 border-line shadow-soft overflow-x-auto gap-1.5">
              {[
                { code: 'en', label: 'English', active: 'bg-blue-600 text-white shadow-sm border-blue-700', inactive: 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100' },
                { code: 'hi', label: 'हिन्दी', active: 'bg-orange text-white shadow-colorful border-orange-dark', inactive: 'bg-orange-soft text-orange-dark border-orange/30 hover:bg-orange-soft/80' },
                { code: 'te', label: 'తెలుగు', active: 'bg-green text-white shadow-green border-green-dark', inactive: 'bg-green-soft text-green-dark border-green/30 hover:bg-green-soft/80' },
                { code: 'ta', label: 'தமிழ்', active: 'bg-red text-white shadow-red border-red-dark', inactive: 'bg-red-soft text-red-dark border-red/30 hover:bg-red-soft/80' },
                { code: 'mr', label: 'मराठी', active: 'bg-amber-600 text-white shadow-colorful border-amber-700', inactive: 'bg-amber-50 text-amber-950 border-amber-200 hover:bg-amber-100' },
                { code: 'bn', label: 'বাংলা', active: 'bg-indigo-600 text-white shadow-sm border-indigo-700', inactive: 'bg-indigo-50 text-indigo-950 border-indigo-200 hover:bg-indigo-100' },
              ].map(item => (
                <button
                  key={item.code}
                  onClick={() => handleSelectLang(item.code)}
                  className={`px-3 py-2 rounded-xl text-sm font-black transition-all border-2 whitespace-nowrap ${
                    currentLang === item.code
                      ? item.active
                      : item.inactive
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Main Heading & Subtitle */}
            <div className="text-center space-y-3 pt-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cream-soft border border-line text-xs font-bold text-orange">
                <span>🛡️</span>
                <span>Simple &amp; Safe Phone Protection</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-ink leading-tight">
                {t.homeHeading}
              </h2>
              <p className="text-ink-soft text-lg leading-relaxed px-2 font-medium">
                {t.homeSubheading}
              </p>
            </div>

            {/* Primary CTA: Pick Screenshot with Vibrant Orange Background & White Text */}
            <div className="pt-2 flex flex-col items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full btn-pick-screenshot flex items-center justify-center gap-3.5 py-5 px-6 rounded-3xl font-black text-2xl active:scale-95 transition-all animate-breathing cursor-pointer"
              >
                <ImagePlus className="w-8 h-8 flex-shrink-0 text-white" />
                <span className="text-white tracking-wide">{t.pickScreenshot}</span>
              </button>
              <span className="text-xs font-bold text-ink-muted flex items-center gap-1.5">
                <span>📋 Tip:</span>
                <span>You can also press</span>
                <kbd className="px-1.5 py-0.5 bg-cream border border-line rounded font-mono text-[11px] text-orange font-bold shadow-xs">Ctrl + V</kbd>
                <span>to paste or drag screenshot here</span>
              </span>
            </div>

            {/* Colorful Action Cards: Sample Screens & How it Works */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => setShowSamples(true)}
                className="btn-sample flex items-center justify-center gap-2 py-4 px-4 rounded-2xl font-black text-base active:scale-95 transition-all cursor-pointer"
              >
                <Sparkles className="w-5 h-5 flex-shrink-0" />
                <span>{t.trySample}</span>
              </button>

              <button
                onClick={() => setShowHowItWorks(true)}
                className="btn-how-it-works flex items-center justify-center gap-2 py-4 px-4 rounded-2xl font-black text-base active:scale-95 transition-all cursor-pointer"
              >
                <HelpCircle className="w-5 h-5 flex-shrink-0" />
                <span>{t.howItWorks}</span>
              </button>
            </div>

            {/* Rate limit & Verified helper hint */}
            <div className="flex items-center justify-between text-xs font-bold text-ink-soft px-2 pt-1">
              {checksRemaining !== null ? (
                <span>{t.checksLeft.replace('{n}', String(checksRemaining))}</span>
              ) : (
                <span>Free on-device check</span>
              )}
              <span className="text-green flex items-center gap-1">
                <span>✓</span> Helper {settings.contactName}: {formattedPhone}
              </span>
            </div>
          </motion.div>
        )}

        {/* ================= SCREEN 3: ANALYZING (LOADING) ================= */}
        {appState === 'analyzing' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center space-y-6"
          >
            {/* Screenshot preview with sweeping scanning line & camera brackets */}
            <div className="relative w-full rounded-3xl overflow-hidden border-2 border-orange/40 bg-cream shadow-float">
              {/* Corner camera bracket focus marks in Orange and Green */}
              <div className="absolute top-3 left-3 w-6 h-6 border-t-4 border-l-4 border-orange rounded-tl-lg z-20 pointer-events-none" />
              <div className="absolute top-3 right-3 w-6 h-6 border-t-4 border-r-4 border-orange rounded-tr-lg z-20 pointer-events-none" />
              <div className="absolute bottom-3 left-3 w-6 h-6 border-b-4 border-l-4 border-green rounded-bl-lg z-20 pointer-events-none" />
              <div className="absolute bottom-3 right-3 w-6 h-6 border-b-4 border-r-4 border-green rounded-br-lg z-20 pointer-events-none" />

              {/* Sweeping Scanning Line */}
              <div className="absolute left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-orange to-transparent shadow-[0_0_16px_rgba(234,88,12,0.8)] z-10 animate-scan pointer-events-none" />

              {currentImage && (
                <img
                  src={currentImage}
                  alt="Analyzing screen"
                  className="w-full h-auto max-h-[55vh] object-contain opacity-90 mx-auto"
                />
              )}
            </div>

            {/* Cycling Crossfading Captions */}
            <div className="text-center px-4 min-h-[64px] flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={captionIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                  className="text-2xl font-black text-ink"
                >
                  {t.analyzingSubtitles?.[captionIndex] || t.analyzingTitle}
                </motion.p>
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ================= SCREEN 4 & 5: RESULTS (SAFE / CAUTION / SCAM) ================= */}
        {appState === 'result' && analysisResult && currentImage && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col space-y-4"
          >
            {/* Verdict Banner Header */}
            {analysisResult.verdict === 'scam' ? (
              /* SCAM RESULT: Vivid Red & Rose */
              <div className="bg-cream rounded-3xl border-4 border-red p-5 shadow-red text-center space-y-3">
                <div className="inline-flex p-3 bg-red-soft rounded-full text-red animate-shake-settle shadow-sm">
                  <ShieldAlert className="w-14 h-14" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-red leading-snug">
                  {t.verdictScam}
                </h2>

                {/* Specific scam reasons */}
                {analysisResult.scam_reasons?.length > 0 && (
                  <div className="space-y-2 text-left pt-2">
                    {analysisResult.scam_reasons.map((reason, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-ink font-bold text-base">
                        <span className="w-2.5 h-2.5 rounded-full bg-red mt-2 flex-shrink-0" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* SAFE (GREEN) OR CAUTION (ORANGE) RESULT */
              <div
                className={`flex items-center gap-3.5 p-4 rounded-3xl border-2 shadow-sm ${
                  analysisResult.verdict === 'safe'
                    ? 'bg-green-soft border-green text-green shadow-green'
                    : 'bg-orange-soft border-orange text-orange shadow-colorful'
                }`}
              >
                {analysisResult.verdict === 'safe' ? (
                  <div className="p-2 bg-green text-white rounded-2xl">
                    <ShieldCheck className="w-8 h-8 flex-shrink-0" />
                  </div>
                ) : (
                  <div className="p-2 bg-orange text-white rounded-2xl">
                    <AlertTriangle className="w-8 h-8 flex-shrink-0" />
                  </div>
                )}
                <div>
                  <span className="text-2xl font-black block leading-tight">
                    {analysisResult.verdict === 'safe' ? t.verdictSafe : t.verdictCaution}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
                    {analysisResult.verdict === 'safe' ? 'Verified Safe To Proceed' : 'Proceed With Care'}
                  </span>
                </div>
              </div>
            )}

            {/* The Annotated Screenshot with single circle or scam outline */}
            <AnnotatedScreenshot
              image={currentImage}
              box={currentBox}
              verdict={analysisResult.verdict}
            />

            {/* Max 2-sentence plain-language explanation */}
            <div className="bg-cream p-4 rounded-3xl border-2 border-line shadow-soft">
              <p className="text-xl font-bold text-ink leading-relaxed">
                {analysisResult.explanation || analysisResult.screen_summary}
              </p>
            </div>
          </motion.div>
        )}

        {/* ================= SCREEN 8: BUSY / RATE LIMIT ================= */}
        {appState === 'busy' && (
          <BusyCountdown
            retryAfterSeconds={busyRetrySeconds}
            onRetry={() => {
              if (currentImage) {
                processAndAnalyze(currentImage);
              } else {
                setAppState('home');
              }
            }}
            familyPhone={telLink}
            isDailyExhausted={isDailyExhausted}
          />
        )}

        {/* ================= ERROR STATE ================= */}
        {appState === 'error' && (
          <div className="flex flex-col items-center text-center p-6 bg-cream rounded-3xl border-2 border-line shadow-soft space-y-4">
            <div className="p-4 bg-orange-soft rounded-full text-orange">
              <AlertTriangle className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-bold text-ink">That screenshot was hard to read</h3>
            <p className="text-ink-soft text-base">
              Please take a clear picture of your screen and try again.
            </p>
            <button
              onClick={handleReset}
              className="w-full py-4 rounded-2xl bg-orange text-white font-bold text-lg hover:bg-orange-dark active:scale-95 shadow-colorful transition-all"
            >
              Try another screenshot
            </button>
          </div>
        )}
      </main>

      {/* FIXED BOTTOM ACTIONS BAR (SAFE AREA) */}
      <footer className="pt-3 border-t-2 border-line">
        {appState === 'result' && analysisResult && (
          <div className="space-y-3">
            {analysisResult.verdict === 'scam' ? (
              /* Scam Action Buttons: Vibrant Red 1-Tap Family Call */
              <div className="space-y-2.5">
                <a
                  href={telLink}
                  className="w-full btn-call-family flex items-center justify-center gap-3 py-5 px-6 rounded-2xl font-black text-2xl active:scale-95 transition-all"
                >
                  <Phone className="w-7 h-7 text-white flex-shrink-0" />
                  <span className="text-white">Call {settings.contactName} ({formattedPhone})</span>
                </a>

                <button
                  onClick={handleReset}
                  className="w-full py-3.5 px-6 rounded-2xl bg-cream border-2 border-line text-ink font-bold text-lg hover:bg-cream-soft active:scale-95 transition-all"
                >
                  {t.close}
                </button>
              </div>
            ) : (
              /* Safe / Caution Action Buttons: Green Voice Controls */
              <div className="space-y-2.5">
                <VoiceControls
                  isSpeaking={isSpeaking}
                  onToggleSpeech={handleToggleSpeech}
                  speed={settings.speechRate}
                  onToggleSpeed={handleToggleSpeed}
                  lang={currentLang}
                />

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleReset}
                    className="flex-1 py-4 px-6 rounded-2xl bg-cream border-2 border-line text-ink font-extrabold text-lg hover:bg-cream-soft active:scale-95 shadow-soft transition-all"
                  >
                    {t.done}
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Check another screen"
                    className="py-4 px-4 rounded-2xl bg-cream border-2 border-line text-orange hover:border-orange active:scale-95 shadow-soft"
                  >
                    <RotateCcw className="w-6 h-6" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {appState === 'home' && (
          <div className="flex items-center justify-between text-xs text-ink-soft px-1">
            <span className="font-semibold">Free &amp; private in India</span>
            <a
              href={telLink}
              className="font-bold text-orange flex items-center gap-1 hover:underline"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call {settings.contactName} ({formattedPhone})</span>
            </a>
          </div>
        )}
      </footer>

      {/* SAMPLE SCREENS MODAL */}
      {showSamples && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-cream rounded-3xl border-2 border-line shadow-float w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-orange" />
                <h2 className="text-xl font-black text-ink">Choose a Sample Screen</h2>
              </div>
              <button
                onClick={() => setShowSamples(false)}
                className="p-2 rounded-full hover:bg-cream-soft text-ink-soft"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-ink-soft mb-4">
              Tap any sample to see how Screen Buddy protects against scams and highlights the right button:
            </p>

            <div className="space-y-3">
              {SAMPLE_SCREENS.map(sample => (
                <div
                  key={sample.id}
                  onClick={() => handleSelectSample(sample)}
                  className="flex items-center justify-between p-3.5 rounded-2xl border-2 border-line hover:border-orange cursor-pointer bg-surface hover:bg-orange-soft/30 transition-all active:scale-98 shadow-soft"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl text-xs font-black uppercase ${
                        sample.badge === 'scam'
                          ? 'bg-red text-white shadow-red'
                          : sample.badge === 'safe'
                          ? 'bg-green text-white shadow-green'
                          : 'bg-orange text-white shadow-colorful'
                      }`}
                    >
                      {sample.badge}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-ink text-base">{sample.name}</h4>
                      <p className="text-xs text-ink-soft line-clamp-1">{sample.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-orange" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* HELPER SETUP MODAL */}
      <SetupModal
        isOpen={showSetup}
        onClose={() => setShowSetup(false)}
        currentSettings={settings}
        onSaved={newSettings => setSettings(newSettings)}
      />

      {/* HOW IT WORKS MODAL */}
      <HowItWorksModal
        isOpen={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
        lang={currentLang}
      />
    </div>
  );
};
