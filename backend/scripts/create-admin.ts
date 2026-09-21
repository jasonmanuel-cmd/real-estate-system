#!/usr/bin/env ts-node
/**
 * Create an admin user
 * Usage: ts-node scripts/create-admin.ts --email user@example.com --password YourPassword --name "Your Name"
 */

import dotenv from 'dotenv';
import { authService } from '../src/services/authService';
import { logger } from '../src/utils/logger';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);

  const getArg = (name: string): string | undefined => {
    const index = args.indexOf(`--${name}`);
    return index !== -1 ? args[index + 1] : undefined;
  };

  const email = getArg('email');
  const password = getArg('password');
  const name = getArg('name');

  if (!email || !password || !name) {
    console.error('Usage: ts-node scripts/create-admin.ts --email EMAIL --password PASSWORD --name NAME');
    process.exit(1);
  }

  try {
    const user = await authService.register(email, password, name);
    logger.info('Admin user created successfully:', user);
    console.log('\n✅ Admin user created successfully!');
    console.log(`Email: ${user.email}`);
    console.log(`Name: ${user.name}`);
    console.log('\nYou can now login with these credentials.');
    console.log('To enable MFA, log in and go to Settings → Security.');
    process.exit(0);
  } catch (error: any) {
    logger.error('Failed to create admin user:', error);
    console.error('\n❌ Failed to create admin user:', error.message);
    process.exit(1);
  }
}

main();
