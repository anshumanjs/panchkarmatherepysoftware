const express = require('express');
const { body, validationResult } = require('express-validator');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Practitioner = require('../models/Practitioner');
const Notification = require('../models/Notification');
const { auth, authorize } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

// @route   POST /api/appointments
// @desc    Create a new appointment
// @access  Private
router.post('/', auth, [
  body('patientId').isMongoId(),
  body('practitionerId').isMongoId(),
  body('therapyType').isIn(['abhyanga', 'shirodhara', 'basti', 'nasya', 'virechana', 'rakta-mokshana', 'consultation']),
  body('scheduledDate').isISO8601(),
  body('startTime').notEmpty(),
  body('endTime').notEmpty(),
  body('duration').isInt({ min: 15 }),
  body('cost').isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const {
      patientId,
      practitionerId,
      therapyType,
      scheduledDate,
      startTime,
      endTime,
      duration,
      cost,
      notes,
      preSessionInstructions,
      postSessionInstructions
    } = req.body;

    // Check if patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Check if practitioner exists
    const practitioner = await Practitioner.findById(practitionerId);
    if (!practitioner) {
      return res.status(404).json({
        success: false,
        message: 'Practitioner not found'
      });
    }

    // Check for scheduling conflicts
    const conflict = await Appointment.findOne({
      practitioner: practitionerId,
      scheduledDate: new Date(scheduledDate),
      startTime,
      status: { $in: ['scheduled', 'confirmed'] }
    });

    if (conflict) {
      return res.status(400).json({
        success: false,
        message: 'Time slot is already booked'
      });
    }

    // Create appointment
    const appointment = new Appointment({
      patient: patientId,
      practitioner: practitionerId,
      therapyType,
      scheduledDate: new Date(scheduledDate),
      startTime,
      endTime,
      duration,
      cost,
      notes,
      preSessionInstructions,
      postSessionInstructions,
      reminders: [
        {
          type: 'email',
          scheduledTime: new Date(new Date(scheduledDate).getTime() - 24 * 60 * 60 * 1000) // 24 hours before
        },
        {
          type: 'sms',
          scheduledTime: new Date(new Date(scheduledDate).getTime() - 2 * 60 * 60 * 1000) // 2 hours before
        }
      ]
    });

    await appointment.save();

    // Create notification
    const notification = new Notification({
      recipient: patient.userId,
      type: 'appointment_confirmation',
      title: 'Appointment Confirmed',
      message: `Your ${therapyType} appointment has been scheduled for ${new Date(scheduledDate).toLocaleDateString()} at ${startTime}`,
      priority: 'high',
      channels: [
        { type: 'email' },
        { type: 'in-app' }
      ],
      data: {
        appointmentId: appointment._id,
        therapyType,
        scheduledDate: new Date(scheduledDate)
      }
    });

    await notification.save();

    // Send email and SMS notifications
    try {
      await notificationService.sendAppointmentConfirmation(appointment, patient.userId);
    } catch (error) {
      console.error('Failed to send appointment confirmation:', error);
    }

    // Populate appointment data
    await appointment.populate([
      { path: 'patient', populate: { path: 'userId', select: 'firstName lastName email' } },
      { path: 'practitioner', populate: { path: 'userId', select: 'firstName lastName email' } }
    ]);

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating appointment',
      error: error.message
    });
  }
});

// @route   GET /api/appointments
// @desc    Get appointments with filters
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      therapyType,
      practitionerId,
      patientId,
      startDate,
      endDate
    } = req.query;

    const query = {};

    // Role-based filtering
    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ userId: req.user._id });
      if (patient) {
        query.patient = patient._id;
      } else {
        return res.status(404).json({
          success: false,
          message: 'Patient profile not found'
        });
      }
    } else if (req.user.role === 'practitioner') {
      const practitioner = await Practitioner.findOne({ userId: req.user._id });
      if (practitioner) {
        query.practitioner = practitioner._id;
      } else {
        return res.status(404).json({
          success: false,
          message: 'Practitioner profile not found'
        });
      }
    }

    // Additional filters
    if (status) query.status = status;
    if (therapyType) query.therapyType = therapyType;
    if (practitionerId) query.practitioner = practitionerId;
    if (patientId) query.patient = patientId;
    if (startDate || endDate) {
      query.scheduledDate = {};
      if (startDate) query.scheduledDate.$gte = new Date(startDate);
      if (endDate) query.scheduledDate.$lte = new Date(endDate);
    }

    const appointments = await Appointment.find(query)
      .populate('patient', 'userId')
      .populate('patient.userId', 'firstName lastName email phone')
      .populate('practitioner', 'userId')
      .populate('practitioner.userId', 'firstName lastName email phone')
      .sort({ scheduledDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Appointment.countDocuments(query);

    res.json({
      success: true,
      data: {
        appointments,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching appointments',
      error: error.message
    });
  }
});

