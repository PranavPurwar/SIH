/**
 * Vue 3 ESM bridge with TypeScript types
 * Exports globals from window.Vue for clean ES module imports across all components.
 */
import type * as VueTypes from 'vue';

const v = (typeof window !== 'undefined' ? window.Vue : undefined) || ({} as Partial<typeof VueTypes>);

export const createApp = v.createApp as typeof VueTypes.createApp;
export const ref = v.ref as typeof VueTypes.ref;
export const reactive = v.reactive as typeof VueTypes.reactive;
export const computed = v.computed as typeof VueTypes.computed;
export const watch = v.watch as typeof VueTypes.watch;
export const onMounted = v.onMounted as typeof VueTypes.onMounted;
export const onUnmounted = v.onUnmounted as typeof VueTypes.onUnmounted;
export const onBeforeUnmount = v.onBeforeUnmount as typeof VueTypes.onBeforeUnmount;
export const nextTick = v.nextTick as typeof VueTypes.nextTick;
export const defineComponent = v.defineComponent as typeof VueTypes.defineComponent;

export type { Ref, ComputedRef, App, Component, PropType } from 'vue';
