# BUILDME.md — Screen Buddy for Seniors

> Help at the exact moment of confusion. Screenshot → circle the next button → plain-language explanation → loud warning if it looks like a scam.

---

## 1. What this is (one paragraph)

An elderly user takes a screenshot of a confusing phone screen (UPI app, government portal, payment pop-up, OTP screen, "KYC expired" message). They share it to Screen Buddy. In under ~5 seconds the app shows the **same screenshot with one button circled**, a **2-sentence explanation in their language**, and either a green "Looks safe" or a big red **"This looks like a scam. Do not continue."** It can also read the answer aloud.

**Non-goals (for v1):** no tutorials, no accounts, no chat, no controlling the phone, no touching real payments.

---

## 2. Target user and design rules

- User: 60+, low digital confidence, often a regional-language speaker (Hindi, Telugu, Tamil, Marathi, Bengali, English).
- Helper user: a son/daughter who installs it once for the parent.

Design rules (treat as hard requirements):

1. **One screen, one action.** Never more than one circled button.
2. **Max 2 short sentences** of explanation. Reading level ~Class 5.
3. **Huge text** (min 20sp body, 28sp verdict), high contrast, big tap targets (min 56dp).
4. **Voice first-class.** A "🔊 Read to me" button on every result.
5. **Scam warning beats everything.** If scam, hide the "next step" and show only the warning plus "Call someone you trust".
6. **Never ask the user to type anything** on the main flow.
7. **Light, clean, minimal.** Warm white background, generous spacing, no dark mode in v1.
8. **Calm motion only.** Slow, soft animations that guide the eye; always honor reduced-motion settings (see §9).

---

## 3. Core user flow

```
[Screenshot taken] → [Share → Screen Buddy]  (or open app → "Pick screenshot")
        ↓
[Loading: "Looking at your screen…" + spinner, voice says it too]
        ↓
[Result screen]
   ├─ Screenshot with ONE red circle/arrow on the next button
   ├─ Verdict banner: SAFE / BE CAREFUL / SCAM
   ├─ 2-sentence explanation (user's language)
   ├─ 🔊 Read to me
   └─ 📞 "Call my family" (preset number)
```

---

## 4. Stack: 100% free, web only

Everything below has a free tier. No credit card needed to start. No native app.

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + Tailwind + Framer Motion, installable PWA | Works on any phone browser, no app store |
| Hosting | Cloudflare Pages, Vercel, or Netlify (free plan) | Free static hosting plus serverless functions |
| Backend | One serverless function: `POST /api/analyze` | Keeps the Groq key secret (never put it in frontend code) |
| LLM | **Groq API (free tier)**, OpenAI-compatible endpoint | Very fast, free key |
| Rate-limit store | Upstash Redis (free plan) | Serverless functions have no shared memory, so counters must live outside them |
| OCR | Tesseract.js in the browser (free, on-device) | No server cost, gives element boxes |
| Voice | Browser Web Speech API (`speechSynthesis`) | Free, no key |
| Bot protection (optional) | Cloudflare Turnstile (invisible mode) | Free, stops scripts from burning your quota |
| Database | None | No accounts, no stored images |

**Groq specifics**
- Endpoint: `https://api.groq.com/openai/v1/chat/completions`
- Use a **vision-capable** model for the main call. Groq changes its model roster often, so **do not hardcode a model name**. Check `console.groq.com/docs/models` for the current vision model and put it in `GROQ_VISION_MODEL`.
- Keep a **text-only** model in `GROQ_TEXT_MODEL` for the fallback path (§10).
- Use JSON mode (`response_format: {"type": "json_object"}`), `temperature: 0`, `max_tokens: 400`.
- Free-tier limits are **per model and per organization (not per API key)**, and they are small and change over time. Read your real numbers at `console.groq.com/settings/limits` and put them in env vars. Exceeding them returns HTTP 429.

Minimal server call:

```ts
const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: process.env.GROQ_VISION_MODEL,
    temperature: 0,
    max_tokens: 400,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },          // prompts/analyze.md
      { role: "user", content: [
          { type: "text", text: `Language: ${lang}
