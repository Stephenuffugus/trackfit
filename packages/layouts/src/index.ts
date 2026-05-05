/**
 * Public surface of the @trackfit/layouts package.
 *
 * The layout suggester answers "what can I build with this pile of track?"
 * against a hand-tuned catalog of named templates. Pure rule-based math —
 * no LLM, no web access.
 */
export { LAYOUT_TEMPLATES } from "./catalog.js";
export { bucketInventory, suggestLayouts } from "./suggest.js";
export type {
  LayoutShortfall,
  LayoutSuggestion,
  LayoutTemplate,
  SuggesterInput,
  SuggesterInventoryItem,
} from "./types.js";
