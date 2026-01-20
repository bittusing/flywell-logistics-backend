const SupportTicket = require('../models/SupportTicket.model');
const Order = require('../models/Order.model');
const AppError = require('../utils/AppError');

/**
 * Support Service - Handles support tickets
 */
class SupportService {
    /**
     * Create a new support ticket
     * @param {String} userId - User ID
     * @param {Object} ticketData - Ticket data
     * @returns {Object} Created ticket
     */
    async createTicket(userId, ticketData) {
        const { subject, category, priority, description, relatedOrderId, relatedAWB, attachments } = ticketData;

        // Map frontend category names to backend enum values
        const categoryMap = {
            'Reattempt or Delay in delivery / consignee pickup / return': 'delivery',
            'Firstmile / Seller Pickup related issues': 'pickup',
            'Shipment not delivered (need POD) / Fake remark': 'delivery',
            'Self collect / drop': 'pickup',
            'Damage / Missing / Mismatch': 'order_issue',
            'Updated shipment details': 'order_issue',
            'Cancel delivery / pickup': 'order_issue',
            'Claims / Finance (disputes, remittance, bank details, etc.)': 'payment',
            'Protect VAS': 'other',
            'Channel Integration': 'technical',
            'Behaviour complaint against staff': 'other',
            'Tech Support': 'technical',
            'Account': 'other'
        };

        const mappedCategory = categoryMap[category] || category || 'other';

        // Validate related order if provided
        let relatedOrder = null;
        if (relatedOrderId) {
            // Try to find order by orderNumber first, then by _id
            const order = await Order.findOne({ 
                $or: [
                    { orderNumber: relatedOrderId },
                    { _id: relatedOrderId }
                ],
                user: userId 
            }).catch(() => null);
            
            if (order) {
                relatedOrder = order._id;
            }
        }

        // Create ticket
        const ticket = await SupportTicket.create({
            user: userId,
            subject,
            category: mappedCategory,
            priority: priority || 'medium',
            description,
            relatedOrder,
            relatedAWB: relatedAWB || relatedOrderId || null, // Store the order number/AWB in relatedAWB field
            attachments: attachments || [],
            messages: [{
                sender: 'user',
                message: description,
                timestamp: new Date()
            }]
        });

        return ticket;
    }

    /**
     * Get user's support tickets
     * @param {String} userId - User ID
     * @param {Object} filters - Filter options
     * @returns {Array} Tickets list
     */
    async getUserTickets(userId, filters = {}) {
        const query = { user: userId };

        if (filters.status) {
            query.status = filters.status;
        }

        if (filters.category) {
            query.category = filters.category;
        }

        const tickets = await SupportTicket.find(query)
            .sort({ createdAt: -1 })
            .limit(filters.limit || 50)
            .skip(filters.skip || 0)
            .populate('relatedOrder', 'orderNumber awb status')
            .select('-messages');

        return tickets;
    }

    /**
     * Get ticket by ID
     * @param {String} ticketId - Ticket ID
     * @param {String} userId - User ID (for authorization)
     * @returns {Object} Ticket details
     */
    async getTicketById(ticketId, userId) {
        const ticket = await SupportTicket.findOne({
            _id: ticketId,
            user: userId
        }).populate('relatedOrder', 'orderNumber awb status deliveryPartner');

        if (!ticket) {
            throw new AppError('Ticket not found', 404);
        }

        return ticket;
    }

    /**
     * Add message to ticket
     * @param {String} ticketId - Ticket ID
     * @param {String} userId - User ID
     * @param {String} message - Message content
     * @returns {Object} Updated ticket
     */
    async addMessage(ticketId, userId, message) {
        const ticket = await SupportTicket.findOne({
            _id: ticketId,
            user: userId
        });

        if (!ticket) {
            throw new AppError('Ticket not found', 404);
        }

        if (ticket.status === 'closed') {
            throw new AppError('Cannot add message to closed ticket', 400);
        }

        ticket.messages.push({
            sender: 'user',
            message,
            timestamp: new Date()
        });

        // Reopen if resolved
        if (ticket.status === 'resolved') {
            ticket.status = 'open';
        }

        await ticket.save();

        return ticket;
    }

    /**
     * Close ticket
     * @param {String} ticketId - Ticket ID
     * @param {String} userId - User ID
     * @returns {Object} Updated ticket
     */
    async closeTicket(ticketId, userId) {
        const ticket = await SupportTicket.findOne({
            _id: ticketId,
            user: userId
        });

        if (!ticket) {
            throw new AppError('Ticket not found', 404);
        }

        ticket.status = 'closed';
        await ticket.save();

        return ticket;
    }

    /**
     * Get ticket statistics for user
     * @param {String} userId - User ID
     * @returns {Object} Ticket stats
     */
    async getTicketStats(userId) {
        const [open, inProgress, resolved, closed] = await Promise.all([
            SupportTicket.countDocuments({ user: userId, status: 'open' }),
            SupportTicket.countDocuments({ user: userId, status: 'in_progress' }),
            SupportTicket.countDocuments({ user: userId, status: 'resolved' }),
            SupportTicket.countDocuments({ user: userId, status: 'closed' })
        ]);

        return {
            total: open + inProgress + resolved + closed,
            open,
            inProgress,
            resolved,
            closed
        };
    }

    /**
     * Get support categories
     * @returns {Array} Categories
     */
    getCategories() {
        return [
            { value: 'order_issue', label: 'Order Issue' },
            { value: 'payment', label: 'Payment Problem' },
            { value: 'tracking', label: 'Tracking Issue' },
            { value: 'refund', label: 'Refund Request' },
            { value: 'technical', label: 'Technical Issue' },
            { value: 'pickup', label: 'Pickup Problem' },
            { value: 'delivery', label: 'Delivery Issue' },
            { value: 'other', label: 'Other' }
        ];
    }
}

module.exports = new SupportService();
