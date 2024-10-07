import Joi from 'joi';

export const registerSchema = Joi.object({
  firstName: Joi.string().min(2).max(30).required(),
  lastName: Joi.string().min(2).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string()
  .min(6)
  // .pattern(new RegExp('^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])'))
  .required(),
  tags: Joi.string().optional(),
//   shopifyId: Joi.string().optional(),
   phoneNumber: Joi.number().required(),
//   address: Joi.string().optional(),
  zip: Joi.number().required(),
  country: Joi.string().required(), 
  city: Joi.string().required(),
  state: Joi.string().required(),

//   profileImage: Joi.string().optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});