// @route   GET /api/appointments/:id
// @desc    Get appointment by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'userId')
      .populate('patient.userId', 'firstName lastName email phone')
      .populate('practitioner', 'userId')
      .populate('practitioner.userId', 'firstName lastName email phone');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ userId: req.user._id });
      if (!patient || appointment.patient._id.toString() !== patient._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    } else if (req.user.role === 'practitioner') {
      const practitioner = await Practitioner.findOne({ userId: req.user._id });
      if (!practitioner || appointment.practitioner._id.toString() !== practitioner._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    res.json({
      success: true,
      data: appointment
    });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching appointment',
      error: error.message
    });
  }
});

// @route   PUT /api/appointments/:id
// @desc    Update appointment
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check permissions
    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ userId: req.user._id });
      if (!patient || appointment.patient.toString() !== patient._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const allowedFields = [
      'scheduledDate', 'startTime', 'endTime', 'duration', 'notes',
      'preSessionInstructions', 'postSessionInstructions'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        appointment[field] = req.body[field];
      }
    });

    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment updated successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating appointment',
      error: error.message
    });
  }
});

// @route   PUT /api/appointments/:id/status
// @desc    Update appointment status
// @access  Private
router.put('/:id/status', auth, [
  body('status').isIn(['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show']),
  body('cancellationReason').optional().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { status, cancellationReason } = req.body;
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    appointment.status = status;
    if (cancellationReason) {
      appointment.cancellationReason = cancellationReason;
      appointment.cancelledBy = req.user.role;
      appointment.cancelledAt = new Date();
    }

    await appointment.save();

    // Create notification for status change
    const notification = new Notification({
      recipient: appointment.patient,
      type: 'appointment_confirmation',
      title: `Appointment ${status}`,
      message: `Your appointment has been ${status}`,
      priority: 'medium',
      channels: [
        { type: 'email' },
        { type: 'in-app' }
      ],
      data: {
        appointmentId: appointment._id,
        status
      }
    });

    await notification.save();

    res.json({
      success: true,
      message: 'Appointment status updated successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Update appointment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating appointment status',
      error: error.message
    });
  }
});

// @route   GET /api/appointments/availability
// @desc    Get available time slots for a practitioner on a specific date
// @access  Public
router.get('/availability', async (req, res) => {
  try {
    const { practitionerId, date } = req.query;

    if (!practitionerId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Practitioner ID and date are required'
      });
    }

    // Check if practitioner exists
    const practitioner = await Practitioner.findById(practitionerId);
    if (!practitioner) {
      return res.status(404).json({
        success: false,
        message: 'Practitioner not found'
      });
    }

    const selectedDate = new Date(date);
    const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999));

    // Get existing appointments for the date
    const existingAppointments = await Appointment.find({
      practitioner: practitionerId,
      scheduledDate: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      status: { $in: ['scheduled', 'confirmed'] }
    }).select('startTime endTime');

    // Generate available time slots (10 AM to 6 PM, 30-minute intervals)
    const availableSlots = [];
    const startHour = 10;
    const endHour = 18;
    const slotDuration = 30; // minutes

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minutes = 0; minutes < 60; minutes += slotDuration) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const slotStart = new Date(selectedDate);
        slotStart.setHours(hour, minutes, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);

        // Check if this slot conflicts with existing appointments
        const hasConflict = existingAppointments.some(appointment => {
          const apptStart = new Date(selectedDate);
          const [apptHour, apptMinute] = appointment.startTime.split(':');
          apptStart.setHours(parseInt(apptHour), parseInt(apptMinute), 0, 0);
          
          const apptEnd = new Date(selectedDate);
          const [apptEndHour, apptEndMinute] = appointment.endTime.split(':');
          apptEnd.setHours(parseInt(apptEndHour), parseInt(apptEndMinute), 0, 0);

          return (slotStart < apptEnd && slotEnd > apptStart);
        });

        if (!hasConflict) {
          availableSlots.push({
            time: timeString,
            date: selectedDate.toISOString().split('T')[0],
            available: true
          });
        }
      }
    }

    res.json({
      success: true,
      data: availableSlots
    });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching availability',
      error: error.message
    });
  }
});

// @route   DELETE /api/appointments/:id
// @desc    Cancel/delete appointment
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check permissions
    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ userId: req.user._id });
      if (!patient || appointment.patient.toString() !== patient._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    appointment.status = 'cancelled';
    appointment.cancelledBy = req.user.role;
    appointment.cancelledAt = new Date();
    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error cancelling appointment',
      error: error.message
    });
  }
});

module.exports = router;
