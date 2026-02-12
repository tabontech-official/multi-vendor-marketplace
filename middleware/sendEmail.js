import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER, 
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Finance Team" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  };

  await transporter.sendMail(mailOptions);
};

export const financeReminderTemplate = (firstName) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Hello ${firstName},</h2>
      
      <p>
        We hope you're doing well.
      </p>

      <p>
        Please update your <strong>Bank Account Details</strong> in your 
        <strong>Finance Settings</strong> to receive your payouts without any delay.
      </p>

      <p>
        Go to your dashboard → Finance Settings → Add Bank Account Details.
      </p>

      <br/>

      <p>
        If you have already updated your details, please ignore this email.
      </p>

      <br/>
      <p>Best Regards,</p>
      <p><strong>Finance Team</strong></p>
    </div>
  `;
};
