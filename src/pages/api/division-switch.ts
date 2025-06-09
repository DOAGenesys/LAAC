import type { NextApiRequest, NextApiResponse } from 'next';
import { getClientCredentialsToken } from '../../lib/oauthService';
import type { DivisionSwitchResponse } from '../../types/genesys';
import logger from '../../lib/logger';
import { getCountries, getDivisionIdFromMap, getDivisionMap } from '../../lib/divisionService';

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
    const { userId, country: selectedCountry, currentDivisionId, detectedCountry } = req.body;

    // Validate request data
    if (!userId || !selectedCountry || !detectedCountry) {
      logger.error('Missing required fields in request body');
      return res.status(400).json({ updated: false });
    }

    logger.info('Processing division switch request', { userId, selectedCountry, currentDivisionId, detectedCountry });

    const allSupportedCountries = getCountries('all');
    const divisionMap = await getDivisionMap();

    let targetDivisionId: string | undefined;
    let divisionIdsForRoles: string[] = [];

    const isMatch = selectedCountry === detectedCountry;
    const isDetectedCountrySupported = allSupportedCountries.includes(detectedCountry);

    if (isMatch && isDetectedCountrySupported) {
      // Case 1: Compliant - both match and detected country is supported
      // Primary division: detected country, Role divisions: ALL supported countries
      logger.info('User is compliant', { userId, selectedCountry, detectedCountry });
      targetDivisionId = getDivisionIdFromMap(divisionMap, detectedCountry);
      divisionIdsForRoles = allSupportedCountries
        .map(c => getDivisionIdFromMap(divisionMap, c))
        .filter((id): id is string => !!id);
    } else if (!isMatch && isDetectedCountrySupported) {
      // Case 2: Non-Compliant - countries don't match but detected country is supported
      // Primary division: detected country, Role divisions: only detected country
      logger.info('User is non-compliant', { userId, selectedCountry, detectedCountry });
      targetDivisionId = getDivisionIdFromMap(divisionMap, detectedCountry);
      if (targetDivisionId) {
        divisionIdsForRoles = [targetDivisionId];
      }
    } else {
      // Case 3: Out of scope - detected country is not supported
      logger.info('User is out of scope', { userId, selectedCountry, detectedCountry });
      targetDivisionId = process.env.LAAC_OUT_OF_SCOPE_DIVISION_ID || process.env.LAAC_NON_COMPLIANT_DIVISION_ID;
      if (targetDivisionId) {
        divisionIdsForRoles = [targetDivisionId];
      }
    }

    if (!targetDivisionId || divisionIdsForRoles.length === 0) {
      logger.error('Could not determine target division or roles', { userId, targetDivisionId, rolesCount: divisionIdsForRoles.length });
      return res.status(500).json({ updated: false });
    }

    const isAlreadyInCorrectDivision = currentDivisionId === targetDivisionId;
    
    // We will still proceed to update roles even if primary division is correct
    logger.info(`User's primary division correctness: ${isAlreadyInCorrectDivision}`, { userId, currentDivisionId, targetDivisionId });

    // Get access token using client credentials
    const accessToken = await getClientCredentialsToken();

    if (!isAlreadyInCorrectDivision) {
      logger.info('Updating user primary division', { userId, targetDivisionId });
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
        logger.error('Error updating user primary division', { status: divisionResponse.status, error: errorText, userId, targetDivisionId });
      return res.status(500).json({ updated: false });
    }
      logger.info('Successfully updated user primary division', { userId, targetDivisionId });
    }
    
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
          country: selectedCountry,
          isCompliant: isMatch && isDetectedCountrySupported,
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
      logger.warn('No roles found for user, skipping role division update', { userId });
      return res.status(200).json({ updated: true });
    }

    // Step 3: Remove all existing division grants for user's roles to ensure clean state
    logger.info('Removing existing role division assignments to ensure clean state', { userId });
    
    // Build list of all existing role-division grants that need to be removed
    const grantsToRemove = grants
      .filter((grant: any) => grant.role?.id && grant.division?.id)
      .map((grant: any) => ({
        roleId: grant.role.id,
        divisionId: grant.division.id
      }));

    if (grantsToRemove.length > 0) {
      logger.info('Found existing role-division grants to remove', { 
        userId, 
        grantsCount: grantsToRemove.length,
        grants: grantsToRemove.map((g: { roleId: string; divisionId: string }) => `${g.roleId}:${g.divisionId}`)
      });

      const removeResponse = await fetch(
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

      if (!removeResponse.ok) {
        const errorText = await removeResponse.text();
        logger.error('Failed to remove existing role division grants', {
          userId,
          status: removeResponse.status,
          error: errorText
        });
        return res.status(500).json({ updated: false });
      }

      logger.info('Successfully removed all existing role division grants', { userId });
    } else {
      logger.info('No existing role-division grants found to remove', { userId });
    }

    // Step 4: Add new role division assignments
    logger.info('Adding new role division assignments', { userId, roles: userRoles.join(','), divisions: divisionIdsForRoles.join(',') });

    const roleAssignmentPromises = userRoles.map(async (roleId: string) => {
      return fetch(
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
    });

    try {
      const results = await Promise.all(roleAssignmentPromises);
      results.forEach(async (res, index) => {
        if (!res.ok) {
          const roleId = userRoles[index];
          logger.error('Failed to add new role division assignment', {
        userId, 
            roleId,
            status: res.status,
            error: await res.text()
          });
        }
      });

      logger.info('Successfully added all new role division assignments', { userId });
    } catch (error) {
      logger.error('An error occurred during role division assignment addition', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ updated: false });
    }
    
    // Emit success metric
    logger.emitMetric({
      name: 'division_switch_applied',
      tags: {
        country: selectedCountry,
        isCompliant: isMatch && isDetectedCountrySupported
      }
    });

    logger.emitMetric({
      name: 'role_division_assignment_applied',
      tags: {
        country: selectedCountry,
        isCompliant: isMatch && isDetectedCountrySupported
      }
    });

    return res.status(200).json({ updated: true });
  } catch (error) {
    logger.error('An unexpected error occurred in division-switch', { error: error instanceof Error ? error.message : String(error) });
    
    // Emit error metric
    logger.emitMetric({
      name: 'division_switch_error'
    });
    
    return res.status(500).json({ updated: false });
  }
} 
