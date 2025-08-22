<script>
  import Prism from 'prismjs';

  // Import Prism languages used in app
  import 'prismjs/components/prism-javascript';
  import 'prismjs/components/prism-typescript';
  import 'prismjs/components/prism-jsx';
  import 'prismjs/components/prism-tsx';
  import 'prismjs/components/prism-python';
  import 'prismjs/components/prism-json';
  import 'prismjs/components/prism-css';
  import 'prismjs/components/prism-markup';
  import 'prismjs/components/prism-ruby';
  import 'prismjs/components/prism-bash';

  // Theme CSS
  import 'prismjs/themes/prism-okaidia.css';

  // Support multiple incoming prop names from svelte-markdown
  export let text = undefined;
  export let value = undefined;   // svelte-markdown often passes { value }
  export let code = undefined;    // some renderers pass { code }
  export let lang = undefined;
  export let language = undefined; // svelte-markdown may pass { language }
  export let className = undefined; // sometimes language is encoded in className (e.g., "language-js")

  let codeElement;

  function normalizeLang(l) {
    if (!l) return 'none';
    const name = String(l).replace(/^language-/, '').toLowerCase();
    const aliases = {
      js: 'javascript',
      jsx: 'jsx',
      ts: 'typescript',
      tsx: 'tsx',
      py: 'python',
      sh: 'bash',
      shell: 'bash',
      html: 'markup'
    };
    return aliases[name] || name;
  }

  // Derive language from explicit prop(s) or className, fallback to 'none'
  $: resolvedLanguage =
    normalizeLang(
      language ||
      lang ||
      (className && String(className).match(/language-([\w-]+)/)?.[1]) ||
      ''
    );

  // Derive content from most common prop names
  $: content = (text ?? value ?? code ?? '').toString();

  // Compute highlighted HTML reactively so Svelte doesn't overwrite tokens
  $: highlightedHtml = (() => {
    try {
      const grammar =
        Prism.languages[resolvedLanguage] ||
        (resolvedLanguage === 'none' ? null : null) ||
        Prism.languages.markup; // safe fallback

      if (grammar) {
        return Prism.highlight(content, grammar, resolvedLanguage);
      }
    } catch (e) {
      console.warn('Prism highlight error', e);
    }
    // Fallback: escape safely
    const span = document.createElement('span');
    span.textContent = content;
    return span.innerHTML;
  })();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error('Error copying text: ', error);
    }
  };
</script>

<div class="code-block-container" style="position:relative">
  <div class="copycode">
    {#if resolvedLanguage && resolvedLanguage !== 'none'}
      <span class="language-label">{resolvedLanguage}</span>
    {:else}
      <span></span>
    {/if}
    <button on:click={copyToClipboard}>Copy code</button>
  </div>

  <pre class="language-{resolvedLanguage}"><code bind:this={codeElement} class="language-{resolvedLanguage}">{@html highlightedHtml}</code></pre>
</div>

<style>
  /* --- Import Prism's Line Number Plugin CSS (Optional) ---
     If you want line numbers, uncomment the next line
     @import 'prismjs/plugins/line-numbers/prism-line-numbers.css'; */

  .code-block-container :global(pre[class*="language-"]) {
    border-radius: 0px 0px 10px 10px !important;
    margin: 0 20px 0 20px !important;
    opacity: 0;
    animation: fade-in 0.5s ease-in-out forwards;
    margin-bottom: 1rem !important;
    overflow-wrap: break-word;
    white-space: pre-wrap;
  }

  .copycode {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #2f2f2f;
    margin: 0 20px 0 20px;
    border-radius: 10px 10px 0px 0px;
    padding: 0.5rem 1rem 0.5rem 1rem;
    min-height: 2.25rem;
  }

  .language-label {
    font-size: small;
    color: rgb(187, 187, 187);
    font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
    text-transform: lowercase;
  }

  button {
    font-size: small;
    display: block;
    transition: all 0.1s ease-in-out;
    color: rgb(187, 187, 187);
    background: none;
    border: none;
    cursor: pointer;
  }
  button:hover {
    color: white;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  :global(pre[class*="language-"]) {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
    border-radius: 0 !important;
  }
  :global(code[class*="language-"]) {
    /* Customize font if needed */
  }
</style>
