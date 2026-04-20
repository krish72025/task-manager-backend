import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    type: {
      type: String,
      enum: ['one-time', 'daily'],
      required: true,
    },
    completed: {
      type: Boolean,
      default: false,
      index: true,
    },
    completionDates: {
      type: [Date],
      default: [],
    },
    streak: {
      type: Number,
      default: 0,
    },
    lastCompletedDate: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

taskSchema.index({ user: 1, type: 1, completed: 1 });
taskSchema.index({ user: 1, order: 1, createdAt: -1 });

const Task = mongoose.model('Task', taskSchema);

export default Task;
