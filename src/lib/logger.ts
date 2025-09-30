const isDev = import.meta.env.DEV;
const isTest = import.meta.env.VITE_E2E_TEST === 'true';

const shouldLog = isDev || isTest;

export const log = {
  debug: (...args: any[]) => {
    if (shouldLog) console.log(...args);
  },
  info: (...args: any[]) => {
    if (shouldLog) console.info(...args);
  },
  warn: (...args: any[]) => {
    console.warn(...args);
  },
  error: (...args: any[]) => {
    console.error(...args);
  }
};
