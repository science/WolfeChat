// @ts-ignore - svelte-markdown is a Svelte component module not typed for ts-node here
// Prefer a light mock in Node test runner
// NOTE: This test requires Node-specific mocks that are not available in the browser-nonlive suite.
// It will be skipped in the browser harness to avoid Vite import failures.
// import SvelteMarkdown from './__mocks__/svelte-markdown.js';
// import Code from './svelte-code-shim.js';
import { registerTest } from '../testHarness';

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

// Skip this test in browser harness; incompatible imports.
/* SKIP_BROWSER */ registerTest({
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
    // After update, highlighting should persist
    assert.that(stillHasTokens, 'Highlighting persists after prop update');

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

    // Simulate streaming with a simpler snippet to ensure a code block renders,
    // then update the source to change the code content.
    const earlyChunk = `Here is code:

\`\`\`js
const a = 1;
\`\`\`
`;

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
    const appended = `Here is code:

\`\`\`js
const a = 1;
const b = 2;
\`\`\`

And more text below the code block.`;
    mdComp.$set({ source: appended });

    await sleep(0);

    codeEl = host.querySelector('pre code');
    assert.that(!!codeEl, 'Code block still exists after update');
    const afterUpdateHighlighted = codeEl!.innerHTML.includes('token');
    // After updates, the rendered code should remain highlighted
    assert.that(afterUpdateHighlighted, 'After update, code block remains syntax highlighted');

    mdComp.$destroy();
    document.body.removeChild(host);
  }
});
