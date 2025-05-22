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

// Demo users for the IdP
// In a real application, this would be stored in a database
const users: User[] = [
  {
    id: '1',
    email: 'd_ondiviela@hotmail.com',
    name: 'Test User', // You can change this name if you like
    password: 'H2wTXs!6j@7tq1Q0MLaXu7', // This would be hashed in a real application
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
    const user = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    
    if (!user) return null;
    
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