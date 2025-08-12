// Admin Routes

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const { getConversationState, setConversationState } = require('../models/ConversationState');
const { isAttendant } = require('../utils/attendants');
const { logAudit } = require('../utils/auditLogger');
const fs = require('fs');
const path = require('path');
const USERSTATES_DIR = path.join(__dirname, '../../userStates');

router.use(auth);

router.get('/users', adminController.listUsers);
router.get('/orders', adminController.listOrders);
router.get('/logs', adminController.getLogs);

// Listar todas as conversas e seus estados
router.get('/conversations', (req, res) => {
	const files = fs.readdirSync(USERSTATES_DIR).filter(f => f.endsWith('.json'));
	const conversations = files.map(f => {
		const number = f.replace('@c.us.json', '');
		const state = getConversationState(number);
		return { number, ...state };
	});
	res.json(conversations);
});

// Assumir conversa via dashboard
router.post('/conversations/:number/assumir', (req, res) => {
	const { number } = req.params;
	const { attendant } = req.body;
	if (!isAttendant(attendant)) return res.status(403).json({ error: 'Atendente não autorizado' });
	let state = getConversationState(number);
	if (state.mode === 'human' && state.attendant === attendant) {
		return res.json({ message: 'Já está atendendo esta conversa.' });
	}
	if (state.mode === 'human' && state.attendant && state.attendant !== attendant) {
		return res.status(409).json({ error: 'Já está sendo atendida por outro operador.' });
	}
	state.mode = 'human';
	state.attendant = attendant;
	setConversationState(number, state);
	logAudit('assumir', { conversation: number, attendant });
	res.json({ message: 'Conversa assumida com sucesso.' });
});

// Encerrar conversa via dashboard
router.post('/conversations/:number/encerrar', (req, res) => {
	const { number } = req.params;
	const { attendant } = req.body;
	let state = getConversationState(number);
	if (state.mode === 'human' && state.attendant === attendant) {
		state.mode = 'bot';
		logAudit('encerrar', { conversation: number, attendant });
		delete state.attendant;
		setConversationState(number, state);
		return res.json({ message: 'Atendimento encerrado.' });
	}
	return res.status(409).json({ error: 'Você não está atendendo esta conversa.' });
});

module.exports = router;
