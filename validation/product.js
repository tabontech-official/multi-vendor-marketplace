import Joi from 'joi';

export const newEquipmentSchema = Joi.object({
  location: Joi.string().min(3).max(100).required(),
  name: Joi.string().min(1).max(255).required(),
  brand: Joi.string().min(1).max(100).required(),
  sale_price: Joi.number().required(),
  equipment_type: Joi.string().required(), // Replace with actual types
  certification: Joi.string().required(), // Replace with actual certifications
  year_manufactured: Joi.number().integer().min(1900).max(new Date().getFullYear()).required(),
  warranty: Joi.number().integer().positive().required(),
  training:  Joi.string().max(500).required(),
//   shipping: Joi.string().required(),
  description: Joi.string().max(1000).required(),
});

// Example usage


