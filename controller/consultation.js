import { consultationModel } from '../Models/consultation.js';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'medsparecovery@gmail.com',
    pass: 'vfqm uxah oapw qnka',
  },
  secure: true,
  tls: {
    rejectUnauthorized: false,
  },
});

export const addConsultation = async (req, res) => {
  try {
    const { fullName, email, storeUrl, consultataionType, goals, userId } =
      req.body;

    const newConsultation = await consultationModel.create({
      fullName,
      email,
      storeUrl,
      consultataionType,
      goals,
      userId,
    });

    const mailOptions = {
      from: 'medsparecovery@gmail.com',
      to: email,
      subject: 'Consultation Booked Successfully',
      html: `
          <h2>Hi ${fullName},</h2>
          <p>Your consultation has been booked successfully.</p>
          <p><strong>Store URL:</strong> ${storeUrl}</p>
          <p><strong>Consultation Type:</strong> ${consultataionType}</p>
          <p><strong>Goals:</strong> ${goals}</p>
          <br/>
          <p>Thank you for choosing us!</p>
        `,
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      message: 'Consultation booked and email sent.',
      data: newConsultation,
    });
  } catch (error) {
    console.error('Error booking consultation:', error);
    res.status(500).json({ message: 'Something went wrong.' });
  }
};