Elements: ${JSON.stringify(elements)}` },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
      ]},
    ],
  }),
});
```

**Shrink the image before upload (saves tokens, quota, and time):** resize in the browser to about 1024px on the long edge, JPEG quality 0.8. Aim for well under 1 MB. Check Groq's docs for the current image size limit.

---

## 5. The key design trick: don't trust the model's pixel coordinates

LLMs are bad at precise bounding boxes. Do this instead:

1. **Detect elements first** with **Tesseract.js running in the user's browser** (free, no server load). Install the `eng`, `hin`, `tel` language packs. Output a list like:
   ```json
   [{"id": 1, "text": "Pay ₹4,999", "box": [x, y, w, h]},
    {"id": 2, "text": "Cancel",     "box": [x, y, w, h]}]
   ```
2. **Draw numbered labels** on a working copy of the image (tiny badges 1, 2, 3…) *or* just send the list.
3. **Send the screenshot + element list to the model.** Ask it to return the **element id**, not coordinates.
4. **Your code** looks up the id, takes the real box, and draws the circle on the original screenshot.

For icon-only buttons (no text), fall back to a UI-element detector or ask the model for a normalized box (0–1) and clamp/validate it.

---

## 6. API contract

### `POST /api/analyze`

Request: `multipart/form-data`
- `image` (png/jpg, max ~5 MB; downscale client-side to ~1280px long edge)
- `lang` (`en`, `hi`, `te`, `ta`, `mr`, `bn`)
- `app_hint` (optional: `upi`, `govt`, `bank`, `unknown`)

Response:
```json
{
  "verdict": "safe | caution | scam",
  "confidence": 0.0,
  "scam_reasons": ["Asks for UPI PIN to RECEIVE money"],
  "screen_summary": "This is a payment request from an unknown person.",
  "next_action": {
    "element_id": 7,
    "label": "Decline",
    "box": [x, y, w, h]
  },
  "explanation": "Someone is asking you to pay ₹4,999. You do not know them. Tap Decline.",
  "call_for_help": true
}
```

If `verdict == "scam"`, `next_action` may be `null` and the UI shows only the warning.

---

### Error and limit responses

| Status | When | Body |
|---|---|---|
| 400 | Bad or oversized image, missing fields | `{"error":"bad_image","message":"Please try another screenshot."}` |
| 429 | Per-user limit hit | `{"error":"slow_down","retry_after":20}` plus `Retry-After` header |
| 503 | Our Groq quota is used up or busy | `{"error":"busy","retry_after":60,"fallback":{...rules-only verdict...}}` |

Always send these headers on success so the UI can show a calm "x checks left today" hint:
`X-RateLimit-Remaining`, `X-RateLimit-Reset`.

The frontend must **never show a raw error**. Every error becomes a friendly sentence plus a countdown (see §10.6).

---

## 7. The model prompt (put in `prompts/analyze.md`)

System prompt skeleton:

```
You are Screen Buddy, a patient helper for elderly Indian phone users.
You receive a phone screenshot and a numbered list of on-screen elements.

Decide:
1. What screen is this? (one plain sentence)
2. Does it look like a scam, phishing, fake app, or pressure tactic?
3. If NOT a scam: which ONE element should the user tap next to safely
   continue, or to safely back out if unsure?

Rules:
- Answer in {lang}. Max 2 short sentences. Simple words. No jargon.
- Return ONLY JSON matching the schema.
- If you are unsure, choose verdict "caution" and pick the SAFEST option
  (Cancel / Back / Close), never the money-moving one.
- NEVER tell the user to enter a UPI PIN, OTP, CVV, Aadhaar number,
  password, or card details. If the screen asks for these in a suspicious
  context, say so.
- NEVER tell the user to tap "Pay", "Send", "Confirm", "Approve" unless the
  user clearly started that payment themselves (and even then, tell them to
  check the amount and name first).
- You cannot verify the real app. Say "looks like" not "is".
```

---

