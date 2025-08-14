import SvelteMarkdown from 'svelte-markdown';
import Code from '../renderers/Code.svelte';
import { registerTest } from './testHarness';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Minimal slice of the provided raw source focusing on the markdown-it fenced block
const RAW_MD_SNIPPET = `
1) Disable raw HTML in your Markdown parser  
   • Most Markdown engines (markdown-it, marked, Remark, etc.) have an option to simply ignore any raw HTML.  
     – markdown-it:  
       \`\`\`js
       import MarkdownIt from 'markdown-it';
       const md = new MarkdownIt({ html: false });
       const html = md.render(userMarkdown);
       \`\`\`
`;

registerTest({
  id: 'code-renderer-loses-highlighting-on-prop-update',
  name: 'Code renderer loses Prism highlighting when text prop changes (streaming simulation)',
  tags: ['ui', 'markdown', 'renderer', 'regression'],
  timeoutMs: 5000,
  fn: async (assert) => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const initial = "```js\nconst a = 1;\n```";
    const updated = "```js\nconst a = 1;\nconst b = 2;\n```";

    const comp = new Code({
      target: host,
      props: { text: initial, lang: 'js' }
    });

    // Allow onMount + Prism.highlightElement to run
    await sleep(0);

    const codeEl1 = host.querySelector('code');
    assert.that(!!codeEl1, 'Initial code element exists');
    const hadTokens = codeEl1!.innerHTML.includes('token');
    assert.that(hadTokens, 'Initial Prism tokenization applied');

    // Simulate streaming by updating the text
    comp.$set({ text: updated });

    // Let DOM update; Code.svelte only highlights on mount, not on update
    await sleep(0);

    const codeEl2 = host.querySelector('code');
    assert.that(!!codeEl2, 'Code element still exists after update');
    const stillHasTokens = codeEl2!.innerHTML.includes('token');
    // This asserts the bug: after update, highlighting is lost (unstyled text)
    assert.that(!stillHasTokens, 'Highlighting is lost after prop update (BUG)');

    comp.$destroy();
    document.body.removeChild(host);
  }
});

registerTest({
  id: 'svelte-markdown-toggles-code-renderer-under-streaming',
  name: 'svelte-markdown + custom code renderer toggles between styled/unstyled during streaming',
  tags: ['ui', 'markdown', 'renderer', 'integration', 'regression'],
  timeoutMs: 7000,
  fn: async (assert) => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    // Simulate streaming: first render an early chunk (up to just before the closing fence),
    // then append the rest. We expect our custom Code renderer to be used, but its onMount-only
    // highlighting causes a toggle to unstyled after update.
    const earlyChunk = RAW_MD_SNIPPET.replace(
      "```",
      "```" // keep same content; we rely on update behavior for toggle
    );

    const mdComp = new SvelteMarkdown({
      target: host,
      props: {
        renderers: {
          code: Code
        },
        source: earlyChunk
      }
    });

    await sleep(0);

    // Find the first code block rendered
    let codeEl = host.querySelector('pre code');
    assert.that(!!codeEl, 'Code block exists after initial chunk');
    const initiallyHighlighted = codeEl!.innerHTML.includes('token');
    assert.that(initiallyHighlighted, 'Initial render is syntax highlighted');

    // Append more text like a streaming update would do
    const appended = earlyChunk + '\n\nAdditional lines after code block to simulate stream.\n';
    mdComp.$set({ source: appended });

    await sleep(0);

    codeEl = host.querySelector('pre code');
    assert.that(!!codeEl, 'Code block still exists after update');
    const afterUpdateHighlighted = codeEl!.innerHTML.includes('token');
    // This asserts the observed bug: after updates, the rendered code toggles to unstyled/plain
    assert.that(!afterUpdateHighlighted, 'After update, code block is unstyled/plain (BUG)');

    mdComp.$destroy();
    document.body.removeChild(host);
  }
});
