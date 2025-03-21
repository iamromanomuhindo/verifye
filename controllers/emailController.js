const { validateEmail } = require('../services/emailValidator');
const { logger } = require('../utils/logger');

const validateEmailController = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      valid: false,
      error: 'Email is required',
      details: {
        syntax: { valid: false, message: 'Email is required' },
        dns: null,
        domain: null,
        smtp: null
      }
    });
  }

  try {
    // Call the enhanced email validation with all checks enabled
    const result = await validateEmail(email, {
      checkSMTP: true,
      timeout: 10000,
      validateDNS: true,
      detectRoles: true
    });

    // Log the validation attempt
    logger.info('Email validation attempt', {
      email: email.toLowerCase(),
      valid: result.valid,
      score: result.score
    });

    res.json({
      valid: result.valid,
      score: result.score,
      details: result.details,
      suggestions: result.suggestions || []
    });

  } catch (error) {
    logger.error('Email validation error:', {
      email: email.toLowerCase(),
      error: error.message
    });

    res.status(500).json({
      valid: false,
      error: 'Validation failed',
      message: error.message,
      details: {
        syntax: { valid: false, message: 'Validation failed' },
        dns: null,
        domain: null,
        smtp: null
      }
    });
  }
};

module.exports = { validateEmailController };
