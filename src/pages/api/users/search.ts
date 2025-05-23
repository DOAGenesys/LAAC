import type { NextApiRequest, NextApiResponse } from 'next';
import { getClientCredentialsToken } from '../../../lib/oauthService';
import logger from '../../../lib/logger';

interface UserSearchRequest {
  email: string;
}

interface UserSearchResponse {
  userId: string;
  currentDivisionId: string;
}

interface GenesysUserSearchResponse {
  total: number;
  results: Array<{
    id: string;
    name: string;
    division: {
      id: string;
      name: string;
      selfUri: string;
    };
    email?: string;
  }>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UserSearchResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    logger.warn('Method not allowed', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email }: UserSearchRequest = req.body;

    if (!email) {
      logger.error('Missing email in request body');
      return res.status(400).json({ error: 'Email is required' });
    }

    logger.info('Processing user search request', { email });

    const accessToken = await getClientCredentialsToken();

    const searchPayload = {
      pageSize: 25,
      pageNumber: 1,
      query: [{
        type: "TERM",
        fields: ["email"],
        value: email.split('@')[0]
      }]
    };

    logger.info('Calling Genesys API to search for user', { email, searchTerm: email.split('@')[0] });

    const apiResponse = await fetch(
      `https://api.${process.env.NEXT_PUBLIC_GC_REGION}/api/v2/users/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(searchPayload)
      }
    );

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      logger.error('Error searching for user', { 
        status: apiResponse.status, 
        error: errorText,
        email
      });
      
      return res.status(500).json({ error: 'Failed to search for user in Genesys Cloud' });
    }

    const searchResults: GenesysUserSearchResponse = await apiResponse.json();

    if (searchResults.total === 0 || !searchResults.results.length) {
      logger.warn('User not found in search results', { email });
      return res.status(404).json({ error: 'User not found in Genesys Cloud' });
    }

    const user = searchResults.results.find(result => 
      result.email && result.email.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      logger.warn('No exact email match found in search results', { 
        email, 
        foundEmails: searchResults.results.map(r => r.email).filter(Boolean).join(', ')
      });
      return res.status(404).json({ error: 'User not found in Genesys Cloud' });
    }

    if (!user.division?.id) {
      logger.error('User found but missing division information', { userId: user.id, email });
      return res.status(500).json({ error: 'User division information is missing' });
    }

    const response: UserSearchResponse = {
      userId: user.id,
      currentDivisionId: user.division.id
    };

    logger.info('Successfully found user', { 
      userId: user.id,
      currentDivisionId: user.division.id,
      email
    });

    return res.status(200).json(response);

  } catch (error) {
    logger.error('Error in user search API', { 
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({ error: 'Internal server error' });
  }
} 