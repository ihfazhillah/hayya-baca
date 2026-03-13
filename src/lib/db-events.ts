type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

export function onDataChange(table: string, fn: Listener): () => void {
  if (!listeners.has(table)) listeners.set(table, new Set());
  listeners.get(table)!.add(fn);
  return () => {
    listeners.get(table)?.delete(fn);
  };
}

export function emitDataChange(table: string): void {
  listeners.get(table)?.forEach((fn) => fn());
}
