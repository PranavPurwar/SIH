import { ref } from '../vue.js';
import { api } from '../services/api.js';
import type { CourseItem } from '../types/index.js';

export function useCourses() {
  const coursesLoading = ref(false);
  const courses = ref<CourseItem[]>([]);
  const coursePage = ref(1);
  const totalCourses = ref(0);
  const totalCoursePages = ref(1);
  const courseQuery = ref('');
  const selectedCourseDifficulty = ref('all');
  const selectedCourseSource = ref('all');
  const selectedCourseProvider = ref('');

  async function loadCourses(
    page = 1,
    query = courseQuery.value,
    difficulty = selectedCourseDifficulty.value,
    source = selectedCourseSource.value,
    provider = selectedCourseProvider.value
  ) {
    coursesLoading.value = true;
    coursePage.value = page;
    if (query !== undefined) courseQuery.value = query;
    if (difficulty !== undefined) selectedCourseDifficulty.value = difficulty;
    if (source !== undefined) selectedCourseSource.value = source;
    if (provider !== undefined) selectedCourseProvider.value = provider;

    try {
      const activeProvider = (selectedCourseProvider.value === 'all_consortium' || selectedCourseProvider.value === 'all') 
        ? undefined 
        : (selectedCourseProvider.value || undefined);

      const res = await api.getCourses({
        page,
        limit: 12,
        query: courseQuery.value,
        difficulty: selectedCourseDifficulty.value,
        source: selectedCourseSource.value,
        provider: activeProvider
      });

      courses.value = res.data || [];
      totalCourses.value = res.meta?.total || 0;
      totalCoursePages.value = Math.ceil(totalCourses.value / (res.meta?.limit || 12)) || 1;
    } catch (err) {
      console.error('Failed to load courses:', err);
    } finally {
      coursesLoading.value = false;
    }
  }

  function handleCourseSearch(query: string) {
    loadCourses(1, query, selectedCourseDifficulty.value, selectedCourseSource.value, selectedCourseProvider.value);
  }

  function handleCourseDifficulty(diff: string) {
    loadCourses(1, courseQuery.value, diff, selectedCourseSource.value, selectedCourseProvider.value);
  }

  function handleCourseSource(src: string) {
    loadCourses(1, courseQuery.value, selectedCourseDifficulty.value, src, selectedCourseProvider.value);
  }

  function handleCourseProvider(provider: string) {
    selectedCourseProvider.value = provider;
    loadCourses(1, courseQuery.value, selectedCourseDifficulty.value, selectedCourseSource.value, provider);
  }

  function handleCoursePage(p: number) {
    loadCourses(p, courseQuery.value, selectedCourseDifficulty.value, selectedCourseSource.value, selectedCourseProvider.value);
  }

  function handleCourseReset() {
    courseQuery.value = '';
    selectedCourseDifficulty.value = 'all';
    selectedCourseSource.value = 'all';
    loadCourses(1, '', 'all', 'all', selectedCourseProvider.value);
  }

  async function handleCreateCourse(courseData: Partial<CourseItem>) {
    try {
      await api.createCourse(courseData);
      await loadCourses(1);
      alert('Course curriculum added successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert('Failed to add course: ' + msg);
    }
  }

  async function handleUpdateCourse({ id, courseData }: { id: string; courseData: Partial<CourseItem> }) {
    try {
      await api.updateCourse(id, courseData);
      await loadCourses(coursePage.value);
      alert('Courseware module updated successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert('Failed to update course: ' + msg);
    }
  }

  return {
    coursesLoading,
    courses,
    coursePage,
    totalCourses,
    totalCoursePages,
    courseQuery,
    selectedCourseDifficulty,
    selectedCourseSource,
    selectedCourseProvider,
    loadCourses,
    handleCourseSearch,
    handleCourseDifficulty,
    handleCourseSource,
    handleCourseProvider,
    handleCoursePage,
    handleCourseReset,
    handleCreateCourse,
    handleUpdateCourse
  };
}
