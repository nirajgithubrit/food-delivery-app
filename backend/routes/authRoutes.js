const express = require('express');
const router = express.Router();

const {
  customerLogin,
  adminLogin,
  deliveryLogin,
  logout,
  getMe
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/customer', customerLogin);
router.post('/admin', adminLogin);
router.post('/delivery', deliveryLogin);
router.post('/logout', logout);
router.get('/me', protect, getMe)

module.exports = router;