const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireRole, logActivity } = require('../middleware/authentication');
const PatientDetail = require('../models/PatientDetail');
const User = require('../models/User');

const router = express.Router();

// @route   GET /api/patient-details/:patientId
// @desc    Get patient details
// @access  Private (Patient or Practitioner)
router.get('/:patientId', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const user = req.user;

    // Check if user has access to this patient's details
    if (user.role === 'patient' && user._id.toString() !== patientId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own details.'
      });
    }

    const patientDetails = await PatientDetail.findOne({ patientId })
      .populate('patientId', 'firstName lastName email phone')
      .populate('problems.practitionerNotes.practitionerId', 'firstName lastName')
      .populate('improvements.recordedBy', 'firstName lastName')
      .populate('notes.practitionerId', 'firstName lastName');

    if (!patientDetails) {
      return res.status(404).json({
        success: false,
        message: 'Patient details not found'
      });
    }

    // Log activity
    await logActivity(user._id, 'patient_detail_view', {
      patientId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: patientDetails
    });
  } catch (error) {
    console.error('Get patient details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching patient details',
      error: error.message
    });
  }
});

// @route   POST /api/patient-details
// @desc    Create or update patient details
// @access  Private (Patient or Practitioner)
router.post('/', requireAuth, [
  body('patientId').isMongoId(),
  body('personalInfo').optional().isObject(),
  body('medicalHistory').optional().isObject()
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

    const { patientId, personalInfo, medicalHistory } = req.body;
    const user = req.user;

    // Check if user has permission to update this patient's details
    if (user.role === 'patient' && user._id.toString() !== patientId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own details.'
      });
    }

    let patientDetails = await PatientDetail.findOne({ patientId });

    if (patientDetails) {
      // Update existing details
      if (personalInfo) patientDetails.personalInfo = { ...patientDetails.personalInfo, ...personalInfo };
      if (medicalHistory) patientDetails.medicalHistory = { ...patientDetails.medicalHistory, ...medicalHistory };
      
      await patientDetails.save();
    } else {
      // Create new patient details
      patientDetails = new PatientDetail({
        patientId,
        personalInfo: personalInfo || {},
        medicalHistory: medicalHistory || {}
      });
      
      await patientDetails.save();
    }

    // Log activity
    await logActivity(user._id, 'patient_detail_update', {
      patientId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Patient details updated successfully',
      data: patientDetails
    });
  } catch (error) {
    console.error('Update patient details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating patient details',
      error: error.message
    });
  }
});

// @route   POST /api/patient-details/:patientId/problems
// @desc    Add a new problem for patient
// @access  Private (Patient or Practitioner)
router.post('/:patientId/problems', requireAuth, [
  body('title').notEmpty(),
  body('description').notEmpty(),
  body('severity').isIn(['mild', 'moderate', 'severe']),
  body('status').optional().isIn(['active', 'resolved', 'improving', 'worsening'])
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

    const { patientId } = req.params;
    const { title, description, severity, status = 'active' } = req.body;
    const user = req.user;

    // Check if user has permission to add problems for this patient
    if (user.role === 'patient' && user._id.toString() !== patientId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only add problems to your own record.'
      });
    }

    let patientDetails = await PatientDetail.findOne({ patientId });
    if (!patientDetails) {
      patientDetails = new PatientDetail({ patientId });
    }

    const problemId = new Date().getTime().toString();
    const newProblem = {
      problemId,
      title,
      description,
      severity,
      status,
      reportedDate: new Date(),
      practitionerNotes: []
    };

    patientDetails.problems.push(newProblem);
    await patientDetails.save();

    // Log activity
    await logActivity(user._id, 'problem_added', {
      patientId,
      problemId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Problem added successfully',
      data: newProblem
    });
  } catch (error) {
    console.error('Add problem error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding problem',
      error: error.message
    });
  }
});

