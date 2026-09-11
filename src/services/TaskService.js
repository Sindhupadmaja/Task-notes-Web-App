const Task = require('../models/Task');
const { NotFoundError, ForbiddenError } = require('../utils/ApiError');

const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'dueDate', 'priority', 'title']);

/**
 * TaskService owns all task business logic. Every read/write is scoped to
 * `ownerId` -- there is no method here that can accidentally return or
 * mutate another user's task, because the owner filter is baked into every
 * query rather than checked after the fact.
 */
class TaskService {
  constructor({ taskModel = Task } = {}) {
    this.Task = taskModel;
  }

  async create(ownerId, data) {
    return this.Task.create({ ...data, owner: ownerId });
  }

  async list(ownerId, { status, priority, search, sortBy = 'createdAt', order = 'desc', page = 1, limit = 20 } = {}) {
    const query = { owner: ownerId };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (search) query.$text = { $search: search };

    const sortField = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt';
    const sortDirection = order === 'asc' ? 1 : -1;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      this.Task.find(query).sort({ [sortField]: sortDirection }).skip(skip).limit(limitNum),
      this.Task.countDocuments(query),
    ]);

    return {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
      },
    };
  }

  async getById(ownerId, taskId) {
    const task = await this._findOwnedOrThrow(ownerId, taskId);
    return task;
  }

  async update(ownerId, taskId, updates) {
    const task = await this._findOwnedOrThrow(ownerId, taskId);
    Object.assign(task, updates);
    await task.save();
    return task;
  }

  async remove(ownerId, taskId) {
    const task = await this._findOwnedOrThrow(ownerId, taskId);
    await task.deleteOne();
    return task;
  }

  async _findOwnedOrThrow(ownerId, taskId) {
    const task = await this.Task.findById(taskId);
    if (!task) {
      throw new NotFoundError('Task not found');
    }
    if (task.owner.toString() !== ownerId.toString()) {
      // 403, not 404 -- distinguishing "doesn't exist" from "exists but
      // isn't yours" would leak information in a system with sensitive
      // ownership, but for a task manager, an explicit Forbidden is more
      // useful for debugging than a misleading 404.
      throw new ForbiddenError('You do not have access to this task');
    }
    return task;
  }
}

module.exports = TaskService;
