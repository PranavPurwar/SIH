/**
 * Vue 3 ESM bridge
 * Exports globals from window.Vue for clean ES module imports across all components.
 */
const v = window.Vue || {};

export const createApp = v.createApp;
export const ref = v.ref;
export const reactive = v.reactive;
export const computed = v.computed;
export const watch = v.watch;
export const onMounted = v.onMounted;
export const onUnmounted = v.onUnmounted;
export const onBeforeUnmount = v.onBeforeUnmount;
export const nextTick = v.nextTick;

