const { validateEmail } = require('../services/emailValidator');

const validateEmailController = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await validateEmail(email);
    res.json({
      valid: result.valid,
      details: result.details
    });
  } catch (error) {
    res.status(500).json({ error: 'Validation failed', message: error.message });
  }
};

module.exports = { validateEmailController };
