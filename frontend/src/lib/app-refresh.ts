type RefreshListener = () => void;

const listeners = new Set<RefreshListener>();

export function emitAppRefresh() {
  listeners.forEach((fn) => fn());
}

export function subscribeAppRefresh(fn: RefreshListener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
