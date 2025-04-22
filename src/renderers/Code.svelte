<script>
  import { onMount } from 'svelte'; // Import onMount lifecycle function
  import Prism from 'prismjs';     // Import Prism core

  // --- Import necessary language components ---
  // Only import the ones you expect to use to keep bundle size small
  import 'prismjs/components/prism-javascript';
  import 'prismjs/components/prism-css';
  import 'prismjs/components/prism-markup'; // For HTML, XML, SVG
  import 'prismjs/components/prism-ruby';
  import 'prismjs/components/prism-bash';
  // Add more languages as needed from 'prismjs/components/'

  // --- Import a Prism theme CSS ---
  // Choose ONE theme. Many options available in 'prismjs/themes/'
  // Example: Okaidia theme
  import 'prismjs/themes/prism-okaidia.css'; 
  // Other popular options: prism.css (default), prism-tomorrow.css, prism-coy.css etc.

  export let text; 
  export let lang = undefined; 

  // Create a ref for the <code> element
  let codeElement;

  // Run highlighting after the component is added to the DOM
  onMount(() => {
    if (codeElement) {
      Prism.highlightElement(codeElement);
    }
  });

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text); 
    } catch (error) {
      console.error("Error copying text: ", error);
    }
  };
  
</script>

<div class="code-block-container" style="position:relative"> <!-- Add class for better CSS targeting -->
  <div class="copycode">
    {#if lang}
      <span class="language-label">{lang}</span>
    {:else}
      <span></span> 
    {/if}
    <button on:click={copyToClipboard}>Copy code</button>
  </div>
  
  <!-- Wrap highlightedCode within <pre> and <code> -->
  <!-- Ensure the language class is added, and bind the element reference -->
  <pre class="language-{lang || 'none'}"><code bind:this={codeElement} class="language-{lang || 'none'}">{text}</code></pre> 
</div>

<style>
  /* --- Import Prism's Line Number Plugin CSS (Optional) --- */
  /* If you want line numbers, uncomment the next line */
  /* @import 'prismjs/plugins/line-numbers/prism-line-numbers.css'; */

  /* --- Your Existing Styles (Adjusted) --- */
  .code-block-container :global(pre[class*="language-"]) { /* Target Prism's pre tag */
    /* Remove your custom background/padding if handled by Prism theme */
    /* background-color: #0d0d0d; */ 
    border-radius: 0px 0px 10px 10px !important; /* Keep bottom radius, !important might be needed */
    /* padding: 20px; */ /* Let Prism theme handle padding */
    margin: 0 20px 0 20px !important; /* Keep horizontal margin */
    opacity: 0;
    animation: fade-in 0.5s ease-in-out forwards;
    margin-bottom: 1rem !important; /* Keep bottom margin */
    overflow-wrap: break-word;
    white-space: pre-wrap; /* You might want pre if using line numbers */
    /* color: #e0e0e0; */ /* Let Prism theme handle color */
    /* font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace; */ /* Let Prism theme handle font */
    /* font-size: 0.9em; */ /* Let Prism theme handle font size */
  }

   /* Style the title bar */
  .copycode {
    display: flex;
    justify-content: space-between; 
    align-items: center; 
    background-color: #2f2f2f; /* Or match your Prism theme's background */
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

  /* Style the button */
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

  /* Fade-in animation */
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* --- Prism Theme Overrides (Optional) --- */
  /* You might need to override Prism theme styles slightly */
  /* Example: Remove Prism's default margin/radius if it conflicts */
  :global(pre[class*="language-"]) {
     margin-top: 0 !important;
     margin-bottom: 0 !important; /* We handle bottom margin on the container */
     border-radius: 0 !important; 
  }
  :global(code[class*="language-"]) {
     /* Adjust font size if needed */
     /* font-size: 0.85em !important; */
  }

</style>