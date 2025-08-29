// Unit-only portion of code renderer tests
// Keeps the simple Code shim test in Node/JSDOM
import Code from './svelte-code-shim.js';
import { registerTest } from '../testHarness.js';

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

registerTest({
  id: 'code-renderer-loses-highlighting-on-prop-update',
  name: 'Code renderer loses Prism highlighting when text prop changes (streaming simulation)',
  tags: ['ui','markdown','renderer','regression'],
  timeoutMs: 5000,
  fn: async (assert) => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const initial = "```js\nconst a = 1;\n```";
    const updated = "```js\nconst a = 1;\nconst b = 2;\n```";

    const comp = new Code({ target: host, props: { text: initial, lang: 'js' } });

    await sleep(0);

    const codeEl1 = host.querySelector('code') as HTMLElement;
    assert.that(!!codeEl1, 'Initial code element exists');
    const hadTokens = codeEl1.innerHTML.includes('token');
    assert.that(hadTokens, 'Initial Prism tokenization applied');

    comp.$set({ text: updated });
    await sleep(0);

    const codeEl2 = host.querySelector('code');
    assert.that(!!codeEl2, 'Code element still exists after update');
    const stillHasTokens = codeEl2.innerHTML.includes('token');
    assert.that(stillHasTokens, 'Highlighting persists after prop update');

    comp.$destroy();
    document.body.removeChild(host);
  }
});
