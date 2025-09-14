const nodemailer = require('nodemailer');
const twilio = require('twilio');

class NotificationService {
  constructor() {
    // Email transporter setup
    this.emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
      }
    });

    // Twilio setup for SMS (only if valid credentials are provided)
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (twilioSid && twilioToken && twilioSid.startsWith('AC')) {
      this.twilioClient = twilio(twilioSid, twilioToken);
    } else {
      this.twilioClient = null;
      console.log('⚠️  Twilio not configured - SMS notifications disabled');
    }
  }

  // Send email notification
  async sendEmail(to, subject, message, html = null) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@panchakarmapro.com',
        to,
        subject,
        text: message,
        html: html || message
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Email sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Send SMS notification
  async sendSMS(to, message) {
    try {
      if (!this.twilioClient) {
        console.log('SMS not sent - Twilio not configured');
        return { success: false, error: 'SMS service not configured' };
      }

      const result = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
        to
      });

      console.log('SMS sent successfully:', result.sid);
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('SMS sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Send appointment confirmation
  async sendAppointmentConfirmation(appointment, user) {
    const { therapyType, scheduledDate, startTime, practitioner } = appointment;
    const date = new Date(scheduledDate).toLocaleDateString();
    const time = startTime;

    const subject = `Appointment Confirmed - ${therapyType}`;
    const message = `Dear ${user.firstName},\n\nYour ${therapyType} appointment has been confirmed for ${date} at ${time}.\n\nPractitioner: Dr. ${practitioner.userId.firstName} ${practitioner.userId.lastName}\n\nPlease arrive 15 minutes before your appointment time.\n\nBest regards,\nPanchakarmaPro Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 1.8rem;">Appointment Confirmed</h1>
        </div>
        <div style="background: #f8fafc; padding: 2rem; border-radius: 0 0 8px 8px;">
          <p style="color: #374151; font-size: 1.1rem; margin-bottom: 1.5rem;">Dear ${user.firstName},</p>
          <p style="color: #64748b; line-height: 1.6; margin-bottom: 1.5rem;">Your <strong>${therapyType}</strong> appointment has been confirmed for:</p>
          <div style="background: white; padding: 1.5rem; border-radius: 8px; margin: 1.5rem 0; border-left: 4px solid #059669;">
            <p style="margin: 0; font-size: 1.2rem; color: #064e3b;"><strong>Date:</strong> ${date}</p>
            <p style="margin: 0.5rem 0; font-size: 1.2rem; color: #064e3b;"><strong>Time:</strong> ${time}</p>
            <p style="margin: 0; font-size: 1.2rem; color: #064e3b;"><strong>Practitioner:</strong> Dr. ${practitioner.userId.firstName} ${practitioner.userId.lastName}</p>
          </div>
          <p style="color: #64748b; line-height: 1.6; margin-bottom: 1rem;">Please arrive 15 minutes before your appointment time.</p>
          <p style="color: #64748b; line-height: 1.6; margin: 0;">Best regards,<br>PanchakarmaPro Team</p>
        </div>
      </div>
    `;

    // Send email
    await this.sendEmail(user.email, subject, message, html);

    // Send SMS if phone number is available
    if (user.phone) {
      const smsMessage = `PanchakarmaPro: Your ${therapyType} appointment is confirmed for ${date} at ${time}. Please arrive 15 minutes early.`;
      await this.sendSMS(user.phone, smsMessage);
    }
  }

  // Send appointment reminder
  async sendAppointmentReminder(appointment, user, hoursBefore = 24) {
    const { therapyType, scheduledDate, startTime, practitioner } = appointment;
    const date = new Date(scheduledDate).toLocaleDateString();
    const time = startTime;

    const subject = `Appointment Reminder - ${therapyType}`;
    const message = `Dear ${user.firstName},\n\nThis is a reminder that you have a ${therapyType} appointment tomorrow (${date}) at ${time}.\n\nPractitioner: Dr. ${practitioner.userId.firstName} ${practitioner.userId.lastName}\n\nPlease arrive 15 minutes before your appointment time.\n\nBest regards,\nPanchakarmaPro Team`;

    // Send email
    await this.sendEmail(user.email, subject, message);

    // Send SMS if phone number is available
    if (user.phone) {
      const smsMessage = `PanchakarmaPro Reminder: Your ${therapyType} appointment is tomorrow (${date}) at ${time}. Please arrive 15 minutes early.`;
      await this.sendSMS(user.phone, smsMessage);
    }
  }

  // Send appointment cancellation
  async sendAppointmentCancellation(appointment, user, reason = '') {
    const { therapyType, scheduledDate, startTime } = appointment;
    const date = new Date(scheduledDate).toLocaleDateString();
    const time = startTime;

    const subject = `Appointment Cancelled - ${therapyType}`;
    const message = `Dear ${user.firstName},\n\nYour ${therapyType} appointment scheduled for ${date} at ${time} has been cancelled.${reason ? `\n\nReason: ${reason}` : ''}\n\nPlease contact us to reschedule if needed.\n\nBest regards,\nPanchakarmaPro Team`;

    // Send email
    await this.sendEmail(user.email, subject, message);

    // Send SMS if phone number is available
    if (user.phone) {
      const smsMessage = `PanchakarmaPro: Your ${therapyType} appointment for ${date} at ${time} has been cancelled. Please contact us to reschedule.`;
      await this.sendSMS(user.phone, smsMessage);
    }
  }

  // Send therapy session feedback request
  async sendFeedbackRequest(appointment, user) {
    const { therapyType, scheduledDate } = appointment;
    const date = new Date(scheduledDate).toLocaleDateString();

    const subject = `How was your ${therapyType} session?`;
    const message = `Dear ${user.firstName},\n\nWe hope you had a great ${therapyType} session on ${date}.\n\nYour feedback is important to us and helps us improve our services. Please take a moment to share your experience.\n\nThank you,\nPanchakarmaPro Team`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 1.8rem;">How was your session?</h1>
        </div>
        <div style="background: #f8fafc; padding: 2rem; border-radius: 0 0 8px 8px;">
          <p style="color: #374151; font-size: 1.1rem; margin-bottom: 1.5rem;">Dear ${user.firstName},</p>
          <p style="color: #64748b; line-height: 1.6; margin-bottom: 1.5rem;">We hope you had a great <strong>${therapyType}</strong> session on ${date}.</p>
          <p style="color: #64748b; line-height: 1.6; margin-bottom: 1.5rem;">Your feedback is important to us and helps us improve our services. Please take a moment to share your experience.</p>
          <div style="text-align: center; margin: 2rem 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/patient-dashboard.html" style="background: #059669; color: white; padding: 1rem 2rem; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Leave Feedback</a>
          </div>
          <p style="color: #64748b; line-height: 1.6; margin: 0;">Thank you,<br>PanchakarmaPro Team</p>
        </div>
      </div>
    `;

    // Send email
    await this.sendEmail(user.email, subject, message, html);
  }
}

module.exports = new NotificationService();
