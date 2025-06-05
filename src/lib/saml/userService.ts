import { verify } from 'jsonwebtoken';
import { logger } from './logger';

// Define user types
export interface User {
  id: string;
  email: string;
  name: string;
  password: string; // In a real application, this would be hashed
  role: string;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

// Function to get demo user credentials at runtime
const getDemoUserCredentials = () => {
  const demoUserEmailFromEnv = process.env.DEMO_USER_EMAIL;
  const demoUserPasswordFromEnv = process.env.DEMO_USER_PASSWORD;

  logger.debug('userService', `DEMO_USER_EMAIL: ${demoUserEmailFromEnv ? 'SET' : 'NOT SET'}`);
  logger.debug('userService', `DEMO_USER_PASSWORD: ${demoUserPasswordFromEnv ? 'SET' : 'NOT SET'}`);
  logger.debug('userService', `NODE_ENV: ${process.env.NODE_ENV}`);
  logger.debug('userService', `Runtime context: ${typeof window === 'undefined' ? 'SERVER' : 'CLIENT'}`);

  if (!demoUserEmailFromEnv || !demoUserPasswordFromEnv) {
    logger.warn('userService', 'DEMO_USER_EMAIL or DEMO_USER_PASSWORD environment variables are not set. Falling back to hardcoded demo credentials. Please set them in your .env.local file for better security and configuration.');
  }

  return {
    email: demoUserEmailFromEnv || 'a',
    password: demoUserPasswordFromEnv || 'b'
  };
};

// Function to get users array at runtime
const getUsers = (): User[] => {
  const { email, password } = getDemoUserCredentials();
  
  return [
    {
      id: '1',
      email: email,
      name: 'Test User',
      password: password,
      role: 'user'
    }
  ];
};

// JWT secret key (should be in environment variables in production)
const getJwtSecret = () => process.env.JWT_SECRET || 'laac-saml-sso-secret-key';

/**
 * User Service for the SAML Identity Provider
 * 
 * Provides methods for user authentication, validation, and management.
 */
export const userService = {
  /**
   * Find a user by email and password
   */
  authenticate: (email: string, password: string): SafeUser | null => {
    logger.debug('userService.authenticate', `Attempting to authenticate user: ${email}`);
    const users = getUsers(); // Get users at runtime
    const user = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    
    if (!user) {
      logger.debug('userService.authenticate', `Authentication failed for user: ${email}. User not found or password mismatch.`);
      const foundUserByEmail = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (foundUserByEmail) {
        logger.debug('userService.authenticate', `User with email ${email} found, but password did not match.`);
        logger.debug('userService.authenticate', `Provided password: '${password}', Stored password: '${foundUserByEmail.password}'`);
      } else {
        logger.debug('userService.authenticate', `No user found with email: ${email}`);
        logger.debug('userService.authenticate', `Available users: ${users.map(u => u.email).join(', ')}`);
      }
      return null;
    }
    
    logger.debug('userService.authenticate', `User ${email} authenticated successfully.`);
    // Return user without password
    const { password: _, ...safeUser } = user;
    return safeUser;
  },
  
  /**
   * Find a user by email
   */
  findByEmail: (email: string): SafeUser | null => {
    const users = getUsers(); // Get users at runtime
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) return null;
    
    // Return user without password
    const { password: _, ...safeUser } = user;
    return safeUser;
  },
  
  /**
   * Verify a JWT token and return the user
   */
  verifyToken: (token: string): SafeUser | null => {
    try {
      const JWT_SECRET = getJwtSecret();
      const decoded = verify(token, JWT_SECRET) as { email: string };
      return userService.findByEmail(decoded.email);
    } catch (error) {
      logger.error('userService', 'Token verification failed:', error);
      return null;
    }
  },
  
  /**
   * Get all users (for admin purposes)
   */
  getAllUsers: (): SafeUser[] => {
    const users = getUsers(); // Get users at runtime
    return users.map(({ password: _, ...user }) => user);
  },
  
  /**
   * Add a new user (for admin purposes)
   */
  addUser: (user: Omit<User, 'id'>): SafeUser => {
    const users = getUsers(); // Get users at runtime
    const newUser: User = {
      ...user,
      id: (users.length + 1).toString()
    };
    
    users.push(newUser);
    
    // Return user without password
    const { password: _, ...safeUser } = newUser;
    return safeUser;
  }
};

export default userService; 