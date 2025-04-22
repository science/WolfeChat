// utils/generalUtils.ts

/**
 * Ensures that markdown code blocks (```) are surrounded by newlines.
 * Adds a newline before opening ticks (odd count) if missing.
 * Adds a newline after closing ticks (even count) if missing.
 * @param {string} markdown The raw markdown string.
 * @returns {string} Markdown string with enforced newlines around code blocks.
 */
function ensureNewlinesAroundCodeBlocks(markdown) {
    if (typeof markdown !== 'string') {
        console.warn("ensureNewlinesAroundCodeBlocks received non-string input:", markdown);
        return markdown; // Return original if not a string
    }

    let tickCount = 0;
    try {
        // Using a function with replace allows state (tickCount) across matches
        return markdown.replace(/```/g, (match, offset, fullString) => {
            tickCount++;
            const isOpening = tickCount % 2 !== 0;
            let prefix = '';
            let suffix = '';

            // --- Opening ``` (Odd occurrences) ---
            if (isOpening) {
                // Add a newline BEFORE if it's missing
                // Check if it's the very start OR the preceding char isn't a newline
                if (offset === 0 || (offset > 0 && fullString[offset - 1] !== '\n')) {
                    prefix = '\n';
                }
            }
            // --- Closing ``` (Even occurrences) ---
            else {
                // Add a newline AFTER if it's missing
                const indexAfter = offset + match.length;
                // Check if it's the very end OR the succeeding char isn't a newline
                if (indexAfter === fullString.length || (indexAfter < fullString.length && fullString[indexAfter] !== '\n')) {
                    suffix = '\n';
                }
            }
            // Return the potentially modified segment: PRE + MATCH + SUFFIX
            return prefix + match + suffix;
        });
    } catch (error) {
        console.error("Error processing markdown for code blocks:", error);
        return markdown; // Return original on error
    }
}



// Utility function for formatting messages for Markdown rendering
export function formatMessageForMarkdown(content: string): string {
    // Ensure content is a string before processing
    let textContent = typeof content === 'string' ? content : String(content);

    // --- Apply the newline fix ---
    content = ensureNewlinesAroundCodeBlocks(textContent);

    // Replace newline characters with two spaces followed by a newline character
    return content.replace(/\n/g, '  \n');
  }
  
  // Utility function to copy text to clipboard
  export async function copyTextToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      console.log('Text successfully copied to clipboard');
      return true;
    } catch (err) {
      console.error('Failed to copy text to clipboard: ', err);
      return false;
    }
  }
  

  
  // Utility function to check if a message is an audio message
  export function isAudioMessage(message: any): message is { audioUrl: string; isAudio: boolean } {
    return message.isAudio === true;
  }
 export function countTicks(str: string) {
    let out: number = str.split("").filter((char) => char === "`").length;
    return out;
  }

  