const { validationResult } = require('express-validator');

module.exports = (validations = []) => {
  return [
    ...validations,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      next();
    }
  ];
}; 