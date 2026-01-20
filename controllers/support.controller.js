const supportService = require('../services/support.service');
const AppError = require('../utils/AppError');

/**
 * Support Controller
 */

/**
 * Create support ticket
 * POST /api/support/tickets
 */
exports.createTicket = async (req, res, next) => {
    try {
        const ticket = await supportService.createTicket(req.user._id, req.body);

        res.status(201).json({
            success: true,
            message: 'Support ticket created successfully',
            data: { ticket }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get user's tickets
 * GET /api/support/tickets
 */
exports.getTickets = async (req, res, next) => {
    try {
        const { status, category, limit, skip } = req.query;

        const tickets = await supportService.getUserTickets(req.user._id, {
            status,
            category,
            limit: parseInt(limit) || 50,
            skip: parseInt(skip) || 0
        });

        res.json({
            success: true,
            data: { tickets }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get ticket by ID
 * GET /api/support/tickets/:id
 */
exports.getTicketById = async (req, res, next) => {
    try {
        const ticket = await supportService.getTicketById(req.params.id, req.user._id);

        res.json({
            success: true,
            data: { ticket }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Add message to ticket
 * POST /api/support/tickets/:id/messages
 */
exports.addMessage = async (req, res, next) => {
    try {
        const { message } = req.body;

        if (!message || !message.trim()) {
            throw new AppError('Message is required', 400);
        }

        const ticket = await supportService.addMessage(req.params.id, req.user._id, message);

        res.json({
            success: true,
            message: 'Message added successfully',
            data: { ticket }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Close ticket
 * PATCH /api/support/tickets/:id/close
 */
exports.closeTicket = async (req, res, next) => {
    try {
        const ticket = await supportService.closeTicket(req.params.id, req.user._id);

        res.json({
            success: true,
            message: 'Ticket closed successfully',
            data: { ticket }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get ticket statistics
 * GET /api/support/stats
 */
exports.getStats = async (req, res, next) => {
    try {
        const stats = await supportService.getTicketStats(req.user._id);

        res.json({
            success: true,
            data: { stats }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get support categories
 * GET /api/support/categories
 */
exports.getCategories = async (req, res, next) => {
    try {
        const categories = supportService.getCategories();

        res.json({
            success: true,
            data: { categories }
        });
    } catch (error) {
        next(error);
    }
};
