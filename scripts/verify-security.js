/**
 * Verifies that sensitive environment variables are not exposed in the client bundle
 * To run: node scripts/verify-security.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// List of sensitive variables that should not appear in client bundle
const sensitiveVars = [
  'GC_CC_CLIENT_ID',
  'GC_CC_CLIENT_SECRET',
  'LAAC_COMPLIANT_DIVISION_ID',
  'LAAC_NON_COMPLIANT_DIVISION_ID'
];

// Temporary build to check
console.log('📦 Building app to verify security...');

// Mock sensitive env vars for the build
process.env.NEXT_PUBLIC_GC_REGION = 'example.com';
process.env.NEXT_PUBLIC_GC_IMPLICIT_CLIENT_ID = 'test-id';
process.env.GC_CC_CLIENT_ID = 'test-cc-id';
process.env.GC_CC_CLIENT_SECRET = 'test-secret-should-not-appear';
process.env.LAAC_COMPLIANT_COUNTRY = 'Ireland';
process.env.LAAC_COMPLIANT_DIVISION_ID = 'test-division-1';
process.env.LAAC_NON_COMPLIANT_DIVISION_ID = 'test-division-2';

try {
  // Build the app
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build completed');

  console.log('🔍 Scanning client bundle for sensitive variables...');
  
  // Define paths to check (adjust as needed)
  const outputDir = path.join(__dirname, '..', '.next');
  const staticDir = path.join(outputDir, 'static');
  const clientJsFiles = [];
  
  // Find all JS files in static directory (recursively)
  function findJsFiles(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        findJsFiles(fullPath);
      } else if (file.name.endsWith('.js')) {
        clientJsFiles.push(fullPath);
      }
    }
  }
  
  findJsFiles(staticDir);
  console.log(`Found ${clientJsFiles.length} client JS files to scan`);
  
  // Scan for sensitive variables
  let foundIssues = false;
  
  for (const file of clientJsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    
    for (const varName of sensitiveVars) {
      if (content.includes(varName) || content.includes(process.env[varName])) {
        console.error(`❌ SECURITY ISSUE: Found sensitive variable ${varName} in ${path.relative(outputDir, file)}`);
        foundIssues = true;
      }
    }
  }
  
  if (!foundIssues) {
    console.log('✅ Security check passed! No sensitive variables found in client bundle');
  } else {
    console.error('❌ Security check failed! Sensitive variables found in client bundle');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error during security verification:', error);
  process.exit(1);
} 