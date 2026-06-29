export const validate = (validator) => (req, res, next) => {
  try {
    req.validated = validator(req);
    next();
  } catch (error) {
    next(error);
  }
};
