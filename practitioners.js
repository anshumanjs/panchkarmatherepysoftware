const express = require('express');
const { body, validationResult } = require('express-validator');
const Practitioner = require('../models/Practitioner');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Feedback = require('../models/Feedback');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/practitioners
// @desc    Get all practitioners
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, specialization, search } = req.query;
    const query = { status: 'active' };

    if (specialization) {
      query.specialization = specialization;
    }

    if (search) {
      query.$or = [
        { 'userId.firstName': { $regex: search, $options: 'i' } },
        { 'userId.lastName': { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } }
      ];
    }

    const practitioners = await Practitioner.find(query)
      .populate('userId', 'firstName lastName email phone')
      .sort({ 'rating.average': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Practitioner.countDocuments(query);

    res.json({
      success: true,
      data: {
        practitioners,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get practitioners error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching practitioners',
      error: error.message
    });
  }
});

// @route   GET /api/practitioners/me
// @desc    Get current practitioner profile
// @access  Private (practitioners only)
router.get('/me', auth, authorize('practitioner'), async (req, res) => {
  try {
    const practitioner = await Practitioner.findOne({ userId: req.user._id })
      .populate('userId', 'firstName lastName email phone')
      .populate('patients', 'userId')
      .populate('patients.userId', 'firstName lastName email');

    if (!practitioner) {
      return res.status(404).json({
        success: false,
        message: 'Practitioner profile not found'
      });
    }

    res.json({
      success: true,
      data: practitioner
    });
  } catch (error) {
    console.error('Get practitioner profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching practitioner profile',
      error: error.message
    });
  }
});

// @route   PUT /api/practitioners/me
// @desc    Update current practitioner profile
// @access  Private (practitioners only)
router.put('/me', auth, authorize('practitioner'), [
  body('specialization').optional().isArray(),
  body('experience').optional().isInt({ min: 0 }),
  body('bio').optional().isLength({ max: 1000 }),
  body('consultationFee').optional().isFloat({ min: 0 })
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

    const practitioner = await Practitioner.findOne({ userId: req.user._id });
    if (!practitioner) {
      return res.status(404).json({
        success: false,
        message: 'Practitioner profile not found'
      });
    }

    // Update allowed fields
    const allowedFields = [
      'specialization', 'experience', 'education', 'certifications',
      'bio', 'languages', 'availability', 'consultationFee'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        practitioner[field] = req.body[field];
      }
    });

    await practitioner.save();

    res.json({
      success: true,
      message: 'Practitioner profile updated successfully',
      data: practitioner
    });
  } catch (error) {
    console.error('Update practitioner profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating practitioner profile',
      error: error.message
    });
  }
});

// @route   GET /api/practitioners/:id
// @desc    Get practitioner by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const practitioner = await Practitioner.findById(req.params.id)
      .populate('userId', 'firstName lastName email phone');

    if (!practitioner) {
      return res.status(404).json({
        success: false,
        message: 'Practitioner not found'
      });
    }

    res.json({
      success: true,
      data: practitioner
    });
  } catch (error) {
    console.error('Get practitioner error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching practitioner',
      error: error.message
    });
  }
});

// @route   GET /api/practitioners/me/patients
// @desc    Get practitioner's patients
// @access  Private (practitioners only)
router.get('/me/patients', auth, authorize('practitioner'), async (req, res) => {
  try {
    const practitioner = await Practitioner.findOne({ userId: req.user._id });
    if (!practitioner) {
      return res.status(404).json({
        success: false,
        message: 'Practitioner profile not found'
      });
    }

    const { page = 1, limit = 10, status, search } = req.query;
    const query = { assignedPractitioner: practitioner._id };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { 'userId.firstName': { $regex: search, $options: 'i' } },
        { 'userId.lastName': { $regex: search, $options: 'i' } },
        { 'userId.email': { $regex: search, $options: 'i' } }
      ];
    }

    const patients = await Patient.find(query)
      .populate('userId', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

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
    console.error('Get practitioner patients error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching patients',
      error: error.message
    });
  }
});

