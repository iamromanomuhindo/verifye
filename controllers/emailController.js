const { validateEmail } = require('../services/emailValidator');

const validateEmailController = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Enable SMTP verification by default
    const result = await validateEmail(email, { checkSmtp: true });

    // Handle SMTP-specific responses
    if (result.details.smtp && result.details.smtp.message) {
      if (result.details.smtp.message.includes('Email does not exist')) {
        result.valid = false;
      }
    }

    res.json({
      valid: result.valid,
      details: result.details
    });
  } catch (error) {
    res.status(500).json({ error: 'Validation failed', message: error.message });
  }
};

module.exports = { validateEmailController };
