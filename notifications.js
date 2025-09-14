const express = require('express');
const { body, validationResult } = require('express-validator');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Practitioner = require('../models/Practitioner');
const Appointment = require('../models/Appointment');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/notifications
// @desc    Get user notifications
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, priority, isRead } = req.query;
    const query = { recipient: req.user._id, isActive: true };

    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (isRead !== undefined) query.isRead = isRead === 'true';

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isActive: true,
      isRead: false
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching notifications',
      error: error.message
    });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error marking notification as read',
      error: error.message
    });
  }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { 
        isRead: true, 
        readAt: new Date() 
      }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error marking all notifications as read',
      error: error.message
    });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete notification
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.isActive = false;
    await notification.save();

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting notification',
      error: error.message
    });
  }
});

// @route   POST /api/notifications/send
// @desc    Send notification (admin/practitioner only)
// @access  Private
router.post('/send', auth, [
  body('recipientId').isMongoId(),
  body('type').isIn([
    'appointment_reminder',
    'appointment_confirmation',
    'appointment_cancellation',
    'therapy_instructions',
    'feedback_request',
    'payment_reminder',
    'system_update',
    'general'
  ]),
  body('title').notEmpty().trim(),
  body('message').notEmpty().trim(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('channels').isArray().notEmpty()
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
      recipientId,
      type,
      title,
      message,
      priority = 'medium',
      channels,
      data = {}
    } = req.body;

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // Create notification
    const notification = new Notification({
      recipient: recipientId,
      type,
      title,
      message,
      priority,
      channels: channels.map(channel => ({
        type: channel,
        sent: false
      })),
      data
    });

    await notification.save();

    // TODO: Implement actual sending logic for different channels
    // For now, just mark as sent
    notification.channels.forEach(channel => {
      channel.sent = true;
      channel.sentAt = new Date();
      channel.deliveryStatus = 'delivered';
    });

    await notification.save();

    res.status(201).json({
      success: true,
      message: 'Notification sent successfully',
      data: notification
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error sending notification',
      error: error.message
    });
  }
});

// @route   POST /api/notifications/bulk-send
// @desc    Send bulk notifications (admin/practitioner only)
// @access  Private
router.post('/bulk-send', auth, [
  body('recipientIds').isArray().notEmpty(),
  body('type').isIn([
    'appointment_reminder',
    'appointment_confirmation',
    'appointment_cancellation',
    'therapy_instructions',
    'feedback_request',
    'payment_reminder',
    'system_update',
    'general'
  ]),
  body('title').notEmpty().trim(),
  body('message').notEmpty().trim(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('channels').isArray().notEmpty()
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
      recipientIds,
      type,
      title,
      message,
      priority = 'medium',
      channels,
      data = {}
    } = req.body;

    // Validate all recipients exist
    const recipients = await User.find({ _id: { $in: recipientIds } });
    if (recipients.length !== recipientIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some recipients not found'
      });
    }

    // Create notifications
    const notifications = recipientIds.map(recipientId => ({
      recipient: recipientId,
      type,
      title,
      message,
      priority,
      channels: channels.map(channel => ({
        type: channel,
        sent: false
      })),
      data,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    const createdNotifications = await Notification.insertMany(notifications);

    // TODO: Implement actual sending logic for different channels
    // For now, just mark as sent
    for (const notification of createdNotifications) {
      notification.channels.forEach(channel => {
        channel.sent = true;
        channel.sentAt = new Date();
        channel.deliveryStatus = 'delivered';
      });
      await notification.save();
    }

    res.status(201).json({
      success: true,
      message: `Notifications sent to ${createdNotifications.length} recipients`,
      data: {
        count: createdNotifications.length,
        notifications: createdNotifications
      }
    });
  } catch (error) {
    console.error('Bulk send notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error sending bulk notifications',
      error: error.message
    });
  }
});

// @route   GET /api/notifications/stats
// @desc    Get notification statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchQuery = { recipient: req.user._id };

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const stats = await Notification.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: {
            $sum: { $cond: ['$isRead', 0, 1] }
          },
          byType: {
            $push: {
              type: '$type',
              isRead: '$isRead'
            }
          },
          byPriority: {
            $push: {
              priority: '$priority',
              isRead: '$isRead'
            }
          }
        }
      }
    ]);

    // Process type and priority breakdowns
    const typeBreakdown = {};
    const priorityBreakdown = {};

    if (stats.length > 0) {
      stats[0].byType.forEach(item => {
        if (!typeBreakdown[item.type]) {
          typeBreakdown[item.type] = { total: 0, unread: 0 };
        }
        typeBreakdown[item.type].total++;
        if (!item.isRead) typeBreakdown[item.type].unread++;
      });

      stats[0].byPriority.forEach(item => {
        if (!priorityBreakdown[item.priority]) {
          priorityBreakdown[item.priority] = { total: 0, unread: 0 };
        }
        priorityBreakdown[item.priority].total++;
        if (!item.isRead) priorityBreakdown[item.priority].unread++;
      });
    }

    res.json({
      success: true,
      data: {
        overview: stats[0] || { total: 0, unread: 0 },
        typeBreakdown,
        priorityBreakdown
      }
    });
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching notification statistics',
      error: error.message
    });
  }
});

module.exports = router;
