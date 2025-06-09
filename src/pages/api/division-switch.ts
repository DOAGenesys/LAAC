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
    const { userId, country, currentDivisionId, detectedCountry } = req.body;

    // Validate request data
    if (!userId) {
      logger.error('Missing userId in request body');
      return res.status(400).json({ updated: false });
    }

    logger.info('Processing division switch request', { 
      userId, 
      country, 
      currentDivisionId,
      detectedCountry
    });

    // Determine target division based on country
    const isCompliant = detectedCountry === country;
    
    const compliantDivisionIds = process.env.LAAC_COMPLIANT_DIVISION_IDS
      ? process.env.LAAC_COMPLIANT_DIVISION_IDS.split(',').map(id => id.trim())
      : [];
    
    const nonCompliantDivisionId = process.env.LAAC_NON_COMPLIANT_DIVISION_ID;

    const targetDivisionId = isCompliant 
      ? compliantDivisionIds[0]
      : nonCompliantDivisionId;

    const divisionIdsForRoles = isCompliant
      ? compliantDivisionIds
      : (nonCompliantDivisionId ? [nonCompliantDivisionId] : []);

    // If division IDs are not set, return error
    if (!targetDivisionId || divisionIdsForRoles.length === 0) {
      logger.error('Missing division IDs in environment variables');
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
    
    // Step 2: Get current role assignments to identify all user roles
    logger.info('Calling Genesys API to get current role assignments', { 
      userId
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
        userId
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
    
    // Extract unique roles the user currently has
    const userRoles: string[] = [...new Set(grants
      .filter((grant: any) => grant.role?.id)
      .map((grant: any) => grant.role.id as string)
    )] as string[];

    logger.info('Found user roles', { 
      userId,
      totalGrants: grants.length,
      userRoles: userRoles.length,
      rolesList: userRoles.join(', ')
    });

    if (userRoles.length === 0) {
      logger.warn('No roles found for user', { userId });
      return res.status(200).json({ updated: true });
    }

    // Step 3: Add role division assignments for all user roles
    logger.info('Adding role division assignments for all user roles', { 
      userId, 
      targetDivisionIds: divisionIdsForRoles.join(','),
      userRolesList: userRoles.join(', ')
    });

    // Process role assignments for all roles in parallel
    const roleAssignmentPromises = userRoles.map(async (roleId: string) => {
      logger.info('Adding role division assignment', { 
        userId, 
        targetDivisionIds: divisionIdsForRoles.join(','),
        roleId
      });

      const roleResponse = await fetch(
        `https://api.${process.env.NEXT_PUBLIC_GC_REGION}/api/v2/authorization/roles/${roleId}?subjectType=PC_USER`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            subjectIds: [userId],
            divisionIds: divisionIdsForRoles
          })
        }
      );

      if (!roleResponse.ok) {
        const errorText = await roleResponse.text();
        logger.error('Error adding role division assignment', { 
          status: roleResponse.status, 
          error: errorText,
          userId,
          targetDivisionIds: divisionIdsForRoles.join(','),
          roleId
        });
        throw new Error(`Failed to assign role ${roleId}: ${errorText}`);
      }

      logger.info('Successfully added role division assignment', { 
        userId, 
        targetDivisionIds: divisionIdsForRoles.join(','),
        roleId
      });

      return roleId;
    });

    try {
      await Promise.all(roleAssignmentPromises);
      logger.info('Successfully added all role division assignments', { 
        userId, 
        targetDivisionIds: divisionIdsForRoles.join(','),
        userRolesList: userRoles.join(', ')
      });
    } catch (error) {
      logger.error('Error adding role division assignments', { 
        error: error instanceof Error ? error.message : String(error),
        userId,
        targetDivisionIds: divisionIdsForRoles.join(','),
        userRolesList: userRoles.join(', ')
      });
      
      logger.emitMetric({
        name: 'role_division_assignment_failed',
        tags: {
          country,
          isCompliant
        }
      });
      
      return res.status(500).json({ updated: false });
    }

    // Step 4: Remove old role division assignments for all user roles
    const grantsToRemove = grants
      .filter((grant: any) => 
        grant.role?.id &&
        grant.division?.id &&
        !divisionIdsForRoles.includes(grant.division.id)
      );

    if (grantsToRemove.length > 0) {
      logger.info('Removing old role division assignments', { 
        userId,
        count: grantsToRemove.length
      });

      const removeRolePromises = grantsToRemove.map(async (grant: any) => {
        const roleId = grant.role.id;
        const divisionId = grant.division.id;
        
        logger.info('Removing role division assignment', { 
          userId, 
          divisionId,
          roleId
        });

        const removeResponse = await fetch(
          `https://api.${process.env.NEXT_PUBLIC_GC_REGION}/api/v2/authorization/roles/${roleId}/subjects/${userId}/divisions/${divisionId}`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );

        if (!removeResponse.ok) {
          const errorText = await removeResponse.text();
          logger.error('Error removing role division assignment', { 
            status: removeResponse.status, 
            error: errorText,
            userId,
            divisionId,
            roleId
          });
          // Decide if you want to throw or just log
        } else {
          logger.info('Successfully removed role division assignment', { 
            userId, 
            divisionId,
            roleId
          });
        }
      });

      await Promise.all(removeRolePromises);
      logger.info('Successfully removed all old role division assignments', { 
        userId
      });
    } else {
      logger.info('No old role division assignments to remove', { userId });
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
