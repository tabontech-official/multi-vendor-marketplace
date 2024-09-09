import Joi from 'joi';

export const registerSchema = Joi.object({
  firstName: Joi.string().min(2).max(30).required(),
  lastName: Joi.string().min(2).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  passwordConfirmation: Joi.string().valid(Joi.ref('password')).required(),
  tags: Joi.string().optional(),
  shopifyId: Joi.string().optional(),
  phoneNumber: Joi.number().optional(),
  address: Joi.string().optional(),
  zip: Joi.number().optional(),
  country: Joi.string().optional(),
  city: Joi.string().optional(),
  profileImage: Joi.string().optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});
