import { ref, onMounted, onUnmounted, watch, nextTick, defineComponent } from '../vue.js';
import type { PropType } from '../vue.js';
import type { RadarMetric } from '../types/index.js';

export interface RadarChartProps {
  metrics: RadarMetric[];
}

export default defineComponent({
  name: 'RadarChart',
  props: {
    metrics: {
      type: Array as PropType<RadarMetric[]>,
      default: () => []
    }
  },
  setup(props) {
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    let chartInstance: InstanceType<typeof Chart> | null = null;

    function render() {
      if (!canvasRef.value) return;
      if (chartInstance) {
        chartInstance.destroy();
      }

      const ctx = canvasRef.value.getContext('2d');
      if (!ctx) return;
      const metrics = props.metrics || [];

      const labels = metrics.length > 0
        ? metrics.map((m: RadarMetric) => m.domain)
        : ['Systems & Infrastructure', 'AI & Machine Learning', 'Client & Platform Architecture', 'Data & Vector Storage', 'Algorithms & Core CS'];

      const data = metrics.length > 0
        ? metrics.map((m: RadarMetric) => m.score)
        : [8, 8, 8, 8, 8];

      chartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
          labels,
          datasets: [{
            label: 'Competency',
            data,
            backgroundColor: 'rgba(88, 28, 135, 0.12)',
            borderColor: '#581C87',
            pointBackgroundColor: '#581C87',
            pointBorderColor: '#FFFFFF',
            pointRadius: 3.5,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              min: 0,
              max: 100,
              beginAtZero: true,
              angleLines: { color: '#E9E1F0' },
              grid: { color: '#F3EEF9' },
              pointLabels: { color: '#6B5B7B', font: { size: 11, family: 'Inter', weight: 500 } },
              ticks: { stepSize: 20, display: false }
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

    watch(() => props.metrics, () => {
      nextTick(render);
    }, { deep: true });

    onMounted(() => {
      nextTick(render);
    });

    onUnmounted(() => {
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
    });

    return {
      canvasRef
    };
  },
  template: `
    <div class="h-64 w-full flex items-center justify-center">
      <canvas ref="canvasRef"></canvas>
    </div>
  `
});

