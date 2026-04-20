import mongoose from 'mongoose';

import Task from '../models/Task.js';
import { endOfUtcDay, getRecentUtcDays, startOfUtcDay, toUtcDayString } from '../utils/date.js';

const getAnalyticsOverview = async (req, res, next) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.userId);
    const today = new Date();
    const todayStart = startOfUtcDay(today);
    const todayEnd = endOfUtcDay(today);

    const fourteenDays = getRecentUtcDays(14);
    const rangeStart = startOfUtcDay(new Date(`${fourteenDays[0]}T00:00:00.000Z`));

    const [
      totalTasks,
      oneTimePending,
      oneTimeCompleted,
      totalDaily,
      dailyCompletedToday,
      oneTimeCompletedToday,
      streakAggregation,
      dailyCompletionTrend,
      oneTimeCompletionTrend,
    ] = await Promise.all([
      Task.countDocuments({ user: req.userId }),
      Task.countDocuments({ user: req.userId, type: 'one-time', completed: false }),
      Task.countDocuments({ user: req.userId, type: 'one-time', completed: true }),
      Task.countDocuments({ user: req.userId, type: 'daily' }),
      Task.countDocuments({
        user: req.userId,
        type: 'daily',
        completionDates: { $elemMatch: { $gte: todayStart, $lt: todayEnd } },
      }),
      Task.countDocuments({
        user: req.userId,
        type: 'one-time',
        completed: true,
        completedAt: { $gte: todayStart, $lt: todayEnd },
      }),
      Task.aggregate([
        { $match: { user: userObjectId, type: 'daily' } },
        {
          $group: {
            _id: null,
            longestStreak: { $max: '$streak' },
            currentStreak: { $max: '$streak' },
          },
        },
      ]),
      Task.aggregate([
        { $match: { user: userObjectId, type: 'daily' } },
        { $unwind: '$completionDates' },
        { $match: { completionDates: { $gte: rangeStart, $lt: todayEnd } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$completionDates' } },
            count: { $sum: 1 },
          },
        },
      ]),
      Task.aggregate([
        {
          $match: {
            user: userObjectId,
            type: 'one-time',
            completed: true,
            completedAt: { $gte: rangeStart, $lt: todayEnd },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const dailyCompletionMap = new Map(dailyCompletionTrend.map((item) => [item._id, item.count]));
    const oneTimeCompletionMap = new Map(oneTimeCompletionTrend.map((item) => [item._id, item.count]));

    const completionOverTime = fourteenDays.map((day) => {
      const dailyCount = dailyCompletionMap.get(day) || 0;
      const oneTimeCount = oneTimeCompletionMap.get(day) || 0;
      const totalCompleted = dailyCount + oneTimeCount;

      return {
        date: day,
        completedTasks: totalCompleted,
      };
    });

    const productivityTrend = fourteenDays.map((day) => {
      const completedDailyTasks = dailyCompletionMap.get(day) || 0;
      const completionRate = totalDaily > 0 ? Number(((completedDailyTasks / totalDaily) * 100).toFixed(1)) : 0;

      return {
        date: day,
        completionRate,
      };
    });

    const completedToday = oneTimeCompletedToday + dailyCompletedToday;
    const dueToday = oneTimePending + totalDaily;
    const dailyCompletionRate = dueToday > 0 ? Number(((completedToday / dueToday) * 100).toFixed(1)) : 0;

    const streakStats = streakAggregation[0] || { longestStreak: 0, currentStreak: 0 };

    return res.status(200).json({
      summary: {
        totalTasks,
        completedTasks: oneTimeCompleted,
        pendingTasks: oneTimePending,
        dailyTasks: totalDaily,
        completedToday,
        dailyCompletionRate,
      },
      streakInsights: {
        longestStreak: streakStats.longestStreak || 0,
        currentStreak: streakStats.currentStreak || 0,
      },
      charts: {
        completionOverTime,
        productivityTrend,
      },
      generatedAt: toUtcDayString(today),
    });
  } catch (error) {
    return next(error);
  }
};

export { getAnalyticsOverview };
