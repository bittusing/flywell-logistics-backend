const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ticketNumber: {
        type: String,
        unique: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['order_issue', 'payment', 'tracking', 'refund', 'technical', 'pickup', 'delivery', 'other'],
        default: 'other'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['open', 'in_progress', 'resolved', 'closed'],
        default: 'open'
    },
    description: {
        type: String,
        required: true
    },
    // Related order (optional)
    relatedOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    },
    relatedAWB: {
        type: String,
        default: null
    },
    // Attachments (URLs)
    attachments: [{
        url: { type: String },
        filename: { type: String },
        uploadedAt: { type: Date, default: Date.now }
    }],
    // Conversation thread
    messages: [{
        sender: {
            type: String,
            enum: ['user', 'support'],
            required: true
        },
        senderName: { type: String },
        message: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
    }],
    // Resolution
    resolution: {
        resolvedAt: { type: Date, default: null },
        resolvedBy: { type: String, default: null },
        resolutionNotes: { type: String, default: '' }
    }
}, {
    timestamps: true
});

// Generate ticket number before saving
supportTicketSchema.pre('save', async function (next) {
    if (!this.ticketNumber) {
        const timestamp = Date.now();
        const count = await mongoose.model('SupportTicket').countDocuments();
        this.ticketNumber = `TKT${timestamp}${String(count + 1).padStart(4, '0')}`;
    }
    next();
});

// Indexes
supportTicketSchema.index({ user: 1, createdAt: -1 });
supportTicketSchema.index({ ticketNumber: 1 });
supportTicketSchema.index({ status: 1 });

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

module.exports = SupportTicket;
