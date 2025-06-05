import type { NextApiRequest, NextApiResponse } from 'next';
import { getClientCredentialsToken } from '../../lib/oauthService';
import type { DivisionSwitchResponse } from '../../types/genesys';
import logger from '../../lib/logger';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DivisionSwitchResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    logger.warn('Method not allowed', { method: req.method });
    return res.status(405).json({ updated: false });
  }

  try {
    // Extract request data
    const { userId, country, currentDivisionId } = req.body;

    // Validate request data
    if (!userId) {
      logger.error('Missing userId in request body');
      return res.status(400).json({ updated: false });
    }

    logger.info('Processing division switch request', { 
      userId, 
      country, 
      currentDivisionId 
    });

    // Determine target division based on country
    const isCompliant = country === process.env.NEXT_PUBLIC_LAAC_COMPLIANT_COUNTRY;
    const targetDivisionId = isCompliant 
      ? process.env.LAAC_COMPLIANT_DIVISION_ID 
      : process.env.LAAC_NON_COMPLIANT_DIVISION_ID;

    // If division IDs are not set, return error
    if (!targetDivisionId) {
      logger.error('Missing division IDs in environment variables');
      return res.status(500).json({ updated: false });
    }

    if (!process.env.GC_ROLE_ID) {
      logger.error('Missing GC_ROLE_ID in environment variables');
      return res.status(500).json({ updated: false });
    }

    // If user is already in the correct division, skip the update
    if (currentDivisionId === targetDivisionId) {
      logger.info('User already in correct division', { 
        userId, 
        targetDivisionId 
      });

      // Emit metric for tracking
      logger.emitMetric({
        name: 'division_switch_skipped',
        tags: {
          country,
          isCompliant
        }
      });

      return res.status(200).json({ updated: false });
    }

    // Get access token using client credentials
    const accessToken = await getClientCredentialsToken();

    // Call Genesys Cloud API to assign the user to the target division
    logger.info('Calling Genesys API to update division', { 
      userId, 
      targetDivisionId 
    });

    const divisionResponse = await fetch(
      `https://api.${process.env.NEXT_PUBLIC_GC_REGION}/api/v2/authorization/divisions/${targetDivisionId}/objects/USER`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify([userId])
      }
    );

    if (!divisionResponse.ok) {
      const errorText = await divisionResponse.text();
      logger.error('Error updating division', { 
        status: divisionResponse.status, 
        error: errorText,
        userId,
        targetDivisionId
      });
      
      // Emit failure metric
      logger.emitMetric({
        name: 'division_switch_failed',
        tags: {
          country,
          isCompliant,
          status: divisionResponse.status
        }
      });
      
      return res.status(500).json({ updated: false });
    }

    logger.info('Successfully assigned user to division', { 
      userId, 
      targetDivisionId 
    });
    
    // Call Genesys Cloud API to update role division assignment
    logger.info('Calling Genesys API to update role division assignment', { 
      userId, 
      targetDivisionId,
      roleId: process.env.GC_ROLE_ID
    });

    const roleResponse = await fetch(
      `https://api.${process.env.NEXT_PUBLIC_GC_REGION}/api/v2/authorization/roles/${process.env.GC_ROLE_ID}?subjectType=PC_USER`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          subjectIds: [userId],
          divisionIds: [targetDivisionId]
        })
      }
    );

    if (!roleResponse.ok) {
      const errorText = await roleResponse.text();
      logger.error('Error updating role division assignment', { 
        status: roleResponse.status, 
        error: errorText,
        userId,
        targetDivisionId,
        roleId: process.env.GC_ROLE_ID
      });
      
      logger.emitMetric({
        name: 'role_division_assignment_failed',
        tags: {
          country,
          isCompliant,
          status: roleResponse.status
        }
      });
      
      return res.status(500).json({ updated: false });
    }

    logger.info('Successfully assigned role division to user', { 
      userId, 
      targetDivisionId,
      roleId: process.env.GC_ROLE_ID
    });
    
    // Emit success metric
    logger.emitMetric({
      name: 'division_switch_applied',
      tags: {
        country,
        isCompliant
      }
    });

    logger.emitMetric({
      name: 'role_division_assignment_applied',
      tags: {
        country,
        isCompliant
      }
    });

    return res.status(200).json({ updated: true });
  } catch (error) {
    logger.error('Error in division-switch API', { 
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Emit error metric
    logger.emitMetric({
      name: 'division_switch_error'
    });
    
    return res.status(500).json({ updated: false });
  }
} 
