const Warehouse = require('../models/Warehouse.model');
const AppError = require('../utils/AppError');

/**
 * @desc Get all warehouses for current user
 * @route GET /api/warehouses
 */
exports.getWarehouses = async (req, res, next) => {
  try {
    const warehouses = await Warehouse.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: { warehouses }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Create a new warehouse
 * @route POST /api/warehouses
 */
exports.createWarehouse = async (req, res, next) => {
  try {
    const warehouseData = {
      ...req.body,
      user: req.user._id
    };

    // If this is the first warehouse, make it default
    const count = await Warehouse.countDocuments({ user: req.user._id });
    if (count === 0) {
      warehouseData.isDefault = true;
    }

    // If this one is set as default, unset others
    if (req.body.isDefault) {
      await Warehouse.updateMany({ user: req.user._id }, { isDefault: false });
    }

    const warehouse = await Warehouse.create(warehouseData);

    res.status(201).json({
      success: true,
      data: { warehouse }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update a warehouse
 * @route PUT /api/warehouses/:id
 */
exports.updateWarehouse = async (req, res, next) => {
  try {
    let warehouse = await Warehouse.findOne({ _id: req.params.id, user: req.user._id });

    if (!warehouse) {
      return next(new AppError('Warehouse not found', 404));
    }

    // If setting as default, unset others
    if (req.body.isDefault && !warehouse.isDefault) {
      await Warehouse.updateMany({ user: req.user._id }, { isDefault: false });
    }

    warehouse = await Warehouse.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: { warehouse }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Delete a warehouse
 * @route DELETE /api/warehouses/:id
 */
exports.deleteWarehouse = async (req, res, next) => {
  try {
    const warehouse = await Warehouse.findOne({ _id: req.params.id, user: req.user._id });

    if (!warehouse) {
      return next(new AppError('Warehouse not found', 404));
    }

    await warehouse.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Warehouse deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
