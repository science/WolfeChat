// Mock for Svelte runtime in Node.js test environment
export function writable(initial) {
  let value = initial;
  const subscribers = new Set();
  
  const subscribe = (fn) => {
    subscribers.add(fn);
    fn(value);
    return () => subscribers.delete(fn);
  };
  
  const set = (newValue) => {
    value = newValue;
    subscribers.forEach(fn => fn(value));
  };
  
  const update = (fn) => {
    set(fn(value));
  };
  
  return { subscribe, set, update };
}

export function derived(stores, fn) {
  const storeArray = Array.isArray(stores) ? stores : [stores];
  let values = [];
  let cleanup;
  
  const derivedStore = writable(undefined);
  
  storeArray.forEach((store, i) => {
    store.subscribe(val => {
      values[i] = val;
      if (cleanup) cleanup();
      const result = fn(values);
      if (result && typeof result.then === 'function') {
        result.then(val => derivedStore.set(val));
      } else {
        derivedStore.set(result);
      }
    });
  });
  
  return derivedStore;
}

export function get(store) {
  let value;
  const unsubscribe = store.subscribe(val => value = val);
  unsubscribe();
  return value;
}

export function readable(initial, start) {
  const store = writable(initial);
  if (start) {
    const stop = start((val) => store.set(val));
    // In tests, we don't worry about cleanup
  }
  return {
    subscribe: store.subscribe
  };
}

// Mock SvelteComponent base class
export class SvelteComponent {
  constructor(options = {}) {
    this.$$props = options.props || {};
    this.$$slots = options.slots || {};
    this.target = options.target;
  }
  
  $set(props) {
    this.$$props = { ...this.$$props, ...props };
  }
  
  $destroy() {
    this.target = null;
  }
}