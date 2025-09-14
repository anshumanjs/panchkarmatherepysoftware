const express = require('express');
const { body, validationResult } = require('express-validator');
const Patient = require('../models/Patient');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Feedback = require('../models/Feedback');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/patients
// @desc    Get all patients (practitioners and admins only)
// @access  Private
router.get('/', auth, authorize('practitioner', 'admin'), async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { 'userId.firstName': { $regex: search, $options: 'i' } },
        { 'userId.lastName': { $regex: search, $options: 'i' } },
        { 'userId.email': { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    const patients = await Patient.find(query)
      .populate('userId', 'firstName lastName email phone')
      .populate('assignedPractitioner', 'userId')
      .populate('assignedPractitioner.userId', 'firstName lastName')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Patient.countDocuments(query);

    res.json({
      success: true,
      data: {
        patients,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching patients',
      error: error.message
    });
  }
});

// @route   GET /api/patients/me
// @desc    Get current patient profile
// @access  Private (patients only)
router.get('/me', auth, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ userId: req.user._id })
      .populate('assignedPractitioner', 'userId')
      .populate('assignedPractitioner.userId', 'firstName lastName email phone');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    res.json({
      success: true,
      data: patient
    });
  } catch (error) {
    console.error('Get patient profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching patient profile',
      error: error.message
    });
  }
});

// @route   PUT /api/patients/me
// @desc    Update current patient profile
// @access  Private (patients only)
router.put('/me', auth, authorize('patient'), [
  body('dateOfBirth').optional().isISO8601(),
  body('gender').optional().isIn(['male', 'female', 'other']),
  body('address.street').optional().isLength({ min: 1 }),
  body('address.city').optional().isLength({ min: 1 }),
  body('address.state').optional().isLength({ min: 1 }),
  body('address.zipCode').optional().isLength({ min: 1 })
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

    const patient = await Patient.findOne({ userId: req.user._id });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    // Update allowed fields
    const allowedFields = [
      'dateOfBirth', 'gender', 'address', 'emergencyContact',
      'medicalHistory', 'healthGoals', 'dietaryRestrictions', 'lifestyle', 'insurance'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        patient[field] = req.body[field];
      }
    });

    await patient.save();

    res.json({
      success: true,
      message: 'Patient profile updated successfully',
      data: patient
    });
  } catch (error) {
    console.error('Update patient profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating patient profile',
      error: error.message
    });
  }
});

// @route   GET /api/patients/:id
// @desc    Get patient by ID (practitioners and admins only)
// @access  Private
router.get('/:id', auth, authorize('practitioner', 'admin'), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate('userId', 'firstName lastName email phone')
      .populate('assignedPractitioner', 'userId')
      .populate('assignedPractitioner.userId', 'firstName lastName email phone');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.json({
      success: true,
      data: patient
    });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching patient',
      error: error.message
    });
  }
});

// @route   GET /api/patients/me/appointments
// @desc    Get current patient's appointments
// @access  Private (patients only)
router.get('/me/appointments', auth, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ userId: req.user._id });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    const { status, page = 1, limit = 10 } = req.query;
    const query = { patient: patient._id };

    if (status) {
      query.status = status;
    }

    const appointments = await Appointment.find(query)
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
    console.error('Get patient appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching appointments',
      error: error.message
    });
  }
});

// @route   GET /api/patients/me/progress
// @desc    Get current patient's therapy progress
// @access  Private (patients only)
router.get('/me/progress', auth, authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ userId: req.user._id });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    // Get completed appointments
    const completedAppointments = await Appointment.find({
      patient: patient._id,
      status: 'completed'
    }).populate('practitioner', 'userId')
      .populate('practitioner.userId', 'firstName lastName');

    // Get therapy progress
    const therapyProgress = {};
    completedAppointments.forEach(appointment => {
      const therapyType = appointment.therapyType;
      if (!therapyProgress[therapyType]) {
        therapyProgress[therapyType] = {
          totalSessions: 0,
          completedSessions: 0,
          lastSession: null,
          averageRating: 0,
          totalRating: 0,
          ratingCount: 0
        };
      }
      therapyProgress[therapyType].totalSessions++;
      therapyProgress[therapyType].completedSessions++;
      therapyProgress[therapyType].lastSession = appointment.scheduledDate;
    });

    // Get feedback for ratings
    const feedback = await Feedback.find({ patient: patient._id });
    feedback.forEach(fb => {
      const therapyType = fb.therapyType;
      if (therapyProgress[therapyType]) {
        therapyProgress[therapyType].totalRating += fb.rating.overall;
        therapyProgress[therapyType].ratingCount++;
        therapyProgress[therapyType].averageRating = 
          therapyProgress[therapyType].totalRating / therapyProgress[therapyType].ratingCount;
      }
    });

    res.json({
      success: true,
      data: {
        patient: {
          currentTherapy: patient.panchakarmaHistory.currentTherapy,
          totalSessions: completedAppointments.length,
          therapyProgress
        }
      }
    });
  } catch (error) {
    console.error('Get patient progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching progress',
      error: error.message
    });
  }
});

// @route   POST /api/patients/me/assign-practitioner
// @desc    Assign practitioner to patient
// @access  Private (patients only)
router.post('/me/assign-practitioner', auth, authorize('patient'), [
  body('practitionerId').isMongoId()
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

    const { practitionerId } = req.body;
    const patient = await Patient.findOne({ userId: req.user._id });
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    patient.assignedPractitioner = practitionerId;
    await patient.save();

    res.json({
      success: true,
      message: 'Practitioner assigned successfully',
      data: patient
    });
  } catch (error) {
    console.error('Assign practitioner error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error assigning practitioner',
      error: error.message
    });
  }
});

module.exports = router;
