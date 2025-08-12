// API Routes
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

const messageController = require('../controllers/messageController');
const catalogController = require('../controllers/catalogController');
const orderController = require('../controllers/orderController');

const feedbackRoutes = require('./feedbackRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const exportRoutes = require('./exportRoutes');
const personalizationRoutes = require('./personalizationRoutes');
const topicRoutes = require('./topicRoutes');
const userContextRoutes = require('./userContextRoutes');
const providerConfigRoutes = require('./providerConfigRoutes');
const uploadRoutes = require('./uploadRoutes');
const queueMetricsRoutes = require('./queueMetricsRoutes');
const reportRoutes = require('./reportRoutes');
const alertConfigRoutes = require('./alertConfigRoutes');
const { validateOrder, validateMessage } = require('../middleware/validatePayload');
const humanQueueRoutes = require('./humanQueueRoutes');

router.use(rateLimit);


router.get('/catalog', catalogController.getCatalog);
router.post('/order', auth, validateOrder, orderController.create);
router.get('/order/:id', auth, orderController.getOrderById);
router.get('/orders', auth, orderController.list);

router.post('/message', validateMessage, messageController.receive);
router.use(feedbackRoutes);
router.use(analyticsRoutes);
router.use(exportRoutes);
router.use(personalizationRoutes);
router.use(topicRoutes);
router.use(userContextRoutes);
router.use(providerConfigRoutes);
router.use(uploadRoutes);
router.use(queueMetricsRoutes);
router.use(reportRoutes);
router.use(alertConfigRoutes);
router.use(humanQueueRoutes);

module.exports = router;
