const express = require('express');
const router = express.Router();
const supportController = require('../controllers/support.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

// Get support categories
router.get('/categories', supportController.getCategories);

// Get ticket statistics
router.get('/stats', supportController.getStats);

// Create support ticket
router.post('/tickets', supportController.createTicket);

// Get user's tickets
router.get('/tickets', supportController.getTickets);

// Get ticket by ID
router.get('/tickets/:id', supportController.getTicketById);

// Add message to ticket
router.post('/tickets/:id/messages', supportController.addMessage);

// Close ticket
router.patch('/tickets/:id/close', supportController.closeTicket);

module.exports = router;
