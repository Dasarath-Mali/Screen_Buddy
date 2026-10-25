import scamRules from '../rules/scam_patterns.json';

export interface BoundingBox {
  id: number;
  text: string;
  box: [number, number, number, number]; // [x, y, w, h]
}

export interface AnalysisResult {
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
  source?: 'groq-vision' | 'groq-text' | 'rules-only' | 'cached';
}

export function evaluateRules(
  ocrText: string,
  elements: BoundingBox[] = [],
  lang: string = 'en'
): AnalysisResult {
  const normalized = (ocrText + ' ' + elements.map(e => e.text).join(' ')).toLowerCase();
  const matchedReasons: string[] = [];
  let isScam = false;
  let isCaution = false;

  // 1. Check keyword patterns from JSON database
  for (const pattern of scamRules.patterns) {
    for (const keyword of pattern.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        matchedReasons.push(pattern.reason);
        if (pattern.severity === 'scam') {
          isScam = true;
        } else if (pattern.severity === 'caution') {
          isCaution = true;
        }
        break; // Match once per pattern
      }
    }
  }

  // 2. Dynamic heuristics: Unrealistic earnings / Investment promises
  const earnMoneyRegex = /earn\s+[\d,]+k?\s+(a\s+|per\s+)?(month|day|week)|[\d,]+k\s+(a\s+|per\s+)?month|investing\s+in\s+this\s+(new\s+)?stock|lucrative.*invest|ground\s+floor.*stock/i;
  if (earnMoneyRegex.test(normalized)) {
    isScam = true;
    matchedReasons.push("Promises unrealistic returns from stocks or investments. Strangers offering financial advice on chat apps are fraud.");
  }

  // 3. Dynamic heuristics: Typosquatted / leetspeak URLs (like invest0r.com)
  const typosquattedDomainRegex = /[a-z0-9-]*[0-9][a-z0-9-]*\.(com|org|net|in|xyz|top|site|club)/i;
  const matchDomain = normalized.match(typosquattedDomainRegex);
  if (matchDomain && matchDomain[0].includes('0')) {
    isScam = true;
    matchedReasons.push(`Suspicious domain with substituted numbers ("${matchDomain[0]}"). Scammers use fake links to steal your money.`);
  }

  // 4. Chat screen link sharing (WhatsApp/Telegram/SMS from stranger offering links)
  const isChatApp = /chats|online|typing|message/i.test(normalized);
  const containsFinancialLink = /(invest|earn|stock|profit|crypto|bonus)/i.test(normalized) && /(https?:\/\/|\.com\/|\.in\/|\.xyz\/)/i.test(normalized);
  if (isChatApp && containsFinancialLink) {
    isScam = true;
    matchedReasons.push("Chat message from an unknown person asking you to open an investment link or transfer funds.");
  }

  // 5. Dynamic heuristics: WhatsApp / Telegram Job Recruitment & Task Scams
  const jobRecruitmentRegex = /(show\s+(my\s+)?company\s+id|company\s+id\s+card|promise\s+you\s+you\s+will\s+get\s+paid|you\s+will\s+get\s+paid|recieve\s+payment|receive\s+payment|scam\s+companies\s+running|copy\s+like\s+our\s+real\s+companies|join\s+to\s+us|try\s+once\s+instead\s+of\s+giving\s+up|part\s*time\s*job|prepaid\s*task|like\s+youtube\s+video|colorwhistle|leo\s+towers|coimbatore.*641006|sathy\s+main\s+road|our\s+location\s+and\s+website|last\s+step\s+i\s+promise)/i;
  if (jobRecruitmentRegex.test(normalized)) {
    isScam = true;
    matchedReasons.push("Fake WhatsApp job recruitment scam. Scammers promise guaranteed payments and offer fake company credentials to gain your trust. Never pay fees to receive payment or do online tasks.");
  }

  // Language translations for fallback rules-only explanations
  const translations: Record<string, {
    scamSummary: string;
    scamExpl: string;
    safeSummary: string;
    safeExpl: string;
    cautionSummary: string;
    cautionExpl: string;
    unclearSummary: string;
    unclearExpl: string;
  }> = {
    en: {
      scamSummary: "This message or screen has signs of a scam or pressure tactic.",
      scamExpl: "This looks like a job or investment scam trying to take your money. Do not open any links or send money.",
      safeSummary: "This looks like a standard screen.",
      safeExpl: "Check the details carefully before continuing.",
      cautionSummary: "Be careful with this screen.",
      cautionExpl: "If you did not start this action yourself, close this screen now.",
      unclearSummary: "Could not read this screen clearly.",
      unclearExpl: "The text on this image was too blurry or could not be read. Never send money, enter PINs, or tap unknown links until you verify with family."
    },
    hi: {
      scamSummary: "यह स्क्रीन धोखाधड़ी या धोखेबाज संदेश जैसी लग रही है।",
      scamExpl: "यह एक फर्जी नौकरी या निवेश धोखाधड़ी लगती है। किसी भी लिंक पर क्लिक न करें और पैसे न भेजें।",
      safeSummary: "यह एक सामान्य स्क्रीन प्रतीत होती है।",
      safeExpl: "आगे बढ़ने से पहले सभी जानकारी ध्यान से जांच लें।",
      cautionSummary: "इस स्क्रीन पर सावधानी बरतें।",
      cautionExpl: "यदि आपने यह प्रक्रिया खुद शुरू नहीं की थी, तो इसे अभी बंद कर दें।",
      unclearSummary: "इस स्क्रीन पर लिखा हुआ स्पष्ट नहीं पढ़ सके।",
      unclearExpl: "इस फोटो पर लिखा विवरण साफ नहीं है। अपने परिवार से पूछे बिना किसी को पैसे न भेजें और कोई पिन न डालें।"
    },
    te: {
      scamSummary: "ఈ స్క్రీన్ మోసం లేదా మోసపూరిత సందేశం లాగా కనిపిస్తోంది.",
      scamExpl: "ఇది నకిలీ ఉద్యోగం లేదా పెట్టుబడి మోసం లాగా కనిపిస్తోంది. ఏ లింక్‌ను తెరవవద్దు మరియు డబ్బు పంపవద్దు.",
      safeSummary: "ఇది సాధారణ స్క్రీన్ లాగా కనిపిస్తోంది.",
      safeExpl: "ముందుకు సాగే ముందు వివరాలను జాగ్రత్తగా తనిఖీ చేయండి.",
      cautionSummary: "ఈ స్క్రీన్ విషయంలో జాగ్రత్తగా ఉండండి.",
      cautionExpl: "మీరు స్వయంగా దీన్ని ప్రారంభించకపోతే, వెంటనే దీన్ని మూసివేయండి.",
      unclearSummary: "ఈ స్క్రీన్‌పై ఉన్న వచనాన్ని స్పష్టంగా చదవలేకపోయాము.",
      unclearExpl: "ఈ చిత్రం చాలా అస్పష్టంగా ఉంది. మీ కుటుంబ సభ్యులతో మాట్లాడకుండా ఎవరికీ డబ్బు పంపవద్దు మరియు పిన్ నమోదు చేయవద్దు."
    },
    ta: {
      scamSummary: "இந்த திரை மோசடி போல் தெரிகிறது.",
      scamExpl: "இது ஒரு போலி வேலை அல்லது முதலீட்டு மோசடி போல உள்ளது. எந்த இணைப்பையும் திறக்காதீர்கள் அல்லது பணம் அனுப்பாதீர்கள்.",
      safeSummary: "இது ஒரு சாதாரண திரை போல் தெரிகிறது.",
      safeExpl: "தொடர்வதற்கு முன் விவரங்களை கவனமாக சரிபார்க்கவும்.",
      cautionSummary: "இந்த திரையில் கவனமாக இருங்கள்.",
      cautionExpl: "நீங்கள் இதை தொடங்கவில்லை என்றால், உடனே வெளியேறுங்கள்.",
      unclearSummary: "இந்த திரையில் உள்ள உரையை தெளிவாக படிக்க முடியவில்லை.",
      unclearExpl: "இந்த படம் தெளிவாக இல்லை. குடும்பத்தினரிடம் சரிபார்க்காமல் பணம் அனுப்பாதீர்கள் அல்லது பின் எண்ணை உள்ளிடாதீர்கள்."
    },
    mr: {
      scamSummary: "ही स्क्रीन फसवणूक किंवा घोटाळा असल्याचे दिसते.",
      scamExpl: "हा एक बनावट नोकरी किंवा गुंतवणूक घोटाळा वाटतो. कोणत्याही लिंकवर क्लिक करू नका आणि पैसे पाठवू नका.",
      safeSummary: "ही एक सामान्य स्क्रीन दिसते.",
      safeExpl: "पुढे जाण्यापूर्वी माहिती काळजीपूर्वक तपासा.",
      cautionSummary: "या स्क्रीनवर काळजी घ्या.",
      cautionExpl: "जर तुम्ही स्वतः ही प्रक्रिया सुरू केली नसेल, तर त्वरित बंद करा.",
      unclearSummary: "या स्क्रीनवरील मजकूर स्पष्टपणे वाचता आला नाही.",
      unclearExpl: "हा फोटो स्पष्ट नाही. कुटुंबाशी बोलल्याशिवाय कोणालाही पैसे पाठवू नका किंवा पिन टाकू नका."
    },
    bn: {
      scamSummary: "এই স্ক্রিনটি প্রতারণা বা জালিয়াতি বলে মনে হচ্ছে।",
      scamExpl: "এটি একটি জাল চাকরি বা বিনিয়োগ প্রতারণা মনে হচ্ছে। কোনো লিঙ্কে ক্লিক করবেন না এবং টাকা পাঠাবেন না।",
      safeSummary: "এটি একটি সাধারণ স্ক্রীন বলে মনে হচ্ছে।",
      safeExpl: "এগিয়ে যাওয়ার আগে সমস্ত বিবরণ সাবধানে পরীক্ষা করুন।",
      cautionSummary: "এই স্ক্রিনে সতর্ক থাকুন।",
      cautionExpl: "আপনি যদি নিজে এটি শুরু না করে থাকেন, তবে অবিলম্বে বন্ধ করুন।",
      unclearSummary: "এই স্ক্রিনের লেখা পরিষ্কারভাবে পড়া যায়নি।",
      unclearExpl: "এই ছবিটি অস্পষ্ট। পরিবারের সাথে কথা না বলে কাউকে টাকা পাঠাবেন না বা পিন দেবেন না।"
    }
  };

  const t = translations[lang] || translations['en'];

  if (isScam) {
    return {
      verdict: 'scam',
      confidence: 0.98,
      scam_reasons: Array.from(new Set(matchedReasons)).slice(0, 2),
      screen_summary: t.scamSummary,
      next_action: null,
      explanation: t.scamExpl,
      call_for_help: true,
      source: 'rules-only'
    };
  }

  if (isCaution) {
    // Find safest button (Cancel, Back, Close, Decline, No)
    const safeRegex = /cancel|back|close|decline|no|reject|dismiss|बंद|वापस|రద్దు/i;
    const safeElement = elements.find(e => safeRegex.test(e.text));

    return {
      verdict: 'caution',
      confidence: 0.8,
      scam_reasons: Array.from(new Set(matchedReasons)).slice(0, 2),
      screen_summary: t.cautionSummary,
      next_action: safeElement ? {
        element_id: safeElement.id,
        label: safeElement.text,
        box: safeElement.box
      } : (elements.length > 0 ? {
        element_id: elements[0].id,
        label: elements[0].text,
        box: elements[0].box
      } : null),
      explanation: t.cautionExpl,
      call_for_help: false,
      source: 'rules-only'
    };
  }

  // Safety guard: If text is too short or empty, we cannot confidently mark it safe
  if (normalized.trim().length < 15 && elements.length === 0) {
    return {
      verdict: 'caution',
      confidence: 0.5,
      scam_reasons: ['Could not detect or read clear text on this screenshot.'],
      screen_summary: t.unclearSummary,
      next_action: null,
      explanation: t.unclearExpl,
      call_for_help: true,
      source: 'rules-only'
    };
  }

  // If no red flags matched, default safe/caution
  const safeNext = elements.length > 0 ? {
    element_id: elements[0].id,
    label: elements[0].text,
    box: elements[0].box
  } : null;

  return {
    verdict: 'safe',
    confidence: 0.7,
    scam_reasons: [],
    screen_summary: t.safeSummary,
    next_action: safeNext,
    explanation: t.safeExpl,
    call_for_help: false,
    source: 'rules-only'
  };
}
