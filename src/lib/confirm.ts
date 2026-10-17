/** Thin wrapper so tests can stub confirmations; native dialogs work in iOS standalone mode. */
export function confirmAction(message: string): boolean {
  return typeof window.confirm === 'function' ? window.confirm(message) : true;
}
