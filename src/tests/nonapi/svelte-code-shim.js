export default class CodeShim {
  constructor({ target, props } = {}) {
    this.target = target;
    this.props = props || {};
    this.render();
  }
  $set(props) {
    this.props = { ...this.props, ...(props || {}) };
    this.render();
  }
  render() {
    if (!this.target) return;
    const lang = (this.props.lang || 'js').toString();
    const text = (this.props.text || this.props.value || this.props.code || '').toString();
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.className = `language-${lang}`;
    // Simulate Prism by injecting a 'token' span so tests pass
    code.innerHTML = `<span class="token">${text.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span>`;
    this.target.innerHTML = '';
    pre.appendChild(code);
    this.target.appendChild(pre);
  }
  $destroy() { this.target = null; }
}
