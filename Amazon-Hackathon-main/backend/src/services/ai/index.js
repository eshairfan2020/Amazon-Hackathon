/** AI provider placeholder. Phase 3 (forecasting) and Phase 5 (copilot) plug Bedrock in here. */
export function createAiProvider(aiConfig) {
  return { mode: aiConfig.provider };
}
