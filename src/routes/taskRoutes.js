const express = require('express');
const {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
} = require('../controllers/taskController');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  createTaskValidators,
  updateTaskValidators,
  idParamValidator,
  listTasksValidators,
  checkValidation,
} = require('../middleware/validators');

const router = express.Router();

router.use(requireAuth); // every task route requires a logged-in user

router.post('/', createTaskValidators, checkValidation, createTask);
router.get('/', listTasksValidators, checkValidation, listTasks);
router.get('/:id', idParamValidator, checkValidation, getTask);
router.patch('/:id', updateTaskValidators, checkValidation, updateTask);
router.delete('/:id', idParamValidator, checkValidation, deleteTask);

module.exports = router;
