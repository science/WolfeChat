/**
 * Icon Style Utilities
 *
 * Provides consistent icon styling classes for toolbelt buttons.
 * Ensures all icons use the same grey/white color scheme with
 * proper hover states.
 */

/**
 * Get CSS classes for toolbelt icons (copy, edit, delete, etc.)
 * These icons should be grey by default, brighter on hover.
 *
 * The 'toolbelt-icon' class is styled in app.css with filter properties
 * to achieve the grey/white color scheme.
 */
export function getToolbeltIconClasses(): string {
  return 'toolbelt-icon w-5 h-5';
}

/**
 * Get CSS classes for icons inside summary message toolbelt
 * Similar to regular toolbelt but sized for the summary context.
 *
 * The 'summary-toolbelt-icon' class is styled in app.css with the same
 * filter properties as regular toolbelt icons for consistency.
 */
export function getSummaryToolbeltIconClasses(): string {
  return 'summary-toolbelt-icon w-4 h-4';
}

/**
 * Get CSS classes for the summarize button icon
 * Should match other toolbelt icons in styling.
 */
export function getSummarizeButtonIconClasses(): string {
  return 'summarize-icon toolbelt-icon';
}
