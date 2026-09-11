const express = require('express');
const { register, login } = require('../controllers/authController');
const { registerValidators, loginValidators, checkValidation } = require('../middleware/validators');

const router = express.Router();

router.post('/register', registerValidators, checkValidation, register);
router.post('/login', loginValidators, checkValidation, login);

module.exports = router;
