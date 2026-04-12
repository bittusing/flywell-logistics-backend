const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoice.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/invoices
 * @desc    Get user invoices
 * @access  Private
 */
router.get('/', invoiceController.getInvoices.bind(invoiceController));

/**
 * @route   GET /api/invoices/:id
 * @desc    Get invoice by ID
 * @access  Private
 */
router.get('/:id', invoiceController.getInvoiceById.bind(invoiceController));

/**
 * @route   GET /api/invoices/:id/download
 * @desc    Download invoice PDF
 * @access  Private
 */
router.get('/:id/download', invoiceController.downloadInvoice.bind(invoiceController));

module.exports = router;
