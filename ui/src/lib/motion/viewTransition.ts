export function startViewTransition(callback: () => void | Promise<void>): void {
  if (typeof document !== "undefined" && "startViewTransition" in document) {
    (document as any).startViewTransition(callback);
  } else {
    // Fallback if not supported
    callback();
  }
}
