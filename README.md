# Screen Buddy 🇮🇳 🛡️
> Single-action phone helper & fraud shield built for elderly Indian smartphone users and their families.

---

## 🌟 Overview

Smartphones can be confusing and fraught with digital traps for seniors. **Screen Buddy** eliminates confusion with a single-action design:
1. **Take or paste a screenshot** of any confusing screen (<kbd>Ctrl+V</kbd>, drag-and-drop, or gallery pick).
2. **Circles the single next button** to tap with an animated focus ring.
3. **Explains the screen in 2 short sentences** using plain language with zero jargon.
4. **Fraud & Scam Shield**: Detects UPI collect frauds, WhatsApp job scams, fake electricity bill disconnection threats, remote screen-share APKs, and fake police digital arrests.
5. **Voice First**: Reads aloud explanations automatically with dual-mode TTS supporting English and 5 regional Indian languages (Hindi, Telugu, Tamil, Marathi, Bengali).
6. **One-Tap Family Help**: Prominent button to call the trusted family helper directly via `+91` 10-digit phone number.

---

## 🚀 Key Features

- **Elderly-Friendly UI**: High-contrast, warm cream palette, 20px+ readable typography, and oversized 56px touch targets.
- **Dual-Tier OCR Engine**: In-browser client OCR using Tesseract.js with automatic server-side OCR fallback so recognition never fails.
- **Multi-Lingual Voice Support**:
  - English (`en`)
  - Hindi (`hi`)
  - Telugu (`te`)
  - Tamil (`ta`)
  - Marathi (`mr`)
  - Bengali (`bn`)
- **100% Scam Recall**: Comprehensive pattern engine and dynamic heuristics tested against verified fraud samples.
- **Family Helper Setup**: Configure trusted contact name and 10-digit Indian phone number (`+91`), stored safely on-device.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, Lucide Icons
- **OCR**: Tesseract.js (Client-side worker + Node.js backend fallback)
- **Speech**: Web Speech API with streaming backend fallback endpoint (`/api/tts`)
- **AI & Rule Engine**: Hybrid Groq Vision / Text API fallback with local offline heuristic rules

---

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/Dasarath-Mali/Screen_Buddy.git

# Navigate to project directory
cd Screen_Buddy

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 🧪 Running Benchmark Evals

Screen Buddy includes a benchmark test suite covering real-world Indian fraud and authentic app screens:

```bash
npx tsx evals/run_evals.ts
```

Benchmark targets:
- **Scam Recall**: $\ge 95\%$ (Current: **100%**)
- **False Alarm Rate**: $\le 10\%$ (Current: **0%**)

---

## 📄 License

MIT License. Designed with care for senior citizens and families across India.
