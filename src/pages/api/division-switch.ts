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

    const compliantCountries = getCountries('compliant');
    const alternativeCountries = getCountries('alternative');
    const allSupportedCountries = getCountries('all');
    const divisionMap = await getDivisionMap();

    let targetDivisionId: string | undefined;
    let divisionIdsForRoles: string[] = [];

    const isMatch = selectedCountry === detectedCountry;
    const isCompliantCountry = compliantCountries.includes(selectedCountry);
    const isAlternativeCountry = alternativeCountries.includes(selectedCountry);

    if (isMatch && isCompliantCountry) {
      // Case 1: Fully Compliant - access to ALL divisions
      logger.info('User is fully compliant', { userId, country: selectedCountry });
      targetDivisionId = getDivisionIdFromMap(divisionMap, selectedCountry);
      divisionIdsForRoles = allSupportedCountries
        .map(c => getDivisionIdFromMap(divisionMap, c))
        .filter((id): id is string => !!id);
    } else if (isMatch && isAlternativeCountry) {
      // Case 2: Alternative Compliant - access to ONLY their own division
      logger.info('User is alternative compliant', { userId, country: selectedCountry });
      targetDivisionId = getDivisionIdFromMap(divisionMap, selectedCountry);
      if (targetDivisionId) {
        divisionIdsForRoles = [targetDivisionId];
      }
    } else {
      // Case 3: Non-Compliant or Out of Scope
      if ((isCompliantCountry || isAlternativeCountry) && !isMatch) {
        logger.info('User is non-compliant (supported country but location mismatch)', { userId, selectedCountry, detectedCountry });
      } else {
        logger.info('User is out of scope (unsupported country)', { userId, selectedCountry, detectedCountry });
      }
      targetDivisionId = process.env.LAAC_NON_COMPLIANT_DIVISION_ID;
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
          isCompliant: isMatch && (isCompliantCountry || isAlternativeCountry),
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

    logger.info('Setting role division assignments', { userId, roles: userRoles.join(','), divisions: divisionIdsForRoles.join(',') });

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
          logger.error('Failed to update role division assignment', {
        userId, 
            roleId,
            status: res.status,
            error: await res.text()
          });
        }
      });

      logger.info('Successfully updated all role division assignments', { userId });
    } catch (error) {
      logger.error('An error occurred during bulk role division assignment', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Optionally emit a failure metric here
      return res.status(500).json({ updated: false });
    }
    
    // Emit success metric
    logger.emitMetric({
      name: 'division_switch_applied',
      tags: {
        country: selectedCountry,
        isCompliant: isMatch && (isCompliantCountry || isAlternativeCountry)
      }
    });

    logger.emitMetric({
      name: 'role_division_assignment_applied',
      tags: {
        country: selectedCountry,
        isCompliant: isMatch && (isCompliantCountry || isAlternativeCountry)
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
