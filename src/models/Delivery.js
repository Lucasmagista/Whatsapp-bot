const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Delivery = sequelize.define('Delivery', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  address: {
    type: DataTypes.JSON,
    allowNull: false
  },
  scheduledDate: {
    type: DataTypes.DATE
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'scheduled'
  },
  deliveredAt: {
    type: DataTypes.DATE
  }
});

module.exports = Delivery;
