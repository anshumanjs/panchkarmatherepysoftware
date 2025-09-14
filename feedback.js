const express = require('express');
const { body, validationResult } = require('express-validator');
const Feedback = require('../models/Feedback');
const Patient = require('../models/Patient');
const Practitioner = require('../models/Practitioner');
const Appointment = require('../models/Appointment');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/feedback
// @desc    Submit feedback for an appointment
// @access  Private (patients only)
router.post('/', auth, authorize('patient'), [
  body('appointmentId').isMongoId(),
  body('therapyType').notEmpty().trim(),
  body('rating.overall').isInt({ min: 1, max: 5 }),
  body('rating.practitioner').optional().isInt({ min: 1, max: 5 }),
  body('rating.facility').optional().isInt({ min: 1, max: 5 }),
  body('rating.cleanliness').optional().isInt({ min: 1, max: 5 }),
  body('rating.value').optional().isInt({ min: 1, max: 5 }),
  body('comments').optional().isLength({ max: 1000 }),
  body('symptoms.before').optional().isArray(),
  body('symptoms.after').optional().isArray(),
  body('symptoms.improvement').optional().isIn(['significant', 'moderate', 'slight', 'none', 'worse']),
  body('sideEffects').optional().isArray(),
  body('recommendations').optional().isLength({ max: 500 }),
  body('wouldRecommend').optional().isBoolean(),
  body('isAnonymous').optional().isBoolean()
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
      appointmentId,
      therapyType,
      rating,
      comments,
      symptoms,
      sideEffects,
      recommendations,
      wouldRecommend = true,
      isAnonymous = false
    } = req.body;

    // Get patient
    const patient = await Patient.findOne({ userId: req.user._id });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    // Get appointment
    const appointment = await Appointment.findById(appointmentId)
      .populate('practitioner');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if appointment belongs to patient
    if (appointment.patient.toString() !== patient._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if feedback already exists for this appointment
    const existingFeedback = await Feedback.findOne({ appointment: appointmentId });
    if (existingFeedback) {
      return res.status(400).json({
        success: false,
        message: 'Feedback already submitted for this appointment'
      });
    }

    // Create feedback
    const feedback = new Feedback({
      patient: patient._id,
      practitioner: appointment.practitioner._id,
      appointment: appointmentId,
      therapyType,
      rating,
      comments,
      symptoms,
      sideEffects,
      recommendations,
      wouldRecommend,
      isAnonymous
    });

    await feedback.save();

    // Update practitioner rating
    await updatePractitionerRating(appointment.practitioner._id);

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: feedback
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error submitting feedback',
      error: error.message
    });
  }
});

// @route   GET /api/feedback
// @desc    Get feedback with filters
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      practitionerId,
      patientId,
      therapyType,
      status = 'approved',
      startDate,
      endDate
    } = req.query;

    const query = { status };

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
    if (practitionerId) query.practitioner = practitionerId;
    if (patientId) query.patient = patientId;
    if (therapyType) query.therapyType = therapyType;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const feedback = await Feedback.find(query)
      .populate('patient', 'userId')
      .populate('patient.userId', 'firstName lastName')
      .populate('practitioner', 'userId')
      .populate('practitioner.userId', 'firstName lastName')
      .populate('appointment', 'scheduledDate therapyType')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Feedback.countDocuments(query);

    res.json({
      success: true,
      data: {
        feedback,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching feedback',
      error: error.message
    });
  }
});

// @route   GET /api/feedback/:id
// @desc    Get feedback by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id)
      .populate('patient', 'userId')
      .populate('patient.userId', 'firstName lastName')
      .populate('practitioner', 'userId')
      .populate('practitioner.userId', 'firstName lastName')
      .populate('appointment', 'scheduledDate therapyType');

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ userId: req.user._id });
      if (!patient || feedback.patient._id.toString() !== patient._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    } else if (req.user.role === 'practitioner') {
      const practitioner = await Practitioner.findOne({ userId: req.user._id });
      if (!practitioner || feedback.practitioner._id.toString() !== practitioner._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    res.json({
      success: true,
      data: feedback
    });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching feedback',
      error: error.message
    });
  }
});

// @route   PUT /api/feedback/:id/status
// @desc    Update feedback status (practitioners/admins only)
// @access  Private
router.put('/:id/status', auth, authorize('practitioner', 'admin'), [
  body('status').isIn(['pending', 'approved', 'rejected']),
  body('practitionerResponse').optional().isLength({ max: 1000 })
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

    const { status, practitionerResponse } = req.body;
    const feedback = await Feedback.findById(req.params.id);
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    // Check if practitioner can respond (only their own feedback)
    if (req.user.role === 'practitioner') {
      const practitioner = await Practitioner.findOne({ userId: req.user._id });
      if (!practitioner || feedback.practitioner.toString() !== practitioner._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    feedback.status = status;
    if (practitionerResponse) {
      feedback.practitionerResponse = practitionerResponse;
      feedback.respondedAt = new Date();
    }

    await feedback.save();

    res.json({
      success: true,
      message: 'Feedback status updated successfully',
      data: feedback
    });
  } catch (error) {
    console.error('Update feedback status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating feedback status',
      error: error.message
    });
  }
});

// @route   GET /api/feedback/analytics/summary
// @desc    Get feedback analytics summary
// @access  Private (practitioners/admins only)
router.get('/analytics/summary', auth, authorize('practitioner', 'admin'), async (req, res) => {
  try {
    const { practitionerId, startDate, endDate } = req.query;
    const matchQuery = { status: 'approved' };

    if (practitionerId) {
      matchQuery.practitioner = practitionerId;
    } else if (req.user.role === 'practitioner') {
      const practitioner = await Practitioner.findOne({ userId: req.user._id });
      if (practitioner) {
        matchQuery.practitioner = practitioner._id;
      }
    }

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const analytics = await Feedback.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalFeedback: { $sum: 1 },
          averageRating: { $avg: '$rating.overall' },
          wouldRecommend: {
            $sum: { $cond: ['$wouldRecommend', 1, 0] }
          },
          ratingDistribution: {
            $push: '$rating.overall'
          }
        }
      }
    ]);

    const therapyTypeStats = await Feedback.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$therapyType',
          count: { $sum: 1 },
          averageRating: { $avg: '$rating.overall' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const monthlyStats = await Feedback.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          averageRating: { $avg: '$rating.overall' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: analytics[0] || {
          totalFeedback: 0,
          averageRating: 0,
          wouldRecommend: 0,
          ratingDistribution: []
        },
        therapyTypeStats,
        monthlyStats
      }
    });
  } catch (error) {
    console.error('Get feedback analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching feedback analytics',
      error: error.message
    });
  }
});

// Helper function to update practitioner rating
async function updatePractitionerRating(practitionerId) {
  try {
    const stats = await Feedback.aggregate([
      { $match: { practitioner: practitionerId, status: 'approved' } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating.overall' },
          count: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      await Practitioner.findByIdAndUpdate(practitionerId, {
        'rating.average': Math.round(stats[0].averageRating * 10) / 10,
        'rating.count': stats[0].count
      });
    }
  } catch (error) {
    console.error('Update practitioner rating error:', error);
  }
}

module.exports = router;
