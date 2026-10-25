export interface HelperSettings {
  contactName: string;
  contactPhone: string; // Stored as 10 digits, e.g. "9876543210"
  lang: string;
  speechRate: number; // 0.85 = slow, 1.0 = normal
  userGroqKey?: string;
  isFirstRun?: boolean;
}

const STORAGE_KEY = 'screenbuddy_settings_v1';

/**
 * Extracts pure 10 numeric digits from input, stripping +91, spaces, dashes
 */
export function cleanIndianPhone(raw: string): string {
  const digitsOnly = (raw || '').replace(/\D/g, '');
  // If it starts with 91 and has 12 digits, strip country code
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return digitsOnly.slice(2);
  }
  // Otherwise take up to 10 digits
  return digitsOnly.slice(-10);
}

/**
 * Formats a 10-digit number to Indian standard: "+91 XXXXX XXXXX"
 */
export function formatIndianPhone(raw: string): string {
  const digits = cleanIndianPhone(raw);
  if (!digits) return '+91';
  if (digits.length <= 5) return `+91 ${digits}`;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

const DEFAULT_SETTINGS: HelperSettings = {
  contactName: 'Son / Daughter',
  contactPhone: '9876543210',
  lang: 'en',
  speechRate: 0.85,
  userGroqKey: '',
  isFirstRun: true,
};

export function loadSettings(): HelperSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      contactPhone: cleanIndianPhone(parsed.contactPhone || DEFAULT_SETTINGS.contactPhone),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<HelperSettings>): HelperSettings {
  const current = loadSettings();
  const phone = settings.contactPhone !== undefined 
    ? cleanIndianPhone(settings.contactPhone) 
    : current.contactPhone;

  const updated: HelperSettings = {
    ...current,
    ...settings,
    contactPhone: phone,
    isFirstRun: false,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
  return updated;
}