## 8. Scam rules to encode (rule layer + model)

Run a **cheap rule-based check in code** *before and alongside* the model, and take the more cautious result.

Red flags:
- "Collect request" / "Request money" asking the user to enter PIN or approve to **receive** money (receiving never needs a PIN).
- Urgency: "Last chance", "Account blocked in 2 hours", "Pay now to avoid arrest/FIR/penalty".
- Fake authority: "CBI", "Customs", "TRAI", "Police", "RBI", "Income Tax" asking for payment.
- KYC / PAN / Aadhaar update links, "Your SIM will be blocked".
- Electricity bill disconnection tonight, fake courier "package held" payments.
- Screenshot is of an SMS/WhatsApp, not an app, asking to install an APK or "remote support" app (AnyDesk, TeamViewer, QuickSupport).
- Lottery / prize / KBC / job-offer payments, "refund" requiring a payment first.
- Unknown merchant name, mismatched amount, amount much larger than typical.
- Screen asks for card number + CVV + OTP together on an unfamiliar page.
- Look-alike URLs (`sbi-kyc-update.xyz`, `gov-india-refund.in`).

Output for scam: red banner, big text, voice reads it, and a button **"Call [family contact]"**.

Keep this list in `rules/scam_patterns.json` so it can be updated without redeploying.

---

## 9. UI / UX spec (light, clean, minimal, with purposeful motion)

### 9.1 Look and feel

- **Light theme only.** No dark mode in v1. Warm white canvas, lots of empty space, one idea per screen.
- Soft, rounded, calm. Think "friendly pharmacist", not "tech dashboard".
- Big type, big buttons, thin borders, gentle shadows. No gradients except one subtle tint on the verdict banner.
- Icons: simple line icons (Lucide), 2px stroke, always paired with a word.

**Design tokens (put in `theme.ts` / CSS variables):**

```css
:root {
  --bg:        #FAFAF7;   /* warm white canvas */
  --surface:   #FFFFFF;   /* cards */
  --ink:       #1B1F23;   /* main text */
  --ink-soft:  #5B6670;   /* secondary text */
  --line:      #E8E8E3;   /* hairline borders */

  --brand:     #2563EB;   /* primary buttons, links */
  --brand-soft:#EAF1FF;

  --safe:      #16A34A;   --safe-soft:    #E8F7EE;
  --caution:   #D97706;   --caution-soft: #FFF4E0;
  --scam:      #DC2626;   --scam-soft:    #FDECEC;

  --radius-lg: 24px;      --radius-md: 16px;
  --shadow:    0 6px 24px rgba(20, 30, 50, 0.07);

  --fs-body:   1.25rem;   /* 20px min */
  --fs-title:  1.75rem;
  --fs-verdict:2rem;
}
```

**Typography:** `Inter` for English plus `Noto Sans Devanagari`, `Noto Sans Telugu`, `Noto Sans Tamil`, `Noto Sans Bengali` as fallbacks. Weight 500 body, 700 headings. Line-height 1.5. Never use light weights.

**Layout:** single column, max-width 480px, 24px side padding, thumb-reachable primary button fixed near the bottom (sticky bottom bar with safe-area padding).

### 9.2 Motion principles

Animation exists to **guide the eye and calm the user**, never to decorate.

1. **Slow and soft.** 250 to 500 ms, ease-out. Springs with low bounce. Nothing flashes or strobes (seniors, photosensitivity).
2. **One moving thing at a time.** The eye should know where to look.
3. **Motion explains.** Every animation answers "what just happened" or "where do I tap".
4. **Respect `prefers-reduced-motion`.** When on, replace motion with simple fades; keep the circle static but visible.
5. **Never animate the scam warning in a frightening way.** One gentle emphasis, then stillness.

### 9.3 Screens and their animations

**1. Home**
- Big heading ("Show me the confusing screen"), one primary button "Pick screenshot", one secondary "How it works".
- On load: heading and buttons fade-up with a 60 ms stagger.
- Primary button has a very slow "breathing" glow (scale 1 → 1.02, 3 s loop) to draw the eye.
- Press state: scale to 0.97 with a soft ripple.
- Language chips (English / हिन्दी / తెలుగు) slide in as a segmented control with a sliding highlight pill.

