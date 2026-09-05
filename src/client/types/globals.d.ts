import type { Chart as ChartClass, ChartConfiguration } from 'chart.js';
import type * as VueTypes from 'vue';

declare global {
  const Chart: {
    new (ctx: CanvasRenderingContext2D, config: ChartConfiguration): ChartClass;
  };

  interface Window {
    Vue?: typeof VueTypes;
    Chart?: typeof Chart;
  }
}

export {};

