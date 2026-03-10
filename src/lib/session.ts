// Simple module-level session state (child picks profile each time they open app)

type SelectedChild = { id: number; name: string; age?: number } | null;

let _selectedChild: SelectedChild = null;
const _listeners = new Set<() => void>();

export function getSelectedChild() {
  return _selectedChild;
}

export function selectChild(child: SelectedChild) {
  _selectedChild = child;
  _listeners.forEach((fn) => fn());
}

export function clearChild() {
  _selectedChild = null;
  _listeners.forEach((fn) => fn());
}

export function subscribeSession(fn: () => void) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
