import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/mfa/login', authController.verifyMfaLogin.bind(authController));

// Protected routes (require authentication)
router.get('/me', authenticate, authController.getCurrentUser.bind(authController));
router.post('/mfa/setup', authenticate, authController.setupMfa.bind(authController));
router.post('/mfa/verify', authenticate, authController.verifyMfa.bind(authController));
router.post('/mfa/disable', authenticate, authController.disableMfa.bind(authController));

export default router;
