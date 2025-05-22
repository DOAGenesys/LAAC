import type { NextApiRequest, NextApiResponse } from 'next';
import { userService } from '@/lib/saml/userService';
import { withAuth } from '@/lib/saml/authMiddleware';

/**
 * Admin Users API
 * 
 * Protected endpoint for fetching all users in the system.
 * Only accessible to authenticated admin users.
 */
async function handler(req: NextApiRequest, res: NextApiResponse, currentUser: any) {
  // Only support GET method for now
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get all users
    const users = userService.getAllUsers();
    
    // Return users and current user
    return res.status(200).json({
      users,
      currentUser
    });
  } catch (error) {
    console.error('Admin users API error:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
}

// Wrap the handler with authentication middleware that requires admin role
export default withAuth(handler, { adminOnly: true }); 