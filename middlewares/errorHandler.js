const winston = require('winston');

module.exports = (err, req, res, next) => {
  winston.error(err.message, err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
};
