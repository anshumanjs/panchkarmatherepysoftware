const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Practitioner = require('../models/Practitioner');
const LoginLog = require('../models/LoginLog');
const ActivityLog = require('../models/ActivityLog');
const { auth } = require('../middleware/auth');
const { logActivity, logLoginAttempt } = require('../middleware/authentication');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '7d'
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('role').isIn(['patient', 'practitioner'])
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

    const { email, password, firstName, lastName, role, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      role,
      phone
    });

    await user.save();

    // Create role-specific profile
    if (role === 'patient') {
      const patient = new Patient({
        userId: user._id,
        dateOfBirth: req.body.dateOfBirth,
        gender: req.body.gender,
        address: req.body.address || {},
        medicalHistory: req.body.medicalHistory || {},
        panchakarmaHistory: req.body.panchakarmaHistory || {}
      });
      await patient.save();
    } else if (role === 'practitioner') {
      const practitioner = new Practitioner({
        userId: user._id,
        licenseNumber: req.body.licenseNumber,
        specialization: req.body.specialization || [],
        experience: req.body.experience || 0,
        education: req.body.education || [],
        consultationFee: req.body.consultationFee || 0
      });
      await practitioner.save();
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user with comprehensive logging
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  body('userType').optional().isIn(['patient', 'practitioner'])
], async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Log failed login attempt
      await logLoginAttempt(req.body.email, false, {
        ipAddress: clientIP,
        userAgent,
        failureReason: 'Validation errors: ' + errors.array().map(e => e.msg).join(', ')
      });
      
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { email, password, userType } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      // Log failed login attempt
      await logLoginAttempt(email, false, {
        ipAddress: clientIP,
        userAgent,
        failureReason: 'User not found'
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user type matches
    if (userType && user.role !== userType) {
      await logLoginAttempt(email, false, {
        ipAddress: clientIP,
        userAgent,
        failureReason: `Invalid user type. Expected: ${userType}, Actual: ${user.role}`
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid user type for this login'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Log failed login attempt
      await logLoginAttempt(email, false, {
        ipAddress: clientIP,
        userAgent,
        failureReason: 'Invalid password'
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      await logLoginAttempt(email, false, {
        ipAddress: clientIP,
        userAgent,
        failureReason: 'Account deactivated'
      });
      
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Log successful login
    await logLoginAttempt(email, true, {
      ipAddress: clientIP,
      userAgent,
      sessionId: req.sessionID
    });

    // Log user activity
    await logActivity(user._id, 'login', {
      ipAddress: clientIP,
      userAgent,
      loginTime: new Date(),
      userType: user.role
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    
    // Log failed login attempt due to server error
    await logLoginAttempt(req.body.email, false, {
      ipAddress: clientIP,
      userAgent,
      failureReason: 'Server error: ' + error.message
    });
    
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user with activity logging
// @access  Private
router.post('/logout', auth, async (req, res) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    
    // Log logout activity
    await logActivity(req.user._id, 'logout', {
      ipAddress: clientIP,
      userAgent,
      logoutTime: new Date(),
      sessionDuration: req.session?.loginTime ? 
        new Date() - new Date(req.session.loginTime) : null
    });

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout',
      error: error.message
    });
  }
});

// @route   GET /api/auth/verify
// @desc    Verify token validity
// @access  Private
router.get('/verify', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Token is valid',
      user: req.user.toJSON()
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// @route   POST /api/auth/log-activity
// @desc    Log user activity
// @access  Private
router.post('/log-activity', auth, async (req, res) => {
  try {
    const { action, details } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    await logActivity(req.user._id, action, {
      ...details,
      ipAddress: clientIP,
      userAgent
    });

    res.json({
      success: true,
      message: 'Activity logged successfully'
    });
  } catch (error) {
    console.error('Activity logging error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error logging activity',
      error: error.message
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = req.user;
    
    // Get role-specific profile
    let profile = null;
    if (user.role === 'patient') {
      profile = await Patient.findOne({ userId: user._id });
    } else if (user.role === 'practitioner') {
      profile = await Practitioner.findOne({ userId: user._id });
    }

    res.json({
      success: true,
      data: {
        user: user.toJSON(),
        profile
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching profile',
      error: error.message
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, phone, preferences } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating profile',
      error: error.message
    });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', auth, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
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

    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error changing password',
      error: error.message
    });
  }
});

module.exports = router;
