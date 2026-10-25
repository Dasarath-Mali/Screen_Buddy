/**
 * Senior-friendly Speech Service
 * Combines Web Speech API (device-native) with seamless Cloud TTS fallback
 * Ensures Telugu, Marathi, Bengali, Tamil, Hindi, and English ALWAYS speak clearly on all devices.
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

// Global audio player instance for cloud TTS
let activeAudio: HTMLAudioElement | null = null;
let currentPlaylist: string[] = [];
let playlistIndex = 0;

export function stopSpeaking(): void {
  // Stop native speech synthesis
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
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
 * Splits text into sentence chunks under 150 characters for smooth audio playback
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
    if ((current + ' ' + s).length <= 160) {
      current = current ? current + ' ' + s : s;
    } else {
      if (current) chunks.push(current);
      if (s.length <= 160) {
        current = s;
      } else {
        // Break long sentence
        const words = s.split(' ');
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).length <= 150) {
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
  return chunks.length > 0 ? chunks : [text.slice(0, 160)];
}

/**
 * Plays speech using Cloud Audio stream (/api/tts)
 */
function playCloudTTS(options: SpeechOptions) {
  const targetLang = options.lang || 'en';
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

    const audioUrl = `/api/tts?text=${encodeURIComponent(chunk)}&lang=${targetLang}`;
    const audio = new Audio(audioUrl);
    activeAudio = audio;

    // Apply speed control (slow: 0.85, normal: 1.0)
    audio.playbackRate = options.rate !== undefined ? options.rate : 0.85;

    audio.onplay = () => {
      if (playlistIndex === 1 && options.onStart) {
        options.onStart();
      }
    };

    audio.onended = () => {
      playNext();
    };

    audio.onerror = (e) => {
      console.warn('Cloud TTS playback error, trying next chunk:', e);
      if (playlistIndex >= currentPlaylist.length) {
        if (options.onError) options.onError(e);
        if (options.onEnd) options.onEnd();
        activeAudio = null;
      } else {
        playNext();
      }
    };

    audio.play().catch(err => {
      console.warn('Audio play request interrupted or blocked:', err);
      if (options.onError) options.onError(err);
      if (options.onEnd) options.onEnd();
      activeAudio = null;
    });
  }

  playNext();
}

export function speakText(options: SpeechOptions): void {
  stopSpeaking();

  const clean = options.text.trim();
  if (!clean) return;

  const targetLang = options.lang || 'en';

  // 1. Check if the browser has a real native voice installed for this language
  let hasRealVoice = false;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const voices = window.speechSynthesis.getVoices();
    const candidateCodes = LANG_VOICE_MAP[targetLang] || [targetLang];

    const matchedVoice = voices.find(v =>
      candidateCodes.some(c => v.lang.toLowerCase().replace('_', '-').startsWith(c.toLowerCase().replace('_', '-')))
    );

    // If English, or if a real regional voice is verified installed:
    if (matchedVoice && (targetLang === 'en' || !matchedVoice.lang.toLowerCase().startsWith('en'))) {
      hasRealVoice = true;

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.voice = matchedVoice;
      utterance.lang = matchedVoice.lang;
      utterance.rate = options.rate !== undefined ? options.rate : 0.85;

      utterance.onstart = () => {
        if (options.onStart) options.onStart();
      };
      utterance.onend = () => {
        if (options.onEnd) options.onEnd();
      };
      utterance.onerror = (e) => {
        if (options.onError) options.onError(e);
      };

      window.speechSynthesis.speak(utterance);
      return;
    }
  }

  // 2. Fallback to Cloud Regional TTS stream
  // Guarantees clear pronunciation for Telugu, Marathi, Bengali, Tamil, etc.
  playCloudTTS(options);
}
