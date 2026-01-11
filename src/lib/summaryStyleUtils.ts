/**
 * Summary Style Utilities
 *
 * Provides styling logic for summary messages, including
 * visual differentiation between loading and completed states.
 */

/**
 * Get the background and border classes for a summary message
 * based on its loading state.
 *
 * @param isLoading - Whether the summary is currently being generated
 * @returns CSS class string for the summary container
 */
export function getSummaryBackgroundClasses(isLoading: boolean): string {
  // Base classes that are always applied
  const baseClasses = 'rounded-lg mx-10 my-4 p-4 border-l-4';

  if (isLoading) {
    // Loading state: muted grey background with subtle border
    // Provides visual indication that content is being generated
    return `${baseClasses} bg-gray-800/50 border-gray-500`;
  } else {
    // Completed state: rich purple gradient background
    // Signals that the summary is ready and complete
    return `${baseClasses} bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border-indigo-500`;
  }
}
