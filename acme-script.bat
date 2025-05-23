@echo off
REM Win-ACME HTTP-01 Challenge Script
REM This script is called by win-acme to set up HTTP challenges

echo [WIN-ACME SCRIPT] Setting up HTTP-01 challenge...

REM Arguments passed by win-acme:
REM %1 = Token
REM %2 = Response (token.thumbprint)

set TOKEN=%1
set RESPONSE=%2

echo [WIN-ACME SCRIPT] Token: %TOKEN%
echo [WIN-ACME SCRIPT] Response: %RESPONSE%

REM Change to project directory
cd /d "C:\Users\dondivie\cursor\LAAC"

REM Set up the challenge using our helper script
node scripts/acme-helper.js set "%TOKEN%" "%RESPONSE%"

echo [WIN-ACME SCRIPT] Challenge setup complete
echo [WIN-ACME SCRIPT] URL: http://laac.vercel.app/.well-known/acme-challenge/%TOKEN%
echo.
echo Press any key to continue...
pause > nul 