// @route   POST /api/patient-details/:patientId/improvements
// @desc    Add an improvement record for patient
// @access  Private (Patient or Practitioner)
router.post('/:patientId/improvements', requireAuth, [
  body('problemId').notEmpty(),
  body('title').notEmpty(),
  body('description').notEmpty(),
  body('improvementPercentage').isFloat({ min: 0, max: 100 }),
  body('measurementType').isIn(['pain_scale', 'mobility', 'energy_level', 'sleep_quality', 'mood', 'other']),
  body('beforeValue').optional().isNumeric(),
  body('afterValue').optional().isNumeric(),
  body('unit').optional().isString(),
  body('notes').optional().isString()
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

    const { patientId } = req.params;
    const { problemId, title, description, improvementPercentage, measurementType, beforeValue, afterValue, unit, notes } = req.body;
    const user = req.user;

    // Check if user has permission to add improvements for this patient
    if (user.role === 'patient' && user._id.toString() !== patientId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only add improvements to your own record.'
      });
    }

    let patientDetails = await PatientDetail.findOne({ patientId });
    if (!patientDetails) {
      return res.status(404).json({
        success: false,
        message: 'Patient details not found'
      });
    }

    const improvementId = new Date().getTime().toString();
    const newImprovement = {
      improvementId,
      problemId,
      title,
      description,
      improvementPercentage,
      measurementType,
      beforeValue,
      afterValue,
      unit,
      recordedDate: new Date(),
      recordedBy: user._id,
      notes
    };

    patientDetails.improvements.push(newImprovement);
    await patientDetails.save();

    // Log activity
    await logActivity(user._id, 'improvement_added', {
      patientId,
      improvementId,
      problemId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Improvement recorded successfully',
      data: newImprovement
    });
  } catch (error) {
    console.error('Add improvement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding improvement',
      error: error.message
    });
  }
});

// @route   POST /api/patient-details/:patientId/vital-signs
// @desc    Add vital signs for patient
// @access  Private (Practitioner only)
router.post('/:patientId/vital-signs', requireAuth, requireRole(['practitioner']), [
  body('bloodPressure.systolic').optional().isNumeric(),
  body('bloodPressure.diastolic').optional().isNumeric(),
  body('heartRate').optional().isNumeric(),
  body('temperature').optional().isNumeric(),
  body('weight').optional().isNumeric(),
  body('height').optional().isNumeric()
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

    const { patientId } = req.params;
    const vitalSignsData = req.body;
    const user = req.user;

    let patientDetails = await PatientDetail.findOne({ patientId });
    if (!patientDetails) {
      patientDetails = new PatientDetail({ patientId });
    }

    // Calculate BMI if weight and height are provided
    let bmi = null;
    if (vitalSignsData.weight && vitalSignsData.height) {
      const heightInMeters = vitalSignsData.height / 100;
      bmi = vitalSignsData.weight / (heightInMeters * heightInMeters);
    }

    const newVitalSigns = {
      ...vitalSignsData,
      bmi,
      date: new Date(),
      recordedBy: user._id
    };

    patientDetails.vitalSigns.push(newVitalSigns);
    await patientDetails.save();

    // Log activity
    await logActivity(user._id, 'vital_signs_added', {
      patientId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Vital signs recorded successfully',
      data: newVitalSigns
    });
  } catch (error) {
    console.error('Add vital signs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding vital signs',
      error: error.message
    });
  }
});

// @route   GET /api/patient-details/:patientId/activity-log
// @desc    Get patient activity log
// @access  Private (Practitioner only)
router.get('/:patientId/activity-log', requireAuth, requireRole(['practitioner']), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const ActivityLog = require('../models/ActivityLog');
    const activities = await ActivityLog.find({ userId: patientId })
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'firstName lastName email');

    const total = await ActivityLog.countDocuments({ userId: patientId });

    res.json({
      success: true,
      data: {
        activities,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching activity log',
      error: error.message
    });
  }
});

module.exports = router;
