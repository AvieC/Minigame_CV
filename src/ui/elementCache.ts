/**
 * Shared DOM element cache.
 * Register elements once on spawn; read from cache every frame — never query the DOM in the render loop.
 */
const cache = new Map<string, HTMLElement>();

export function registerEl(id: string, el: HTMLElement): void {
  cache.set(id, el);
}

export function getEl(id: string): HTMLElement | undefined {
  return cache.get(id);
}
