declare module 'svelte-markdown' {
  // Minimal component typing to satisfy ts-node in tests
  type SvelteComponent = any;
  const SvelteMarkdown: typeof SvelteComponent;
  export default SvelteMarkdown;
}
