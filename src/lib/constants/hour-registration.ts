/**
 * Hour registration category visibility.
 * Phase 2.2: Categories that show/hide project and contact selectors.
 */
export const HOUR_REGISTRATION_CATEGORIES = {
  /** Categories that should NOT show project/contact selector */
  HIDE_PROJECT_CONTACT: [
    "content_creation",
    "administration",
    "brainstorming",
    "research",
  ] as const,
  /** Categories that SHOULD show contact + project selector */
  SHOW_PROJECT_CONTACT: [
    "client",
    "labs",
    "client_acquisition",
    "traveling",
  ] as const,
} as const;

export function shouldShowProjectContact(category: string): boolean {
  return HOUR_REGISTRATION_CATEGORIES.SHOW_PROJECT_CONTACT.includes(
    category as (typeof HOUR_REGISTRATION_CATEGORIES.SHOW_PROJECT_CONTACT)[number]
  );
}
