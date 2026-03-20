import { Router } from 'express';
import { signup, login, getMe } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.post('/login', login);
router.post('/signup', signup);
router.get('/me', protect, getMe);

console.log('✅ authRoutes loaded, routes:', router.stack.map(r => r.route?.path));

export default router;