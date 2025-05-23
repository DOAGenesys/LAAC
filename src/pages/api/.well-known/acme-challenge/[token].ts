import { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import fs from 'fs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Invalid token' });
  }

  try {
    // First, try to get the challenge response from environment variables
    // This allows for manual configuration during certificate generation
    const envKey = `ACME_CHALLENGE_${token.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
    const challengeResponse = process.env[envKey];

    if (challengeResponse) {
      console.log('[acme-challenge] Serving challenge response from environment variable:', envKey);
      return res.status(200).send(challengeResponse);
    }

    // Second, try to read from a temporary file in the temp directory
    // This is useful for automated tools that can write challenge files
    const tempDir = path.join(process.cwd(), 'temp', '.well-known', 'acme-challenge');
    const challengeFile = path.join(tempDir, token);

    if (fs.existsSync(challengeFile)) {
      const fileContent = fs.readFileSync(challengeFile, 'utf8');
      console.log('[acme-challenge] Serving challenge response from file:', challengeFile);
      return res.status(200).send(fileContent);
    }

    // Third, try to read from public directory (for static hosting scenarios)
    const publicChallengeFile = path.join(process.cwd(), 'public', '.well-known', 'acme-challenge', token);
    
    if (fs.existsSync(publicChallengeFile)) {
      const fileContent = fs.readFileSync(publicChallengeFile, 'utf8');
      console.log('[acme-challenge] Serving challenge response from public file:', publicChallengeFile);
      return res.status(200).send(fileContent);
    }

    console.log('[acme-challenge] No challenge response found for token:', token);
    console.log('[acme-challenge] Checked environment variable:', envKey);
    console.log('[acme-challenge] Checked temp file:', challengeFile);
    console.log('[acme-challenge] Checked public file:', publicChallengeFile);

    return res.status(404).json({ error: 'Challenge not found' });
  } catch (error) {
    console.error('[acme-challenge] Error serving challenge:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 