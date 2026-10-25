import { AnalysisResult, BoundingBox } from './rules';

/**
 * Merges rule-based checks and model output: "most cautious result wins"
 */
export function mergeVerdicts(
  rulesResult: AnalysisResult,
  modelResult: AnalysisResult | null,
  elements: BoundingBox[]
): AnalysisResult {
  if (!modelResult) {
    return rulesResult;
  }

  // If either verdict is scam, scam beats everything
  if (rulesResult.verdict === 'scam' || modelResult.verdict === 'scam') {
    const combinedReasons = Array.from(
      new Set([...(rulesResult.scam_reasons || []), ...(modelResult.scam_reasons || [])])
    ).slice(0, 3);

    return {
      verdict: 'scam',
      confidence: Math.max(rulesResult.confidence, modelResult.confidence),
      scam_reasons: combinedReasons.length > 0 ? combinedReasons : ["Suspicious payment or pressure request detected."],
      screen_summary: modelResult.screen_summary || rulesResult.screen_summary,
      next_action: null, // Never show a next action on a scam screen
      explanation: modelResult.explanation && modelResult.verdict === 'scam' 
        ? modelResult.explanation 
        : rulesResult.explanation,
      call_for_help: true,
      source: modelResult.source || rulesResult.source,
    };
  }

  // If either verdict is caution, caution wins
  if (rulesResult.verdict === 'caution' || modelResult.verdict === 'caution') {
    // Choose the safest button (Cancel, Back, Close)
    let safestAction = modelResult.next_action;
    const safeRegex = /cancel|back|close|decline|no|reject|dismiss|बंद|वापस|రద్దు/i;
    
    // Check if model picked a dangerous button like Pay, Send, Approve
    const dangerousRegex = /pay|send|transfer|approve|confirm|proceed|buy|भुगतान|డబ్బు/i;
    if (safestAction && dangerousRegex.test(safestAction.label)) {
      // Override with a safe button if one exists
      const cancelEl = elements.find(e => safeRegex.test(e.text));
      if (cancelEl) {
        safestAction = {
          element_id: cancelEl.id,
          label: cancelEl.text,
          box: cancelEl.box,
        };
      }
    }

    return {
      verdict: 'caution',
      confidence: (rulesResult.confidence + modelResult.confidence) / 2,
      scam_reasons: Array.from(new Set([...(rulesResult.scam_reasons || []), ...(modelResult.scam_reasons || [])])),
      screen_summary: modelResult.screen_summary || rulesResult.screen_summary,
      next_action: safestAction || rulesResult.next_action,
      explanation: modelResult.explanation || rulesResult.explanation,
      call_for_help: modelResult.call_for_help || rulesResult.call_for_help,
      source: modelResult.source || rulesResult.source,
    };
  }

  // Both are safe
  // Double-check model's next action to ensure it matches real element box
  let validatedAction = modelResult.next_action;
  if (validatedAction) {
    const matchingElement = elements.find(e => e.id === validatedAction?.element_id);
    if (matchingElement) {
      validatedAction.box = matchingElement.box;
      validatedAction.label = matchingElement.text;
    }
  }

  return {
    verdict: 'safe',
    confidence: modelResult.confidence,
    scam_reasons: [],
    screen_summary: modelResult.screen_summary || rulesResult.screen_summary,
    next_action: validatedAction || rulesResult.next_action,
    explanation: modelResult.explanation || rulesResult.explanation,
    call_for_help: false,
    source: modelResult.source || rulesResult.source,
  };
}
