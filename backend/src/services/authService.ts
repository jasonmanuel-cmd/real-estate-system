import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import prisma from '../config/database';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const MFA_ISSUER = process.env.MFA_ISSUER || 'CA Deal Engine';

interface JwtPayload {
  userId: string;
  email: string;
  mfaVerified: boolean;
}

export class AuthService {
  /**
   * Register a new user (for MVP, this might be admin-only)
   */
  async register(email: string, password: string, name: string) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('User already exists');
    }

    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
    });

    logger.info(`New user registered: ${email}`);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  /**
   * Login - returns JWT token
   * If MFA is enabled, returns temporary token that requires MFA verification
   */
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'login',
        resource: 'auth',
        metadata: JSON.stringify({ email }), // Store as JSON string for SQLite
      },
    });

    // If MFA is enabled, return temporary token
    if (user.mfaEnabled) {
      const tempToken = this.generateToken({
        userId: user.id,
        email: user.email,
        mfaVerified: false,
      }, '10m'); // 10 minute expiry for MFA verification

      logger.info(`User ${email} logged in (MFA required)`);

      return {
        requiresMfa: true,
        tempToken,
      };
    }

    // No MFA - issue full token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      mfaVerified: true,
    });

    logger.info(`User ${email} logged in`);

    return {
      requiresMfa: false,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  /**
   * Setup MFA for a user
   */
  async setupMfa(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `${MFA_ISSUER} (${user.email})`,
      issuer: MFA_ISSUER,
    });

    // Store the secret (temporarily, until verified)
    await prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret.base32 },
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    logger.info(`MFA setup initiated for user ${user.email}`);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
    };
  }

  /**
   * Verify and enable MFA
   */
  async verifyAndEnableMfa(userId: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaSecret) {
      throw new Error('MFA not set up');
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time windows for clock drift
    });

    if (!verified) {
      throw new Error('Invalid MFA token');
    }

    // Enable MFA
    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    logger.info(`MFA enabled for user ${user.email}`);

    return { success: true };
  }

  /**
   * Verify MFA token during login
   */
  async verifyMfaLogin(tempToken: string, mfaToken: string) {
    const payload = this.verifyToken(tempToken) as JwtPayload;

    if (payload.mfaVerified) {
      throw new Error('MFA already verified');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new Error('Invalid MFA configuration');
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: mfaToken,
      window: 2,
    });

    if (!verified) {
      throw new Error('Invalid MFA token');
    }

    // Issue full token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      mfaVerified: true,
    });

    logger.info(`MFA verified for user ${user.email}`);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  /**
   * Disable MFA
   */
  async disableMfa(userId: string, password: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    logger.info(`MFA disabled for user ${user.email}`);

    return { success: true };
  }

  /**
   * Generate JWT token
   */
  private generateToken(payload: JwtPayload, expiresIn?: string): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: expiresIn || JWT_EXPIRES_IN,
    });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): string | jwt.JwtPayload {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user from token
   */
  async getUserFromToken(token: string) {
    const payload = this.verifyToken(token) as JwtPayload;

    if (!payload.mfaVerified) {
      throw new Error('MFA verification required');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        mfaEnabled: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Log audit event
   */
  async logAudit(
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: any
  ) {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        ipAddress,
        userAgent,
        metadata: metadata || {},
      },
    });
  }
}

export const authService = new AuthService();