**2. Picking and preview**
- Chosen screenshot **scales up from the button** into a rounded card (shared-element transition) and gently floats with a soft shadow.

**3. Analyzing (loading)**
- A thin **scanning line** sweeps top to bottom over the screenshot (1.6 s loop, blue, 30% opacity glow).
- Screenshot corners show little bracket marks that tighten in, like a camera focusing.
- Caption cycles with a crossfade: "Looking at your screen…" → "Checking if it is safe…" → "Finding the right button…". Spoken once if voice is on.
- No percentage bars (we can't know it); no spinning wheels alone.

**4. Result: safe / caution**
- Scan line fades out, verdict chip **springs up** from the bottom (green tick draws itself with a stroke animation, ~400 ms; amber for caution).
- **The circle draws itself** around the target button: SVG `stroke-dashoffset` from full to 0 over 600 ms, then settles into a slow **pulse ring** (opacity 0.6 → 0, scale 1 → 1.4, 2 s loop). A small hand/arrow icon bobs 4 px below it.
- The rest of the screenshot **dims slightly** (opacity 0.55 with a light blur on the non-target area) so the button pops. Spotlight effect.
- Explanation text fades in word-group by word-group (2 sentences max, ~300 ms).
- Pinch-to-zoom on the screenshot; the circle scales with it.
- Bottom bar: 🔊 "Read to me" (primary) and "Done".

**5. Result: scam**
- Same light theme. Screen tints to `--scam-soft`; a white card slides up with a red top border.
- Big icon (shield with exclamation) does **one** gentle "shake-and-settle" (about 500 ms), then stays still.
- Headline: **"This looks like a scam. Do not continue."** at `--fs-verdict`, bold.
- 1 or 2 reasons appear as simple lines with small red dots, fading in one after another.
- The suspicious part of the screenshot gets a **soft red outline** (not the "tap here" circle). No "next step" is shown.
- Buttons: "📞 Call my family" (large, filled), "Close this" (outline). Voice reads the warning automatically.

**6. Voice playback**
- While speaking, the 🔊 button morphs into a **soft waveform** (5 bars bouncing at different phases). The sentence being read gets a subtle highlight sweep.
- Speed toggle: 🐢 slow (default) / normal.

**7. Setup (for the helper child)**
- Stepper with 3 dots that fill as you go; each step slides horizontally. Large inputs, inline validation with a gentle color fade (no red flashing).
- Final step: a checkmark draw and "All set. Hand the phone back." 

**8. Errors and empty states**
- Friendly line illustration (simple SVG) that fades in, one sentence, one button. Example: "That picture is a bit blurry. Please try again." The icon wiggles once.

### 9.4 Micro-interactions checklist

| Element | Interaction |
|---|---|
| All buttons | Press: scale 0.97, 120 ms; release: spring back |
| Cards | Enter: fade + translateY(12px → 0), 350 ms |
| Verdict chip | Spring in, tick/exclamation draws itself |
| Target circle | Draws itself, then slow pulse |
| Screen dim spotlight | Animate opacity of overlay, 400 ms |
| Page changes | Shared-element transition for the screenshot, crossfade for the rest |
| Toasts | Slide down from top, auto-dismiss in 5 s, readable size |

### 9.5 Implementation notes

- **Stack:** React + Tailwind CSS + **Framer Motion** (springs, shared-element `layoutId`, staggered children). Lucide icons.
- Circle and tick animations: inline SVG with `pathLength` animated by Framer Motion.
- Scanning line and pulse ring: pure CSS keyframes (cheaper, runs on GPU).
- Waveform: 5 `div`s with CSS `animation-delay`.
- Keep everything on `transform` and `opacity` only, so it stays smooth on cheap Android phones. Test on a low-end device (2 GB RAM).
- Wrap animations in a `useReducedMotion()` check.
- Accessibility: min contrast 4.5:1, focus rings, `aria-live="polite"` on the verdict text, all icons labeled, tap targets at least 56 px, support system font scaling up to 200%.
- Avoid: parallax, auto-playing carousels, confetti, bouncing attention-grabbers, and anything that loops fast.

### 9.6 Annotation component

`<AnnotatedScreenshot image box verdict />`
- Renders the image in a rounded card, draws an SVG overlay in the same coordinate space.
- Circle = ellipse around `box`, 20% larger, 4 px stroke, `--brand` for safe/caution target; `--scam` outline for suspicious regions.
- Spotlight = SVG mask with a rounded cutout over the target, overlay `rgba(250,250,247,0.6)` plus 2 px backdrop blur.
- Props for `reducedMotion` to render the static version.

---

## 10. Free-tier setup, Groq, and rate limiting

Free APIs have small limits that are shared by **all your users together**. A few people tapping at once can use up the whole minute. So rate limiting is not optional; it is part of the product. Build it in layers.

### 10.1 Know your budget (do this first)

1. Open `console.groq.com/settings/limits` and write down, for your chosen models: requests/minute (RPM), requests/day (RPD), tokens/minute (TPM), tokens/day (TPD).
2. Put them in env vars (§17). Set your app's limits to **about 80%** of these so you never hit Groq's wall.
3. Measure the real tokens per analysis (prompt + image + output). Image-heavy calls use far more tokens than chat, so **TPM/TPD usually run out before RPM/RPD**. Do the math:
   `max users per day ≈ TPD / tokens per analysis`.

### 10.2 The layers

**Layer 1: Browser (be polite)**
- Disable the button while a request is running. Only one request in flight.
- 10-second cooldown after each result.
- Resize the image and run OCR locally before sending.

**Layer 2: Per-user limit (stop one person using everything)**
- Key = IP address + a random anonymous device id stored in a cookie.
- Sliding window, e.g. **5 requests/minute and 30 requests/day** per user.
- Use `@upstash/ratelimit` with Upstash Redis:

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
export const perUserMinute = new Ratelimit({
  redis, limiter: Ratelimit.slidingWindow(5, "1 m"), prefix: "sb:u:min",
});
export const perUserDay = new Ratelimit({
  redis, limiter: Ratelimit.slidingWindow(30, "1 d"), prefix: "sb:u:day",
});
```

**Layer 3: Global limiter (protect your Groq quota)**
- One shared token bucket in Redis sized to ~80% of Groq's RPM **and** TPM.
- Before calling Groq, estimate tokens = prompt + image + `max_tokens`. If the bucket can't cover it, either wait in a short queue (max ~8 seconds) or return `503 busy` with `retry_after`.
- This is what stops "10 people at once" from causing a wall of 429s.

**Layer 4: Daily budget circuit breaker**
- Keep a Redis counter of requests and estimated tokens used today.
- At **90%**: switch to *lite mode* (smaller image, shorter prompt, text-model fallback).
- At **100%**: stop calling Groq. Show the rules-only result plus "Screen Buddy needs a rest. Please try again tomorrow."
- Reset the counter when Groq's daily window resets (check which timezone/window it uses).

**Layer 5: Obey Groq's own 429s**
- On 429, read the `retry-after` header. Retry **once** after that delay (with a little jitter). If it fails again, return `503 busy`.
- Read Groq's rate-limit response headers (`x-ratelimit-remaining-*`, `x-ratelimit-reset-*`) and update your global bucket from them, so your counters stay honest.

**Layer 6: Cache duplicates (saves quota)**
- Hash the downscaled image (SHA-256). If the same hash was analyzed in the last 10 minutes, return the cached JSON.
- Cache **only the hash and the JSON result**, never the image itself.

**Layer 7: Abuse protection**
- Accept only `image/jpeg` and `image/png`, hard size cap (e.g. 1.5 MB after resize).
- Optional: Cloudflare Turnstile in invisible mode, verified on the server.
- Never expose `GROQ_API_KEY` to the browser. Set a monthly spend alert/limit if you ever upgrade.

### 10.3 Fallback chain (never leave the user with nothing)

```
1. Vision model on Groq  (screenshot + OCR elements)        → best answer
2. Text model on Groq    (OCR text + element list only)     → good answer, lower cost
3. Rules-only (in your code, no API)                        → scam red flags still work
4. Friendly "busy, try again in N seconds" with countdown
```

The rules-only step matters most: a scam warning must still appear even when the API is down or out of quota. Keep the rule engine fast and fully local to the function.

### 10.4 Request flow (server)

```
POST /api/analyze
  1. verify Turnstile (if enabled)
  2. validate image + lang
  3. perUserMinute / perUserDay check        → 429 slow_down
  4. cache lookup by image hash              → return cached
  5. run rules.ts on OCR text                → candidate verdict
  6. global bucket reserve(estimatedTokens)  → 503 busy (with rules-only fallback)
  7. call Groq vision (timeout 12 s)
       on 429 → wait retry-after, retry once
       on fail → text-model fallback → rules-only
  8. merge(rules, model): most cautious wins
  9. update global counters from response headers
 10. cache result by hash, return JSON
```

### 10.5 Optional: bring-your-own key

For power users or a family helper who wants no limits:
- Settings has "Use my own Groq key" (paste field).
- Store it **only in the browser's localStorage**, send it per request in a header, and never log or save it on the server.
- Requests with a user key skip the global bucket, but keep the per-user limits for politeness.

### 10.6 UI for "busy" and limits (keep it calm)

- Never say "429" or "rate limit". Say: **"Lots of people are asking right now. I'll try again in 20 seconds."**
- A soft **countdown ring** (thin circle that slowly empties) with a breathing animation; the app **auto-retries** when it hits zero.
- If quota is gone for the day: friendly illustration, "Screen Buddy is resting. Please try again tomorrow," plus the **rules-only warning if one applies**.
- Small footer hint: "3 checks left today" (from `X-RateLimit-Remaining`).
- Always keep "Call my family" visible on these screens.

### 10.7 Free deployment checklist

- [ ] Create Groq account, generate API key
- [ ] Read real limits from `console.groq.com/settings/limits`
- [ ] Create Upstash Redis database (free), copy REST URL and token
- [ ] Deploy frontend + serverless function to Cloudflare Pages / Vercel / Netlify
- [ ] Add env vars in the host's dashboard (never commit `.env`)
- [ ] Load-test with 20 quick requests; confirm you get `429`/`503` with friendly messages, not crashes
- [ ] Confirm the scam warning still shows when Groq is intentionally failed (set a bad key)

---

## 11. Backend modules

```
/api
  analyze.ts                # POST /api/analyze (serverless entry)
/server
  /services/ratelimit.ts    # per-user (Upstash) + global token bucket + daily breaker
  /services/groq.ts         # Groq call, timeout, retry-after handling, JSON validation
  /services/fallback.ts     # vision → text model → rules-only
  /services/rules.ts        # scam pattern checks (no network)
  /services/merge.ts        # combine rules + model verdict (most cautious wins)
  /services/cache.ts        # image-hash → JSON result, 10 min TTL
  /services/turnstile.ts    # optional bot check
  /prompts/analyze.md
  /rules/scam_patterns.json
  /lib/tokens.ts            # estimate tokens for the global limiter
/src (frontend)
  /lib/ocr.ts               # Tesseract.js element detection
  /lib/resize.ts            # downscale + JPEG encode
  /components/BusyCountdown.tsx
```

Validation: parse model output with a schema (zod / pydantic). On invalid JSON, retry once, then fall back to `caution` with "I'm not sure. Please ask someone you trust."

---

## 12. Privacy and safety (non-negotiable)

- **Do not store screenshots.** Process in memory, delete immediately. No logs of image content.
- Strip EXIF/location. Tell the user plainly: "Your picture is not saved."
- Offer **optional on-device blur** for account numbers before upload (v2).
- No login, no ads, no tracking in v1.
- Clear disclaimer in-app: "I give guidance, not a guarantee. When in doubt, call your bank on the number on your card."
- Never auto-tap, never read OTP SMS, never request accessibility permissions in v1.
- Rate-limit by IP and device (see §10) to protect the free quota and prevent abuse.
- Tell users honestly: the screenshot is sent to an AI service (Groq) to be analyzed and is not saved by Screen Buddy. Read Groq's current data policy and link it in the app's About page.
- Never put the Groq key in frontend code, git history, or logs.

---

## 13. Languages and voice

- v1 languages: English, Hindi, Telugu (add Tamil, Marathi, Bengali next).
- Have the model write the explanation **directly in the target language** (not translate after).
- Keep the UI strings in `i18n/*.json`.
- TTS: Web Speech API first; check that the device actually has a voice for the language, else fall back to a cloud TTS.
- Add speed control (slow default).

---

## 14. Testing and evals (don't skip)

Build a folder `/evals` with **50–100 labeled screenshots**:
- 30% genuine screens (PhonePe, GPay, Paytm, BHIM, DigiLocker, UMANG, IRCTC, bank apps).
- 40% scam screens (fake collect request, fake KYC, fake refund, fake electricity bill, remote-access app prompt).
- 30% ambiguous / tricky.

Metrics:
- **Scam recall** (most important; target ≥ 95%). Missing a scam is the worst failure.
- False-alarm rate on genuine screens (target ≤ 10%; too many false alarms and users ignore the app).
- **Wrong-button rate**: how often the circled button is not the safest correct one (target < 5%).
- Latency p95 < 6 s.

Also test with 5 real seniors. Watch silently. Every place they hesitate is a bug.

---

## 15. Milestones

| # | Goal | Done when |
|---|------|-----------|
| 1 | Skeleton | Upload image → server returns hardcoded JSON → UI draws circle |
| 2 | OCR + elements | Element list correct on 10 sample screens |
| 3 | Groq integration | Verdict + element id returned from Groq, schema-validated |
| 3b | Rate limiter + fallbacks | Per-user + global limits work; 20-request burst test returns friendly errors; rules-only fallback shows scam warning with a bad API key |
| 4 | Scam rule layer | All red-flag patterns tested, merge logic works |
| 5 | Senior-friendly UI | Big text, voice, 3 languages, scam screen |
| 6 | Evals + tuning | Metrics in §14 hit |
| 7 | Pilot | 5–10 real seniors use it for a week |

---

## 16. Later ideas (not now)

- Native Android floating button ("Help me with this screen").
- Family dashboard: child gets a ping when the parent's screen was marked scam (opt-in).
- Voice question: "Beta, ye kya hai?" after the screenshot.
- Report-a-scam to cybercrime.gov.in / 1930 helpline with one tap.
- WhatsApp bot: send screenshot to a number, get annotated image back.

---

## 17. Env vars

```
# Groq
GROQ_API_KEY=
GROQ_VISION_MODEL=        # check console.groq.com/docs/models for the current vision model
GROQ_TEXT_MODEL=          # fallback text-only model
GROQ_TIMEOUT_MS=12000

# Your Groq free-tier numbers (copy from console.groq.com/settings/limits)
GROQ_RPM=
GROQ_TPM=
GROQ_RPD=
GROQ_TPD=
LIMIT_SAFETY_FACTOR=0.8   # use only 80% of the above

# Per-user limits
USER_LIMIT_PER_MIN=5
USER_LIMIT_PER_DAY=30

# Upstash Redis (free)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Optional bot check
TURNSTILE_SECRET_KEY=

# Images
MAX_IMAGE_MB=1.5
MAX_IMAGE_EDGE_PX=1024
CACHE_TTL_SECONDS=600
```

---

## 18. First thing to do today

1. Collect 20 real screenshots (blur personal info).
2. Get a free Groq key and write `prompts/analyze.md`. Test it in Groq's playground with those screenshots + a hand-made element list.
3. Only after the prompt works, build the app around it.

The prompt plus the rules plus the evals are the product. The UI is the easy part.
