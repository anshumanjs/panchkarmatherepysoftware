const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LoginLog = require('../models/LoginLog');
const ActivityLog = require('../models/ActivityLog');

// Authentication guard middleware
const requireAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.cookies?.token || 
                  req.session?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        redirectTo: '/login'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user account deactivated.',
        redirectTo: '/login'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
      redirectTo: '/login'
    });
  }
};

// Role-based access control
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

// Log user activity
const logActivity = async (userId, action, details = {}) => {
  try {
    const activityLog = new ActivityLog({
      userId,
      action,
      details,
      timestamp: new Date(),
      ipAddress: details.ipAddress || 'unknown',
      userAgent: details.userAgent || 'unknown'
    });

    await activityLog.save();
  } catch (error) {
    console.error('Activity logging error:', error);
  }
};

// Log login attempts
const logLoginAttempt = async (email, success, details = {}) => {
  try {
    const loginLog = new LoginLog({
      email,
      success,
      timestamp: new Date(),
      ipAddress: details.ipAddress || 'unknown',
      userAgent: details.userAgent || 'unknown',
      failureReason: success ? null : details.failureReason || 'Unknown error'
    });

    await loginLog.save();
  } catch (error) {
    console.error('Login logging error:', error);
  }
};

// Session management
const createSession = (req, user) => {
  req.session.userId = user._id;
  req.session.role = user.role;
  req.session.loginTime = new Date();
  req.session.isAuthenticated = true;
};

const destroySession = (req) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
    }
  });
};

module.exports = {
  requireAuth,
  requireRole,
  logActivity,
  logLoginAttempt,
  createSession,
  destroySession
};
