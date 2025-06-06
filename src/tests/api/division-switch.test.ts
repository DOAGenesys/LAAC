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

const mockSubjectData = {
  id: 'test-user-id',
  grants: [
    {
      subjectId: 'test-user-id',
      division: {
        id: 'old-division-id-1',
        name: 'Old Division 1',
        selfUri: '/api/v2/authorization/divisions/old-division-id-1'
      },
      role: {
        id: 'test-role-id',
        name: 'Test Role',
        selfUri: '/api/v2/authorization/roles/test-role-id'
      }
    },
    {
      subjectId: 'test-user-id',
      division: {
        id: 'old-division-id-2',
        name: 'Old Division 2',
        selfUri: '/api/v2/authorization/divisions/old-division-id-2'
      },
      role: {
        id: 'test-role-id',
        name: 'Test Role',
        selfUri: '/api/v2/authorization/roles/test-role-id'
      }
    },
    {
      subjectId: 'test-user-id',
      division: {
        id: 'other-division-id',
        name: 'Other Division',
        selfUri: '/api/v2/authorization/divisions/other-division-id'
      },
      role: {
        id: 'different-role-id',
        name: 'Different Role',
        selfUri: '/api/v2/authorization/roles/different-role-id'
      }
    }
  ]
};

const mockSubjectDataEmpty = {
  id: 'test-user-id',
  grants: []
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

  it('should complete full workflow for compliant users with role cleanup', async () => {
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
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockSubjectData),
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    await handler(req as NextApiRequest, res);

    expect(getClientCredentialsToken).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(4);
    
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

    expect(global.fetch).toHaveBeenNthCalledWith(3,
      'https://api.mypurecloud.com/api/v2/authorization/subjects/test-user-id',
      expect.objectContaining({
        method: 'GET',
      })
    );

    expect(global.fetch).toHaveBeenNthCalledWith(4,
      'https://api.mypurecloud.com/api/v2/authorization/subjects/test-user-id/bulkremove',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          grants: [
            { roleId: 'test-role-id', divisionId: 'old-division-id-1' },
            { roleId: 'test-role-id', divisionId: 'old-division-id-2' }
          ]
        }),
      })
    );
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ updated: true });
  });

  it('should complete full workflow for non-compliant users with role cleanup', async () => {
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
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockSubjectData),
      })
      .mockResolvedValueOnce({
        ok: true,
      });

    await handler(req as NextApiRequest, res);

    expect(getClientCredentialsToken).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(4);
    
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

    expect(global.fetch).toHaveBeenNthCalledWith(3,
      'https://api.mypurecloud.com/api/v2/authorization/subjects/test-user-id',
      expect.objectContaining({
        method: 'GET',
      })
    );

    expect(global.fetch).toHaveBeenNthCalledWith(4,
      'https://api.mypurecloud.com/api/v2/authorization/subjects/test-user-id/bulkremove',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          grants: [
            { roleId: 'test-role-id', divisionId: 'old-division-id-1' },
            { roleId: 'test-role-id', divisionId: 'old-division-id-2' }
          ]
        }),
      })
    );
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ updated: true });
  });

  it('should skip role cleanup when no old assignments exist', async () => {
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
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockSubjectDataEmpty),
      });

    await handler(req as NextApiRequest, res);

    expect(getClientCredentialsToken).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(3);
    
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

  it('should handle subject fetch API errors', async () => {
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
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValueOnce('Subject fetch forbidden'),
      });

    await handler(req as NextApiRequest, res);

    expect(getClientCredentialsToken).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ updated: false });
  });

  it('should handle bulk remove API errors', async () => {
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
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockSubjectData),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValueOnce('Bulk remove forbidden'),
      });

    await handler(req as NextApiRequest, res);

    expect(getClientCredentialsToken).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ updated: false });
  });
}); 
