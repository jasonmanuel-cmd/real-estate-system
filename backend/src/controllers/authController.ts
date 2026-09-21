import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth';

export class AuthController {
  /**
   * POST /api/auth/register
   */
  async register(req: Request, res: Response) {
    try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({
          error: 'Email, password, and name are required',
        });
      }

      const user = await authService.register(email, password, name);

      res.status(201).json({
        message: 'User registered successfully',
        user,
      });
    } catch (error: any) {
      logger.error('Registration error:', error);
      res.status(400).json({
        error: error.message || 'Registration failed',
      });
    }
  }

  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required',
        });
      }

      const result = await authService.login(email, password);

      res.json(result);
    } catch (error: any) {
      logger.error('Login error:', error);
      res.status(401).json({
        error: error.message || 'Login failed',
      });
    }
  }

  /**
   * POST /api/auth/mfa/setup
   */
  async setupMfa(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const result = await authService.setupMfa(req.user.id);

      res.json(result);
    } catch (error: any) {
      logger.error('MFA setup error:', error);
      res.status(400).json({
        error: error.message || 'MFA setup failed',
      });
    }
  }

  /**
   * POST /api/auth/mfa/verify
   */
  async verifyMfa(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: 'MFA token is required' });
      }

      const result = await authService.verifyAndEnableMfa(req.user.id, token);

      res.json(result);
    } catch (error: any) {
      logger.error('MFA verification error:', error);
      res.status(400).json({
        error: error.message || 'MFA verification failed',
      });
    }
  }

  /**
   * POST /api/auth/mfa/login
   */
  async verifyMfaLogin(req: Request, res: Response) {
    try {
      const { tempToken, mfaToken } = req.body;

      if (!tempToken || !mfaToken) {
        return res.status(400).json({
          error: 'Temp token and MFA token are required',
        });
      }

      const result = await authService.verifyMfaLogin(tempToken, mfaToken);

      res.json(result);
    } catch (error: any) {
      logger.error('MFA login verification error:', error);
      res.status(401).json({
        error: error.message || 'MFA verification failed',
      });
    }
  }

  /**
   * POST /api/auth/mfa/disable
   */
  async disableMfa(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ error: 'Password is required' });
      }

      const result = await authService.disableMfa(req.user.id, password);

      res.json(result);
    } catch (error: any) {
      logger.error('MFA disable error:', error);
      res.status(400).json({
        error: error.message || 'Failed to disable MFA',
      });
    }
  }

  /**
   * GET /api/auth/me
   */
  async getCurrentUser(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      res.json({ user: req.user });
    } catch (error: any) {
      logger.error('Get current user error:', error);
      res.status(500).json({
        error: 'Failed to get user info',
      });
    }
  }
}

export const authController = new AuthController();
