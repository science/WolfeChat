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
    this.target.innerHTML = '';
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.className = 'language-js';
    const m = (source || '').match(/```\w*\n([\s\S]*?)\n```/m);
    code.textContent = m ? m[1] : '';
    pre.appendChild(code);
    this.target.appendChild(pre);
    if (renderers && renderers.code) {
      // no-op: tests directly query DOM
    }
  }
  $destroy() {}
}
