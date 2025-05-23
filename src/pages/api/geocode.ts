import type { NextApiRequest, NextApiResponse } from 'next';
import logger from '../../lib/logger';

interface GeocodeRequest {
  latitude: number;
  longitude: number;
}

interface GeocodeResponse {
  country: string;
  success: boolean;
  error?: string;
}

interface GeocodeApiResponse {
  address: {
    country: string;
    country_code: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GeocodeResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      country: 'UNKNOWN',
      error: 'Method not allowed' 
    });
  }

  const { latitude, longitude }: GeocodeRequest = req.body;

  if (!latitude || !longitude) {
    logger.warn('Geocode API: Missing latitude or longitude', { 
      latitude, 
      longitude 
    });
    return res.status(400).json({ 
      success: false, 
      country: 'UNKNOWN',
      error: 'Missing latitude or longitude' 
    });
  }

  const apiKey = process.env.GEOCODE_API_KEY;
  if (!apiKey) {
    logger.error('Geocode API: GEOCODE_API_KEY not configured');
    return res.status(500).json({ 
      success: false, 
      country: 'UNKNOWN',
      error: 'Geocoding service not configured' 
    });
  }

  try {
    logger.info('Geocode API: Making geocoding request', { 
      latitude, 
      longitude 
    });

    const response = await fetch(
      `https://geocode.maps.co/reverse?lat=${latitude}&lon=${longitude}&api_key=${apiKey}`
    );

    if (!response.ok) {
      logger.error('Geocode API: External API error', { 
        status: response.status,
        statusText: response.statusText 
      });
      return res.status(500).json({ 
        success: false, 
        country: 'UNKNOWN',
        error: `Geocoding API error: ${response.status}` 
      });
    }

    const data: GeocodeApiResponse = await response.json();
    const country = data.address?.country || 'UNKNOWN';
    
    logger.info('Geocode API: Successfully determined country', { 
      country,
      latitude,
      longitude 
    });

    return res.status(200).json({ 
      success: true, 
      country 
    });

  } catch (error) {
    logger.error('Geocode API: Error during geocoding', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      latitude,
      longitude 
    });

    return res.status(500).json({ 
      success: false, 
      country: 'UNKNOWN',
      error: 'Internal geocoding error' 
    });
  }
} 