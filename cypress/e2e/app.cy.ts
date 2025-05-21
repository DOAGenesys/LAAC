/// <reference types="cypress" />

// Mock Genesys Cloud API
const mockGenesysUsers = {
  compliantUser: {
    id: 'compliant-user-id',
    name: 'Compliant User',
    division: { id: 'other-division-id', name: 'Other Division', selfUri: '/api/v2/authorization/divisions/other-division-id' },
    geolocation: { country: 'Ireland', countryName: 'Ireland', city: 'Dublin', region: 'Dublin', latitude: 53.3498, longitude: -6.2603 },
    selfUri: '/api/v2/users/compliant-user-id'
  },
  nonCompliantUser: {
    id: 'non-compliant-user-id',
    name: 'Non-compliant User',
    division: { id: 'other-division-id', name: 'Other Division', selfUri: '/api/v2/authorization/divisions/other-division-id' },
    geolocation: { country: 'Germany', countryName: 'Germany', city: 'Berlin', region: 'Berlin', latitude: 52.5200, longitude: 13.4050 },
    selfUri: '/api/v2/users/non-compliant-user-id'
  },
  alreadyCorrectUser: {
    id: 'already-correct-user-id',
    name: 'Already Correct User',
    division: { id: 'compliant-division-id', name: 'Compliant Division', selfUri: '/api/v2/authorization/divisions/compliant-division-id' },
    geolocation: { country: 'Ireland', countryName: 'Ireland', city: 'Dublin', region: 'Dublin', latitude: 53.3498, longitude: -6.2603 },
    selfUri: '/api/v2/users/already-correct-user-id'
  }
};

// Define three test scenarios
describe('LAAC Application', () => {
  beforeEach(() => {
    // Reset any previous mocks
    cy.clearCookies();
    cy.clearLocalStorage();
    
    // Mock the redirect that would normally happen with Genesys Cloud SDK
    cy.intercept('**/callback*', (req) => {
      // Simulate Genesys Cloud redirect back to callback with token
      req.reply({
        statusCode: 200,
        body: '<html><body>Redirected to callback</body></html>'
      });
    });

    // Mock the window.location methods
    cy.window().then((win) => {
      cy.stub(win, 'location').as('windowLocation');
    });
  });

  it('should redirect to login page initially', () => {
    cy.visit('/');
    cy.contains('Redirecting to Login');
    cy.contains('Please wait while we redirect you to the Genesys Cloud login');
  });

  it('should process a compliant user and switch division', () => {
    // Mock the API calls
    cy.intercept('GET', '**/api/v2/users/me*', mockGenesysUsers.compliantUser);
    cy.intercept('POST', '**/api/division-switch', { updated: true }).as('divisionSwitch');
    
    // Go to callback with fake token
    cy.visit('/callback#access_token=fake-token');
    
    // Verify the UI shows appropriate status messages
    cy.contains('Verifying your location').should('be.visible');
    
    // Wait for the API call
    cy.wait('@divisionSwitch').then((interception) => {
      // Verify correct data was sent
      expect(interception.request.body).to.have.property('userId', 'compliant-user-id');
      expect(interception.request.body).to.have.property('country', 'Ireland');
    });
    
    // Redirecting to Genesys Cloud
    cy.contains('Redirecting you to Genesys Cloud').should('be.visible');
  });

  it('should process a non-compliant user and switch division', () => {
    // Mock the API calls
    cy.intercept('GET', '**/api/v2/users/me*', mockGenesysUsers.nonCompliantUser);
    cy.intercept('POST', '**/api/division-switch', { updated: true }).as('divisionSwitch');
    
    // Go to callback with fake token
    cy.visit('/callback#access_token=fake-token');
    
    // Verify the UI shows appropriate status messages
    cy.contains('Verifying your location').should('be.visible');
    
    // Wait for the API call
    cy.wait('@divisionSwitch').then((interception) => {
      // Verify correct data was sent
      expect(interception.request.body).to.have.property('userId', 'non-compliant-user-id');
      expect(interception.request.body).to.have.property('country', 'Germany');
    });
    
    // Redirecting to Genesys Cloud
    cy.contains('Redirecting you to Genesys Cloud').should('be.visible');
  });

  it('should process a user already in correct division', () => {
    // Mock the API calls
    cy.intercept('GET', '**/api/v2/users/me*', mockGenesysUsers.alreadyCorrectUser);
    cy.intercept('POST', '**/api/division-switch', { updated: false }).as('divisionSwitch');
    
    // Go to callback with fake token
    cy.visit('/callback#access_token=fake-token');
    
    // Verify the UI shows appropriate status messages
    cy.contains('Verifying your location').should('be.visible');
    
    // Wait for the API call
    cy.wait('@divisionSwitch');
    
    // Redirecting to Genesys Cloud
    cy.contains('Redirecting you to Genesys Cloud').should('be.visible');
  });

  it('should handle errors gracefully', () => {
    // Mock API error
    cy.intercept('GET', '**/api/v2/users/me*', {
      statusCode: 401,
      body: 'Unauthorized'
    });
    
    // Go to callback with fake token
    cy.visit('/callback#access_token=invalid-token');
    
    // Should show error message
    cy.contains('Error occurred').should('be.visible');
    cy.contains('Try Again').should('be.visible');
  });
}); 