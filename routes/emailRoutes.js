const express = require('express');
const router = express.Router();
const { validateEmailController } = require('../controllers/emailController');

router.post('/validate', validateEmailController);

module.exports = router;
