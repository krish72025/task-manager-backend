import mongoose from 'mongoose';

import Task from '../models/Task.js';
import { toUtcDayString, startOfUtcDay } from '../utils/date.js';

const TASK_TYPES = ['one-time', 'daily'];

const toClientTask = (task, todayKey = toUtcDayString()) => {
  const taskObject = task.toObject ? task.toObject() : task;

  const completedToday =
    taskObject.type === 'daily'
      ? taskObject.completionDates.some((date) => toUtcDayString(date) === todayKey)
      : taskObject.completed;

  return {
    ...taskObject,
    completedToday,
  };
};

const getTasks = async (req, res, next) => {
  try {
    const { filter = 'all' } = req.query;
    const todayKey = toUtcDayString();

    const tasks = await Task.find({ user: req.userId }).sort({ order: 1, createdAt: -1 });
    const normalizedTasks = tasks.map((task) => toClientTask(task, todayKey));

    let filteredTasks = normalizedTasks;

    if (filter === 'completed') {
      filteredTasks = normalizedTasks.filter((task) => task.completedToday);
    } else if (filter === 'pending') {
      filteredTasks = normalizedTasks.filter((task) => !task.completedToday);
    } else if (filter === 'daily') {
      filteredTasks = normalizedTasks.filter((task) => task.type === 'daily');
    } else {
      filteredTasks = normalizedTasks.filter(
        (task) => task.type === 'daily' || (task.type === 'one-time' && !task.completed)
      );
    }

    return res.status(200).json({ tasks: filteredTasks });
  } catch (error) {
    return next(error);
  }
};

const createTask = async (req, res, next) => {
  try {
    const { title, type } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ message: 'Task title is required.' });
    }

    if (!TASK_TYPES.includes(type)) {
      return res.status(400).json({ message: 'Task type must be one-time or daily.' });
    }

    const lastTask = await Task.findOne({ user: req.userId }).sort({ order: -1 }).select('order');
    const nextOrder = lastTask ? lastTask.order + 1 : 0;

    const task = await Task.create({
      user: req.userId,
      title: title.trim(),
      type,
      order: nextOrder,
    });

    return res.status(201).json({
      message: 'Task created successfully.',
      task: toClientTask(task),
    });
  } catch (error) {
    return next(error);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, type } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid task id.' });
    }

    const task = await Task.findOne({ _id: id, user: req.userId });

    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    if (title && title.trim()) {
      task.title = title.trim();
    }

    if (type && type !== task.type) {
      if (!TASK_TYPES.includes(type)) {
        return res.status(400).json({ message: 'Task type must be one-time or daily.' });
      }

      task.type = type;
      task.completed = false;
      task.completedAt = null;
      task.completionDates = [];
      task.streak = 0;
      task.lastCompletedDate = null;
    }

    await task.save();

    return res.status(200).json({
      message: 'Task updated successfully.',
      task: toClientTask(task),
    });
  } catch (error) {
    return next(error);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid task id.' });
    }

    const deletedTask = await Task.findOneAndDelete({ _id: id, user: req.userId });

    if (!deletedTask) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    return res.status(200).json({ message: 'Task deleted successfully.' });
  } catch (error) {
    return next(error);
  }
};

const completeOneTimeTask = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid task id.' });
    }

    const task = await Task.findOne({ _id: id, user: req.userId });

    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    if (task.type !== 'one-time') {
      return res.status(400).json({ message: 'Use daily-complete endpoint for daily tasks.' });
    }

    if (!task.completed) {
      task.completed = true;
      task.completedAt = new Date();
      await task.save();
    }

    return res.status(200).json({
      message: 'Task marked as completed.',
      task: toClientTask(task),
    });
  } catch (error) {
    return next(error);
  }
};

const completeDailyTask = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid task id.' });
    }

    const task = await Task.findOne({ _id: id, user: req.userId });

    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    if (task.type !== 'daily') {
      return res.status(400).json({ message: 'Use complete endpoint for one-time tasks.' });
    }

    const today = startOfUtcDay();
    const todayKey = toUtcDayString(today);

    const alreadyCompleted = task.completionDates.some(
      (completionDate) => toUtcDayString(completionDate) === todayKey
    );

    if (alreadyCompleted) {
      return res.status(400).json({ message: 'Daily task already completed for today.' });
    }

    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);
    const yesterdayKey = toUtcDayString(yesterday);
    const lastCompletionKey = task.lastCompletedDate ? toUtcDayString(task.lastCompletedDate) : null;

    task.streak = lastCompletionKey === yesterdayKey ? task.streak + 1 : 1;
    task.lastCompletedDate = today;
    task.completionDates.push(today);

    await task.save();

    return res.status(200).json({
      message: 'Daily task completed for today.',
      task: toClientTask(task, todayKey),
    });
  } catch (error) {
    return next(error);
  }
};

const getCompletedHistory = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);

    const history = await Task.find({
      user: req.userId,
      type: 'one-time',
      completed: true,
    })
      .sort({ completedAt: -1 })
      .limit(limit);

    return res.status(200).json({
      history: history.map((task) => toClientTask(task)),
    });
  } catch (error) {
    return next(error);
  }
};

const reorderTasks = async (req, res, next) => {
  try {
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ message: 'taskIds must be a non-empty array.' });
    }

    const hasInvalidId = taskIds.some((taskId) => !mongoose.Types.ObjectId.isValid(taskId));

    if (hasInvalidId) {
      return res.status(400).json({ message: 'taskIds contains invalid ids.' });
    }

    const tasks = await Task.find({ _id: { $in: taskIds }, user: req.userId }).select('_id');

    if (tasks.length !== taskIds.length) {
      return res.status(400).json({ message: 'One or more tasks are not accessible.' });
    }

    const bulkOperations = taskIds.map((taskId, index) => ({
      updateOne: {
        filter: { _id: taskId, user: req.userId },
        update: { $set: { order: index } },
      },
    }));

    await Task.bulkWrite(bulkOperations);

    return res.status(200).json({ message: 'Task order updated.' });
  } catch (error) {
    return next(error);
  }
};

export {
  completeDailyTask,
  completeOneTimeTask,
  createTask,
  deleteTask,
  getCompletedHistory,
  getTasks,
  reorderTasks,
  updateTask,
};
