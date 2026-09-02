import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { studentRouter } from './student.routes.js';
import { assessmentRouter } from './assessment.routes.js';
import { jobRouter } from './job.routes.js';
import { courseRouter } from './course.routes.js';
import { applicationRouter } from './application.routes.js';
import { facultyRouter } from './faculty.routes.js';
import { learningRouter } from './learning.routes.js';
import { analyticsRouter } from './analytics.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/students', studentRouter);
apiRouter.use('/assessments', assessmentRouter);
apiRouter.use('/jobs', jobRouter);
apiRouter.use('/courses', courseRouter);
apiRouter.use('/applications', applicationRouter);
apiRouter.use('/faculty', facultyRouter);
apiRouter.use('/learning', learningRouter);
apiRouter.use('/analytics', analyticsRouter);
