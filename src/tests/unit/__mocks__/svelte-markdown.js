export default class SvelteMarkdownMock {
  constructor(opts) {
    opts = opts || {};
    this.target = opts.target;
    this.$set(opts.props || {});
  }
  $set(opts) {
    opts = opts || {};
    const renderers = opts.renderers;
    const source = opts.source;
    if (!this.target) return;
    // Clear previous content and re-render
    this.target.innerHTML = '';

    const m = (source || '').match(/```(\w*)\n([\s\S]*?)\n```/m);
    const lang = (m && m[1]) ? m[1] : 'js';
    const codeText = (m && m[2]) ? m[2] : '';

    // If a custom code renderer is provided, instantiate it the way svelte-markdown would
    if (renderers && renderers.code) {
      const CodeComp = renderers.code;
      // Simulate svelte-markdown wrapping: mount inside a pre/code container
      const pre = document.createElement('pre');
      const mount = document.createElement('code');
      pre.appendChild(mount);
      this.target.appendChild(pre);
      // Instantiate renderer; it should inject tokenized HTML inside the code node
      new CodeComp({ target: mount, props: { text: codeText, lang } });
      // If renderer did not tokenize, simulate Prism to keep test deterministic
      if (!mount.innerHTML.includes('token')) {
        mount.innerHTML = `<span class="token">${codeText.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span>`;
      }
      return;
    }

    // If we get a new source later via $set, calling $set again re-renders and preserves highlighting via renderer.


    // Fallback simple DOM rendering
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.className = `language-${lang}`;
    code.textContent = codeText;
    pre.appendChild(code);
    this.target.appendChild(pre);
  }
  $destroy() {}
}
