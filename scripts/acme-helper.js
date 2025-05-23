#!/usr/bin/env node
/**
 * ACME Challenge Helper Script
 * 
 * This script helps manage ACME HTTP-01 challenges for certificate generation.
 * It provides utilities to set and clear challenge responses.
 */

const fs = require('fs');
const path = require('path');

const TEMP_CHALLENGE_DIR = path.join(__dirname, '..', 'temp', '.well-known', 'acme-challenge');
const PUBLIC_CHALLENGE_DIR = path.join(__dirname, '..', 'public', '.well-known', 'acme-challenge');

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
}

function setChallenge(token, response, usePublic = false) {
  const challengeDir = usePublic ? PUBLIC_CHALLENGE_DIR : TEMP_CHALLENGE_DIR;
  ensureDirectoryExists(challengeDir);
  
  const challengeFile = path.join(challengeDir, token);
  fs.writeFileSync(challengeFile, response, 'utf8');
  
  console.log(`✅ Challenge set successfully:`);
  console.log(`   Token: ${token}`);
  console.log(`   File: ${challengeFile}`);
  console.log(`   Response length: ${response.length} characters`);
  console.log(`   URL: http://laac.vercel.app/.well-known/acme-challenge/${token}`);
}

function clearChallenge(token) {
  const tempFile = path.join(TEMP_CHALLENGE_DIR, token);
  const publicFile = path.join(PUBLIC_CHALLENGE_DIR, token);
  
  let cleared = false;
  
  if (fs.existsSync(tempFile)) {
    fs.unlinkSync(tempFile);
    console.log(`✅ Removed temp challenge file: ${tempFile}`);
    cleared = true;
  }
  
  if (fs.existsSync(publicFile)) {
    fs.unlinkSync(publicFile);
    console.log(`✅ Removed public challenge file: ${publicFile}`);
    cleared = true;
  }
  
  if (!cleared) {
    console.log(`ℹ️  No challenge files found for token: ${token}`);
  }
}

function listChallenges() {
  console.log('📋 Current ACME Challenges:');
  console.log('==========================');
  
  const tempFiles = fs.existsSync(TEMP_CHALLENGE_DIR) ? fs.readdirSync(TEMP_CHALLENGE_DIR) : [];
  const publicFiles = fs.existsSync(PUBLIC_CHALLENGE_DIR) ? fs.readdirSync(PUBLIC_CHALLENGE_DIR) : [];
  
  if (tempFiles.length > 0) {
    console.log('\n🗂️  Temp directory challenges:');
    tempFiles.forEach(file => {
      const filePath = path.join(TEMP_CHALLENGE_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      console.log(`   - ${file} (${content.length} chars)`);
    });
  }
  
  if (publicFiles.length > 0) {
    console.log('\n🌐 Public directory challenges:');
    publicFiles.forEach(file => {
      const filePath = path.join(PUBLIC_CHALLENGE_DIR, file);
      const content = fs.readFileSync(filePath, 'utf8');
      console.log(`   - ${file} (${content.length} chars)`);
    });
  }
  
  if (tempFiles.length === 0 && publicFiles.length === 0) {
    console.log('   No challenges found');
  }
}

function clearAllChallenges() {
  let cleared = 0;
  
  if (fs.existsSync(TEMP_CHALLENGE_DIR)) {
    const tempFiles = fs.readdirSync(TEMP_CHALLENGE_DIR);
    tempFiles.forEach(file => {
      fs.unlinkSync(path.join(TEMP_CHALLENGE_DIR, file));
      cleared++;
    });
  }
  
  if (fs.existsSync(PUBLIC_CHALLENGE_DIR)) {
    const publicFiles = fs.readdirSync(PUBLIC_CHALLENGE_DIR);
    publicFiles.forEach(file => {
      fs.unlinkSync(path.join(PUBLIC_CHALLENGE_DIR, file));
      cleared++;
    });
  }
  
  console.log(`✅ Cleared ${cleared} challenge file(s)`);
}

function printUsage() {
  console.log('🔧 ACME Challenge Helper');
  console.log('========================');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/acme-helper.js set <token> <response> [--public]');
  console.log('  node scripts/acme-helper.js clear <token>');
  console.log('  node scripts/acme-helper.js list');
  console.log('  node scripts/acme-helper.js clear-all');
  console.log('');
  console.log('Commands:');
  console.log('  set       Set a challenge response for the given token');
  console.log('  clear     Remove a challenge file for the given token');
  console.log('  list      List all current challenge files');
  console.log('  clear-all Clear all challenge files');
  console.log('');
  console.log('Options:');
  console.log('  --public  Store the challenge in public directory (for static hosting)');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/acme-helper.js set ABC123 "ABC123.DEF456-GHI789"');
  console.log('  node scripts/acme-helper.js clear ABC123');
  console.log('  node scripts/acme-helper.js list');
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  printUsage();
  process.exit(1);
}

const command = args[0];

try {
  switch (command) {
    case 'set':
      if (args.length < 3) {
        console.error('❌ Error: Token and response are required');
        console.log('Usage: node scripts/acme-helper.js set <token> <response> [--public]');
        process.exit(1);
      }
      const token = args[1];
      const response = args[2];
      const usePublic = args.includes('--public');
      setChallenge(token, response, usePublic);
      break;

    case 'clear':
      if (args.length < 2) {
        console.error('❌ Error: Token is required');
        console.log('Usage: node scripts/acme-helper.js clear <token>');
        process.exit(1);
      }
      clearChallenge(args[1]);
      break;

    case 'list':
      listChallenges();
      break;

    case 'clear-all':
      clearAllChallenges();
      break;

    default:
      console.error(`❌ Error: Unknown command '${command}'`);
      printUsage();
      process.exit(1);
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} 