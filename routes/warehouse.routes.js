const express = require('express');
const warehouseController = require('../controllers/warehouse.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// All warehouse routes require authentication
router.use(protect);

router.get('/', warehouseController.getWarehouses);
router.post('/', warehouseController.createWarehouse);
router.put('/:id', warehouseController.updateWarehouse);
router.delete('/:id', warehouseController.deleteWarehouse);

module.exports = router;
