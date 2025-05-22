import type { NextApiRequest, NextApiResponse } from 'next';
import { sign } from 'jsonwebtoken';
import cookie from 'cookie';
import { userService } from '@/lib/saml/userService';

// JWT secret key (should be in environment variables in production)
const JWT_SECRET = process.env.JWT_SECRET || 'laac-saml-sso-secret-key';

/**
 * Authentication API
 * 
 * Verifies user credentials and sets a session cookie upon successful authentication.
 * This is used by the login page to authenticate users before proceeding with SAML.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST method
  if (req.method !== 'POST') {
    console.log('[api/auth/verify] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  console.log('[api/auth/verify] Received authentication request.');
  try {
    const { email, password } = req.body;
    console.log('[api/auth/verify] Request body:', { email, password: password ? '******' : undefined });
    
    // Validate inputs
    if (!email || !password) {
      console.log('[api/auth/verify] Validation failed: Email or password missing.');
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    console.log(`[api/auth/verify] Authenticating user: ${email}`);
    // Authenticate user using the user service
    const user = userService.authenticate(email, password);
    
    if (!user) {
      console.log(`[api/auth/verify] Authentication failed for user: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    console.log(`[api/auth/verify] User ${email} authenticated successfully. Generating JWT.`);
    // Create a session token (JWT)
    const token = sign(
      { 
        email: user.email,
        name: user.name,
        id: user.id,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    console.log(`[api/auth/verify] JWT generated for user ${email}. Setting cookie.`);
    // Set the cookie
    res.setHeader(
      'Set-Cookie',
      cookie.serialize('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: 3600, // 1 hour
        path: '/',
      })
    );
    
    // Return success response with user info
    return res.status(200).json({ 
      success: true, 
      user 
    });
  } catch (error) {
    console.error('[api/auth/verify] Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
} 