import { AnalysisResult, BoundingBox, evaluateRules } from './rules';
import { callGroqVision, callGroqText, GroqCallOptions } from './groq';
import { mergeVerdicts } from './merge';

export async function executeAnalysisFallbackChain(
  options: GroqCallOptions
): Promise<{ result: AnalysisResult; fallbackUsed: boolean }> {
  // Step A: Immediate local rules evaluation (zero latency, zero cost)
  const rulesResult = evaluateRules(options.ocrText || '', options.elements, options.lang);

  // If rules detect an unambiguous scam, we can prioritize user safety immediately,
  // or merge it with model analysis.
  let modelResult: AnalysisResult | null = null;
  let fallbackUsed = false;

  // If apiKey is present and not daily-exhausted, attempt Vision model
  if ((options.apiKey || process.env.GROQ_API_KEY) && !options.isLiteMode) {
    try {
      modelResult = await callGroqVision(options);
    } catch (visionErr) {
      console.warn('Groq Vision model failed, falling back to text model:', (visionErr as Error).message);
      fallbackUsed = true;

      // Step B: Text-only model fallback
      try {
        modelResult = await callGroqText(options);
      } catch (textErr) {
        console.warn('Groq Text model failed, falling back to local rules:', (textErr as Error).message);
        fallbackUsed = true;
      }
    }
  } else if ((options.apiKey || process.env.GROQ_API_KEY) && options.isLiteMode) {
    // In lite mode, skip vision directly to text model to conserve tokens
    try {
      modelResult = await callGroqText(options);
    } catch {
      fallbackUsed = true;
    }
  } else {
    // No API key configured
    fallbackUsed = true;
  }

  // Step C: Merge rules with model result (most cautious wins)
  const finalResult = mergeVerdicts(rulesResult, modelResult, options.elements);

  return {
    result: finalResult,
    fallbackUsed,
  };
}
