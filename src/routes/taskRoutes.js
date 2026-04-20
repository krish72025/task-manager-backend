import { Router } from 'express';

import {
  completeDailyTask,
  completeOneTimeTask,
  createTask,
  deleteTask,
  getCompletedHistory,
  getTasks,
  reorderTasks,
  updateTask,
} from '../controllers/taskController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getTasks);
router.post('/', createTask);
router.get('/completed-history', getCompletedHistory);
router.patch('/reorder', reorderTasks);
router.patch('/:id/complete', completeOneTimeTask);
router.patch('/:id/daily-complete', completeDailyTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

export default router;
