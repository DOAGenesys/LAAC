import { verify } from 'jsonwebtoken';

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

// Read demo user credentials from environment variables
// Fallback to hardcoded values if environment variables are not set
const demoUserEmailFromEnv = process.env.DEMO_USER_EMAIL;
const demoUserPasswordFromEnv = process.env.DEMO_USER_PASSWORD;

if (!demoUserEmailFromEnv || !demoUserPasswordFromEnv) {
  console.warn('[userService] DEMO_USER_EMAIL or DEMO_USER_PASSWORD environment variables are not set. Falling back to hardcoded demo credentials. Please set them in your .env.local file for better security and configuration.');
}

// Demo users for the IdP
// In a real application, this would be stored in a database
const users: User[] = [
  {
    id: '1',
    email: demoUserEmailFromEnv || 'd_ondiviela@hotmail.com',
    name: 'Test User', // You can change this name if you like
    password: demoUserPasswordFromEnv || 'LRnaxMo2tc_FR@GkcSwDih', // This would be hashed in a real application
    role: 'user' // Assigning 'user' role by default, can be 'admin' if needed
  }
];

// JWT secret key (should be in environment variables in production)
const JWT_SECRET = process.env.JWT_SECRET || 'laac-saml-sso-secret-key';

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
    console.log(`[userService.authenticate] Attempting to authenticate user: ${email}`);
    const user = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    
    if (!user) {
      console.log(`[userService.authenticate] Authentication failed for user: ${email}. User not found or password mismatch.`);
      const foundUserByEmail = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (foundUserByEmail) {
        console.log(`[userService.authenticate] User with email ${email} found, but password did not match.`);
        console.log(`[userService.authenticate] Provided password: '${password}', Stored password: '${foundUserByEmail.password}'`);
      } else {
        console.log(`[userService.authenticate] No user found with email: ${email}`);
      }
      return null;
    }
    
    console.log(`[userService.authenticate] User ${email} authenticated successfully.`);
    // Return user without password
    const { password: _, ...safeUser } = user;
    return safeUser;
  },
  
  /**
   * Find a user by email
   */
  findByEmail: (email: string): SafeUser | null => {
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
      const decoded = verify(token, JWT_SECRET) as { email: string };
      return userService.findByEmail(decoded.email);
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  },
  
  /**
   * Get all users (for admin purposes)
   */
  getAllUsers: (): SafeUser[] => {
    return users.map(({ password: _, ...user }) => user);
  },
  
  /**
   * Add a new user (for admin purposes)
   */
  addUser: (user: Omit<User, 'id'>): SafeUser => {
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