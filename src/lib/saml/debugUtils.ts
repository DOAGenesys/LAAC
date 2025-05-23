/**
 * SAML Debugging Utilities
 * 
 * Collection of utility functions to help debug SAML authentication issues
 */

interface SamlAnalysisSuccess {
  valid: true;
  length: number;
  issuer: string | null;
  nameId: string | null;
  audience: string | null;
  destination: string | null;
  hasSamlpResponse: boolean;
  hasSignature: boolean;
  hasAssertion: boolean;
  hasAttributeStatement: boolean;
  hasStatus: boolean;
  hasSuccessStatus: boolean;
  attributes: Record<string, string>;
  timestamps: {
    issueInstant: string | null;
    notBefore: string | null;
    notOnOrAfter: string | null;
    authnInstant: string | null;
    sessionNotOnOrAfter: string | null;
  };
  errors: string[];
}

interface SamlAnalysisError {
  valid: false;
  error: string;
  length: number;
}

type SamlAnalysisResult = SamlAnalysisSuccess | SamlAnalysisError;

/**
 * Analyzes a SAML response and extracts key information for debugging
 */
export function analyzeSamlResponse(base64Response: string): SamlAnalysisResult {
  try {
    const decodedXml = Buffer.from(base64Response, 'base64').toString();
    
    const analysis: SamlAnalysisSuccess = {
      valid: true,
      length: decodedXml.length,
      issuer: extractXmlValue(decodedXml, /<saml:Issuer[^>]*>([^<]+)<\/saml:Issuer>/),
      nameId: extractXmlValue(decodedXml, /<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/),
      audience: extractXmlValue(decodedXml, /<saml:Audience[^>]*>([^<]+)<\/saml:Audience>/),
      destination: extractXmlValue(decodedXml, /Destination="([^"]+)"/),
      hasSamlpResponse: decodedXml.includes('<samlp:Response'),
      hasSignature: decodedXml.includes('<ds:Signature'),
      hasAssertion: decodedXml.includes('<saml:Assertion'),
      hasAttributeStatement: decodedXml.includes('<saml:AttributeStatement>'),
      hasStatus: decodedXml.includes('<samlp:Status>'),
      hasSuccessStatus: decodedXml.includes('urn:oasis:names:tc:SAML:2.0:status:Success'),
      attributes: extractSamlAttributes(decodedXml),
      timestamps: extractSamlTimestamps(decodedXml),
      errors: []
    };
    
    // Validate structure
    if (!analysis.hasSamlpResponse) {
      analysis.errors.push('Missing <samlp:Response> element');
    }
    if (!analysis.hasAssertion) {
      analysis.errors.push('Missing <saml:Assertion> element');
    }
    if (!analysis.hasSignature) {
      analysis.errors.push('Missing <ds:Signature> element');
    }
    if (!analysis.hasSuccessStatus) {
      analysis.errors.push('Response does not indicate success status');
    }
    
    return analysis;
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
      length: 0
    };
  }
}

/**
 * Extracts attribute values from SAML response
 */
function extractSamlAttributes(xml: string) {
  const attributes: Record<string, string> = {};
  
  // Match attribute patterns
  const attrPattern = /<saml:Attribute Name="([^"]+)"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/g;
  let match;
  
  while ((match = attrPattern.exec(xml)) !== null) {
    attributes[match[1]] = match[2];
  }
  
  return attributes;
}

/**
 * Extracts timestamp information from SAML response
 */
function extractSamlTimestamps(xml: string) {
  return {
    issueInstant: extractXmlValue(xml, /IssueInstant="([^"]+)"/),
    notBefore: extractXmlValue(xml, /NotBefore="([^"]+)"/),
    notOnOrAfter: extractXmlValue(xml, /NotOnOrAfter="([^"]+)"/),
    authnInstant: extractXmlValue(xml, /AuthnInstant="([^"]+)"/),
    sessionNotOnOrAfter: extractXmlValue(xml, /SessionNotOnOrAfter="([^"]+)"/),
  };
}

/**
 * Helper function to extract XML values using regex
 */
function extractXmlValue(xml: string, pattern: RegExp): string | null {
  const match = xml.match(pattern);
  return match ? match[1] : null;
}

/**
 * Validates timestamps to check for clock skew issues
 */
export function validateSamlTimestamps(timestamps: any) {
  const now = new Date();
  const issues: string[] = [];
  
  if (timestamps.notBefore) {
    const notBefore = new Date(timestamps.notBefore);
    if (now < notBefore) {
      const diffMs = notBefore.getTime() - now.getTime();
      issues.push(`NotBefore is ${Math.floor(diffMs / 1000)} seconds in the future (clock skew issue)`);
    }
  }
  
  if (timestamps.notOnOrAfter) {
    const notOnOrAfter = new Date(timestamps.notOnOrAfter);
    if (now > notOnOrAfter) {
      const diffMs = now.getTime() - notOnOrAfter.getTime();
      issues.push(`NotOnOrAfter is ${Math.floor(diffMs / 1000)} seconds in the past (expired)`);
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Masks sensitive data in logs while preserving structure for debugging
 */
export function maskSensitiveData(data: any, fieldsToMask: string[] = ['password', 'privateKey', 'SAMLRequest']): any {
  if (typeof data === 'string') {
    // Check if this looks like a JWT or base64 encoded data
    if (data.length > 50 && (data.includes('.') || /^[A-Za-z0-9+/=]+$/.test(data))) {
      return data.substring(0, 20) + '***MASKED***';
    }
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item, fieldsToMask));
  }
  
  if (data && typeof data === 'object') {
    const masked: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (fieldsToMask.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        if (typeof value === 'string') {
          masked[key] = value.length > 20 ? value.substring(0, 20) + '***MASKED***' : '***MASKED***';
        } else {
          masked[key] = '***MASKED***';
        }
      } else {
        masked[key] = maskSensitiveData(value, fieldsToMask);
      }
    }
    return masked;
  }
  
  return data;
} 