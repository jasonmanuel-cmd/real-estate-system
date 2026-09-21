import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * Middleware to authenticate requests using JWT
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No token provided',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const user = await authService.getUserFromToken(token);
    req.user = user;

    next();
  } catch (error) {
    logger.error('Authentication failed:', error);
    return res.status(401).json({
      error: 'Invalid or expired token',
    });
  }
};

/**
 * Audit middleware to log important actions
 */
export const auditAction = (action: string, resource: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user) {
        await authService.logAudit(
          req.user.id,
          action,
          resource,
          req.params.id || undefined,
          req.ip,
          req.headers['user-agent']
        );
      }
      next();
    } catch (error) {
      logger.error('Audit logging failed:', error);
      next(); // Don't block request if audit fails
    }
  };
};