// @route   GET /api/practitioners/me/appointments
// @desc    Get practitioner's appointments
// @access  Private (practitioners only)
router.get('/me/appointments', auth, authorize('practitioner'), async (req, res) => {
  try {
    const practitioner = await Practitioner.findOne({ userId: req.user._id });
    if (!practitioner) {
      return res.status(404).json({
        success: false,
        message: 'Practitioner profile not found'
      });
    }

    const { page = 1, limit = 10, status, startDate, endDate } = req.query;
    const query = { practitioner: practitioner._id };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.scheduledDate = {};
      if (startDate) query.scheduledDate.$gte = new Date(startDate);
      if (endDate) query.scheduledDate.$lte = new Date(endDate);
    }

    const appointments = await Appointment.find(query)
      .populate('patient', 'userId')
      .populate('patient.userId', 'firstName lastName email phone')
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
    console.error('Get practitioner appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching appointments',
      error: error.message
    });
  }
});

// @route   GET /api/practitioners/me/analytics
// @desc    Get practitioner analytics
// @access  Private (practitioners only)
router.get('/me/analytics', auth, authorize('practitioner'), async (req, res) => {
  try {
    const practitioner = await Practitioner.findOne({ userId: req.user._id });
    if (!practitioner) {
      return res.status(404).json({
        success: false,
        message: 'Practitioner profile not found'
      });
    }

    const { startDate, endDate } = req.query;
    const dateFilter = {};
    
    if (startDate || endDate) {
      dateFilter.scheduledDate = {};
      if (startDate) dateFilter.scheduledDate.$gte = new Date(startDate);
      if (endDate) dateFilter.scheduledDate.$lte = new Date(endDate);
    }

    // Get appointment statistics
    const totalAppointments = await Appointment.countDocuments({
      practitioner: practitioner._id,
      ...dateFilter
    });

    const completedAppointments = await Appointment.countDocuments({
      practitioner: practitioner._id,
      status: 'completed',
      ...dateFilter
    });

    const cancelledAppointments = await Appointment.countDocuments({
      practitioner: practitioner._id,
      status: 'cancelled',
      ...dateFilter
    });

    // Get therapy type distribution
    const therapyStats = await Appointment.aggregate([
      {
        $match: {
          practitioner: practitioner._id,
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$therapyType',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$cost' }
        }
      }
    ]);

    // Get feedback statistics
    const feedbackStats = await Feedback.aggregate([
      {
        $match: {
          practitioner: practitioner._id,
          ...dateFilter
        }
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating.overall' },
          totalFeedback: { $sum: 1 },
          wouldRecommend: {
            $sum: { $cond: ['$wouldRecommend', 1, 0] }
          }
        }
      }
    ]);

    // Get monthly revenue
    const monthlyRevenue = await Appointment.aggregate([
      {
        $match: {
          practitioner: practitioner._id,
          status: 'completed',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$scheduledDate' },
            month: { $month: '$scheduledDate' }
          },
          revenue: { $sum: '$cost' },
          appointments: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalAppointments,
          completedAppointments,
          cancelledAppointments,
          completionRate: totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0
        },
        therapyStats,
        feedbackStats: feedbackStats[0] || {
          averageRating: 0,
          totalFeedback: 0,
          wouldRecommend: 0
        },
        monthlyRevenue
      }
    });
  } catch (error) {
    console.error('Get practitioner analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching analytics',
      error: error.message
    });
  }
});

// @route   POST /api/practitioners/me/assign-patient
// @desc    Assign patient to practitioner
// @access  Private (practitioners only)
router.post('/me/assign-patient', auth, authorize('practitioner'), [
  body('patientId').isMongoId()
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

    const { patientId } = req.body;
    const practitioner = await Practitioner.findOne({ userId: req.user._id });
    
    if (!practitioner) {
      return res.status(404).json({
        success: false,
        message: 'Practitioner profile not found'
      });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    patient.assignedPractitioner = practitioner._id;
    await patient.save();

    // Add patient to practitioner's patient list
    if (!practitioner.patients.includes(patientId)) {
      practitioner.patients.push(patientId);
      await practitioner.save();
    }

    res.json({
      success: true,
      message: 'Patient assigned successfully',
      data: patient
    });
  } catch (error) {
    console.error('Assign patient error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error assigning patient',
      error: error.message
    });
  }
});

module.exports = router;
