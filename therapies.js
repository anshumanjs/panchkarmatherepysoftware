const express = require('express');
const { body, validationResult } = require('express-validator');
const Therapy = require('../models/Therapy');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/therapies
// @desc    Get all therapies
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, type, search, isActive = true } = req.query;
    const query = { isActive };

    if (type) {
      query.type = type;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { benefits: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const therapies = await Therapy.find(query)
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Therapy.countDocuments(query);

    res.json({
      success: true,
      data: {
        therapies,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get therapies error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching therapies',
      error: error.message
    });
  }
});

// @route   GET /api/therapies/:id
// @desc    Get therapy by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const therapy = await Therapy.findById(req.params.id);

    if (!therapy) {
      return res.status(404).json({
        success: false,
        message: 'Therapy not found'
      });
    }

    res.json({
      success: true,
      data: therapy
    });
  } catch (error) {
    console.error('Get therapy error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching therapy',
      error: error.message
    });
  }
});

// @route   POST /api/therapies
// @desc    Create new therapy (admin/practitioner only)
// @access  Private
router.post('/', auth, authorize('practitioner', 'admin'), [
  body('name').notEmpty().trim(),
  body('type').isIn(['abhyanga', 'shirodhara', 'basti', 'nasya', 'virechana', 'rakta-mokshana', 'general']),
  body('description').notEmpty().trim(),
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

    const therapy = new Therapy({
      ...req.body,
      createdBy: req.user.role === 'practitioner' ? req.user._id : undefined
    });

    await therapy.save();

    res.status(201).json({
      success: true,
      message: 'Therapy created successfully',
      data: therapy
    });
  } catch (error) {
    console.error('Create therapy error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating therapy',
      error: error.message
    });
  }
});

// @route   PUT /api/therapies/:id
// @desc    Update therapy (admin/practitioner only)
// @access  Private
router.put('/:id', auth, authorize('practitioner', 'admin'), async (req, res) => {
  try {
    const therapy = await Therapy.findById(req.params.id);
    if (!therapy) {
      return res.status(404).json({
        success: false,
        message: 'Therapy not found'
      });
    }

    // Check if practitioner can edit (only their own or admin)
    if (req.user.role === 'practitioner' && therapy.createdBy && 
        therapy.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const allowedFields = [
      'name', 'type', 'description', 'benefits', 'contraindications',
      'duration', 'cost', 'preparationInstructions', 'postTreatmentInstructions',
      'requiredEquipment', 'requiredOils', 'difficulty', 'isActive'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        therapy[field] = req.body[field];
      }
    });

    await therapy.save();

    res.json({
      success: true,
      message: 'Therapy updated successfully',
      data: therapy
    });
  } catch (error) {
    console.error('Update therapy error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating therapy',
      error: error.message
    });
  }
});

// @route   DELETE /api/therapies/:id
// @desc    Delete therapy (admin only)
// @access  Private
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const therapy = await Therapy.findById(req.params.id);
    if (!therapy) {
      return res.status(404).json({
        success: false,
        message: 'Therapy not found'
      });
    }

    // Soft delete by setting isActive to false
    therapy.isActive = false;
    await therapy.save();

    res.json({
      success: true,
      message: 'Therapy deactivated successfully'
    });
  } catch (error) {
    console.error('Delete therapy error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting therapy',
      error: error.message
    });
  }
});

// @route   GET /api/therapies/types/list
// @desc    Get list of therapy types
// @access  Public
router.get('/types/list', async (req, res) => {
  try {
    const types = [
      { value: 'abhyanga', label: 'Abhyanga (Oil Massage)' },
      { value: 'shirodhara', label: 'Shirodhara (Oil Pouring)' },
      { value: 'basti', label: 'Basti (Enema Therapy)' },
      { value: 'nasya', label: 'Nasya (Nasal Therapy)' },
      { value: 'virechana', label: 'Virechana (Purgation)' },
      { value: 'rakta-mokshana', label: 'Rakta Mokshana (Bloodletting)' },
      { value: 'general', label: 'General Consultation' }
    ];

    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    console.error('Get therapy types error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching therapy types',
      error: error.message
    });
  }
});

module.exports = router;
