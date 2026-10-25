/**
 * Token estimation utilities for Groq API rate-limiting
 */

export function estimateImageTokens(width = 1024, height = 1024): number {
  // Rough estimate for vision model tiles
  // Standard 1024x1024 image typically consumes ~800-1600 tokens depending on tile resolution
  const tiles = Math.ceil(width / 512) * Math.ceil(height / 512);
  return Math.max(1000, tiles * 350);
}

export function estimatePromptTokens(text: string): number {
  // ~4 characters per token
  return Math.ceil((text || '').length / 4);
}

export function estimateTotalTokens(promptText: string, maxOutputTokens = 400, hasImage = true): number {
  const promptTokens = estimatePromptTokens(promptText);
  const imageTokens = hasImage ? estimateImageTokens() : 0;
  return promptTokens + imageTokens + maxOutputTokens;
}
