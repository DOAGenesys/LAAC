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
    logger.info('Calling Genesys API to add role division assignment', { 
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
      logger.error('Error adding role division assignment', { 
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

    logger.info('Successfully added role division assignment', { 
      userId, 
      targetDivisionId,
      roleId: process.env.GC_ROLE_ID
    });
    
    // Call Genesys Cloud API to get current role assignments
    logger.info('Calling Genesys API to get current role assignments', { 
      userId,
      roleId: process.env.GC_ROLE_ID
    });

    const subjectResponse = await fetch(
      `https://api.${process.env.NEXT_PUBLIC_GC_REGION}/api/v2/authorization/subjects/${userId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!subjectResponse.ok) {
      const errorText = await subjectResponse.text();
      logger.error('Error getting current role assignments', { 
        status: subjectResponse.status, 
        error: errorText,
        userId,
        roleId: process.env.GC_ROLE_ID
      });
      
      logger.emitMetric({
        name: 'role_assignments_fetch_failed',
        tags: {
          country,
          isCompliant,
          status: subjectResponse.status
        }
      });
      
      return res.status(500).json({ updated: false });
    }

    const subjectData = await subjectResponse.json();
    const grants = subjectData.grants || [];
    
    const grantsToRemove = grants
      .filter((grant: any) => 
        grant.role?.id === process.env.GC_ROLE_ID && 
        grant.division?.id !== targetDivisionId
      )
      .map((grant: any) => ({
        roleId: grant.role.id,
        divisionId: grant.division.id
      }));

    logger.info('Found role assignments to remove', { 
      userId,
      roleId: process.env.GC_ROLE_ID,
      totalGrants: grants.length,
      grantsToRemove: grantsToRemove.length,
      targetDivisionId
    });

    if (grantsToRemove.length > 0) {
      logger.info('Calling Genesys API to remove old role division assignments', { 
        userId,
        roleId: process.env.GC_ROLE_ID,
        grantsToRemove
      });

      const bulkRemoveResponse = await fetch(
        `https://api.${process.env.NEXT_PUBLIC_GC_REGION}/api/v2/authorization/subjects/${userId}/bulkremove`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            grants: grantsToRemove
          })
        }
      );

      if (!bulkRemoveResponse.ok) {
        const errorText = await bulkRemoveResponse.text();
        logger.error('Error removing old role division assignments', { 
          status: bulkRemoveResponse.status, 
          error: errorText,
          userId,
          roleId: process.env.GC_ROLE_ID,
          grantsToRemove
        });
        
        logger.emitMetric({
          name: 'role_assignments_removal_failed',
          tags: {
            country,
            isCompliant,
            status: bulkRemoveResponse.status
          }
        });
        
        return res.status(500).json({ updated: false });
      }

      logger.info('Successfully removed old role division assignments', { 
        userId,
        roleId: process.env.GC_ROLE_ID,
        removedCount: grantsToRemove.length
      });

      logger.emitMetric({
        name: 'role_assignments_removed',
        tags: {
          country,
          isCompliant,
          removedCount: grantsToRemove.length
        }
      });
    } else {
      logger.info('No old role division assignments to remove', { 
        userId,
        roleId: process.env.GC_ROLE_ID,
        targetDivisionId
      });
    }
    
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
