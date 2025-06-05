import { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../pages/api/division-switch';
import { getClientCredentialsToken } from '../../lib/oauthService';

// Mock the oauthService
jest.mock('../../lib/oauthService', () => ({
  getClientCredentialsToken: jest.fn().mockResolvedValue('mock-access-token'),
}));

// Mock response object
const mockResponse = () => {
  const res: Partial<NextApiResponse> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as NextApiResponse;
};

describe('division-switch API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  it('should return 405 for non-POST requests', async () => {
    const req: Partial<NextApiRequest> = { method: 'GET' };
    const res = mockResponse();

    await handler(req as NextApiRequest, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ updated: false });
  });

  it('should return 400 if userId is missing', async () => {
    const req: Partial<NextApiRequest> = {
      method: 'POST',
      body: { country: 'Ireland' },
    };
    const res = mockResponse();

    await handler(req as NextApiRequest, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ updated: false });
  });

  it('should return 500 if GC_ROLE_ID is missing', async () => {
    const originalRoleId = process.env.GC_ROLE_ID;
    delete process.env.GC_ROLE_ID;

    const req: Partial<NextApiRequest> = {
      method: 'POST',
      body: {
        userId: 'test-user-id',
        country: 'Ireland',
        currentDivisionId: 'other-division-id',
      },
    };
    const res = mockResponse();

    await handler(req as NextApiRequest, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ updated: false });

    process.env.GC_ROLE_ID = originalRoleId;
  });

  it('should return without updating if user is already in the correct division', async () => {
    const req: Partial<NextApiRequest> = {
      method: 'POST',
      body: {
        userId: 'test-user-id',
        country: 'Ireland',
        currentDivisionId: 'compliant-division-id',
      },
    };
    const res = mockResponse();

    await handler(req as NextApiRequest, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ updated: false });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should update division and role assignment for compliant users', async () => {
    const req: Partial<NextApiRequest> = {
      method: 'POST',
      body: {
        userId: 'test-user-id',
        country: 'Ireland',
        currentDivisionId: 'other-division-id',
      },
    };
    const res = mockResponse();

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    await handler(req as NextApiRequest, res);

    expect(getClientCredentialsToken).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    
    expect(global.fetch).toHaveBeenNthCalledWith(1,
      'https://api.mypurecloud.com/api/v2/authorization/divisions/compliant-division-id/objects/USER',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(['test-user-id']),
      })
    );
    
    expect(global.fetch).toHaveBeenNthCalledWith(2,
      'https://api.mypurecloud.com/api/v2/authorization/roles/test-role-id?subjectType=PC_USER',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          subjectIds: ['test-user-id'],
          divisionIds: ['compliant-division-id']
        }),
      })
    );
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ updated: true });
  });

  it('should update division and role assignment for non-compliant users', async () => {
    const req: Partial<NextApiRequest> = {
      method: 'POST',
      body: {
        userId: 'test-user-id',
        country: 'Germany',
        currentDivisionId: 'other-division-id',
      },
    };
    const res = mockResponse();

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    await handler(req as NextApiRequest, res);

    expect(getClientCredentialsToken).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    
    expect(global.fetch).toHaveBeenNthCalledWith(1,
      'https://api.mypurecloud.com/api/v2/authorization/divisions/non-compliant-division-id/objects/USER',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(['test-user-id']),
      })
    );
    
    expect(global.fetch).toHaveBeenNthCalledWith(2,
      'https://api.mypurecloud.com/api/v2/authorization/roles/test-role-id?subjectType=PC_USER',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          subjectIds: ['test-user-id'],
          divisionIds: ['non-compliant-division-id']
        }),
      })
    );
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ updated: true });
  });

  it('should handle division API errors', async () => {
    const req: Partial<NextApiRequest> = {
      method: 'POST',
      body: {
        userId: 'test-user-id',
        country: 'Ireland',
        currentDivisionId: 'other-division-id',
      },
    };
    const res = mockResponse();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: jest.fn().mockResolvedValueOnce('Forbidden'),
    });

    await handler(req as NextApiRequest, res);

    expect(getClientCredentialsToken).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ updated: false });
  });

  it('should handle role assignment API errors', async () => {
    const req: Partial<NextApiRequest> = {
      method: 'POST',
      body: {
        userId: 'test-user-id',
        country: 'Ireland',
        currentDivisionId: 'other-division-id',
      },
    };
    const res = mockResponse();

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValueOnce('Role assignment forbidden'),
      });

    await handler(req as NextApiRequest, res);

    expect(getClientCredentialsToken).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ updated: false });
  });
}); 
