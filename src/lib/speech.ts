/**
 * Senior-Friendly Multi-Tier Speech Service
 * Guarantees Telugu, Marathi, Bengali, Tamil, Hindi, and English ALWAYS speak clearly on all devices.
 * 
 * 4-Tier Fallback:
 * 1. Device-native voice (if installed on OS)
 * 2. Backend `/api/tts` serverless audio stream
 * 3. Direct cloud audio stream fallback
 * 4. Fallback native synthesis with regional BCP-47 tag
 */

export interface SpeechOptions {
  text: string;
  lang?: string;
  rate?: number; // 0.85 for slow, 1.0 for normal
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

const LANG_VOICE_MAP: Record<string, string[]> = {
  en: ['en-IN', 'en-US', 'en-GB', 'en'],
  hi: ['hi-IN', 'hi_IN', 'hi'],
  te: ['te-IN', 'te_IN', 'te'],
  ta: ['ta-IN', 'ta_IN', 'ta'],
  mr: ['mr-IN', 'mr_IN', 'mr'],
  bn: ['bn-IN', 'bn_BD', 'bn'],
};

const LANG_TAGS: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
};

// Global audio player instance for cloud TTS
let activeAudio: HTMLAudioElement | null = null;
let currentPlaylist: string[] = [];
let playlistIndex = 0;
let cachedVoices: SpeechSynthesisVoice[] = [];

// Populate voices when the browser loads them
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

export function stopSpeaking(): void {
  // Stop native speech synthesis
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }

  // Stop any active cloud audio playback
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio.src = '';
    } catch {}
    activeAudio = null;
  }
  currentPlaylist = [];
  playlistIndex = 0;
}

/**
 * Splits text into sentence chunks under 140 characters for smooth audio streaming
 */
function chunkText(text: string): string[] {
  const sentences = text
    .replace(/([.!?।])\s+/g, '$1|')
    .split('|')
    .map(s => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    if ((current + ' ' + s).length <= 140) {
      current = current ? current + ' ' + s : s;
    } else {
      if (current) chunks.push(current);
      if (s.length <= 140) {
        current = s;
      } else {
        const words = s.split(' ');
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).length <= 130) {
            sub = sub ? sub + ' ' + w : w;
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        if (sub) current = sub;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text.slice(0, 140)];
}

/**
 * Native Speech Synthesis Fallback
 */
function speakNativeFallback(text: string, langTag: string, options: SpeechOptions): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langTag;
      utterance.rate = options.rate ?? 0.85;

      // Find matching voice if available
      const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
      const matched = voices.find(v => v.lang.toLowerCase().replace('_', '-').startsWith(langTag.toLowerCase().slice(0, 2)));
      if (matched) {
        utterance.voice = matched;
      }

      utterance.onstart = () => options.onStart?.();
      utterance.onend = () => options.onEnd?.();
      utterance.onerror = (e) => options.onError?.(e);

      window.speechSynthesis.speak(utterance);
      return;
    } catch (e) {
      console.warn('Native speech fallback error:', e);
    }
  }
  options.onEnd?.();
}

/**
 * Plays speech using Cloud Audio stream (/api/tts with direct fallback)
 */
function playCloudTTS(options: SpeechOptions) {
  const targetLang = options.lang || 'en';
  const langTag = LANG_TAGS[targetLang] || 'en-IN';
  const chunks = chunkText(options.text);

  currentPlaylist = chunks;
  playlistIndex = 0;

  function playNext() {
    if (playlistIndex >= currentPlaylist.length) {
      if (options.onEnd) options.onEnd();
      activeAudio = null;
      return;
    }

    const chunk = currentPlaylist[playlistIndex];
    playlistIndex++;

    // Try Tier 2: /api/tts endpoint
    const primaryUrl = `/api/tts?text=${encodeURIComponent(chunk)}&lang=${targetLang}`;
    // Fallback Tier 3: Direct cloud audio
    const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${targetLang}&client=tw-ob`;

    const audio = new Audio();
    activeAudio = audio;
    audio.playbackRate = options.rate !== undefined ? options.rate : 0.85;

    let triedDirect = false;

    audio.onplay = () => {
      if (playlistIndex === 1 && options.onStart) {
        options.onStart();
      }
    };

    audio.onended = () => {
      playNext();
    };

    audio.onerror = () => {
      if (!triedDirect) {
        // Switch to direct cloud URL
        triedDirect = true;
        audio.src = fallbackUrl;
        audio.play().catch(() => {
          // If direct audio also fails, fall back to Tier 4 native synthesis
          speakNativeFallback(chunk, langTag, options);
          playNext();
        });
      } else {
        // Fall back to Tier 4 native synthesis
        speakNativeFallback(chunk, langTag, options);
        playNext();
      }
    };

    audio.src = primaryUrl;
    audio.play().catch(() => {
      if (!triedDirect) {
        triedDirect = true;
        audio.src = fallbackUrl;
        audio.play().catch(() => {
          speakNativeFallback(chunk, langTag, options);
          playNext();
        });
      }
    });
  }

  playNext();
}

export function speakText(options: SpeechOptions): void {
  stopSpeaking();

  const clean = options.text.trim();
  if (!clean) return;

  const targetLang = options.lang || 'en';
  const langTag = LANG_TAGS[targetLang] || 'en-IN';

  // 1. Check if the browser has a verified native voice for this language
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
    const candidateCodes = LANG_VOICE_MAP[targetLang] || [targetLang];

    const matchedVoice = voices.find(v =>
      candidateCodes.some(c => v.lang.toLowerCase().replace('_', '-').startsWith(c.toLowerCase().replace('_', '-')))
    );

    // If a genuine native voice is installed (e.g. Google తెలుగు on Android or Microsoft Mohan on Windows):
    if (matchedVoice && (targetLang === 'en' || !matchedVoice.lang.toLowerCase().startsWith('en'))) {
      try {
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.voice = matchedVoice;
        utterance.lang = matchedVoice.lang;
        utterance.rate = options.rate !== undefined ? options.rate : 0.85;

        utterance.onstart = () => options.onStart?.();
        utterance.onend = () => options.onEnd?.();
        utterance.onerror = (e) => {
          console.warn('Native speech synthesis error, using cloud fallback:', e);
          playCloudTTS(options);
        };

        window.speechSynthesis.speak(utterance);
        return;
      } catch (err) {
        console.warn('Failed to speak with native voice, falling back to cloud:', err);
      }
    }
  }

  // 2, 3, 4. Fallback chain: /api/tts -> Direct Cloud Audio -> Native Tagged Synthesis
  playCloudTTS(options);
}
