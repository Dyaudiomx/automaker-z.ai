import { createRouter, createMemoryHistory, createBrowserHistory } from '@tanstack/react-router';
import { routeTree } from '../routeTree.gen';

// Use browser history in web mode (for e2e tests and dev), memory history in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

const history = isElectron
  ? createMemoryHistory({ initialEntries: [window.location.pathname || '/'] })
  : createBrowserHistory();

export const router = createRouter({
  routeTree,
  defaultPendingMinMs: 0,
  history,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
