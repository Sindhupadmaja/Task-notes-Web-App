const TaskService = require('../services/TaskService');

const taskService = new TaskService();

async function createTask(req, res, next) {
  try {
    const task = await taskService.create(req.userId, req.body);
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
}

async function listTasks(req, res, next) {
  try {
    const result = await taskService.list(req.userId, req.query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getTask(req, res, next) {
  try {
    const task = await taskService.getById(req.userId, req.params.id);
    res.status(200).json({ task });
  } catch (err) {
    next(err);
  }
}

async function updateTask(req, res, next) {
  try {
    const task = await taskService.update(req.userId, req.params.id, req.body);
    res.status(200).json({ task });
  } catch (err) {
    next(err);
  }
}

async function deleteTask(req, res, next) {
  try {
    await taskService.remove(req.userId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { createTask, listTasks, getTask, updateTask, deleteTask };
