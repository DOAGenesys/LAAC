import { NextApiRequest, NextApiResponse } from 'next';
import cookie from 'cookie';
import { userService } from './userService';

/**
 * Type definition for the next handler function
 */
export type NextApiHandler = (
  req: NextApiRequest, 
  res: NextApiResponse,
  user?: any
) => void | Promise<void>;

/**
 * Authentication middleware for Next.js API routes
 * 
 * This middleware verifies that the user is authenticated via JWT token
 * before allowing access to protected API endpoints.
 * 
 * @param handler The API route handler function
 * @param options Configuration options
 * @returns A wrapped handler function with authentication
 */
export function withAuth(
  handler: NextApiHandler,
  options: { 
    adminOnly?: boolean;
  } = {}
) {
  return async function(req: NextApiRequest, res: NextApiResponse) {
    try {
      // Extract auth token from cookies
      const cookies = req.headers.cookie 
        ? cookie.parse(req.headers.cookie) 
        : {};
      
      const token = cookies.auth_token;
      
      // If no token is present, return unauthorized
      if (!token) {
        return res.status(401).json({ 
          error: 'Authentication required' 
        });
      }
      
      // Verify the token and get the user
      const user = userService.verifyToken(token);
      
      // If token is invalid or user not found
      if (!user) {
        return res.status(401).json({ 
          error: 'Invalid or expired session' 
        });
      }
      
      // If admin-only route and user is not an admin
      if (options.adminOnly && user.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Access denied. Admin privileges required.' 
        });
      }
      
      // Call the original handler with the authenticated user
      return handler(req, res, user);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({ 
        error: 'Authentication failed' 
      });
    }
  };
} 