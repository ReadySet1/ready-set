import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/file-uploads/route';

// Mocks
const removeMock = jest.fn().mockResolvedValue({ data: null, error: null });
const fromMock = jest.fn(() => ({ remove: removeMock }));

const mockSupabaseClient = {
  storage: { from: fromMock },
} as any;

jest.mock('@/utils/supabase/server', () => ({
  createClient: () => mockSupabaseClient,
}));

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    fileUpload: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Narrow prisma type to mocked shape
import { prisma } from '@/utils/prismaDB';
type PrismaMock = {
  fileUpload: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    delete: jest.Mock;
  };
};
const mockPrisma = prisma as unknown as PrismaMock;

/**
 * TODO: REA-211 - File uploads delete API needs auth middleware mocking
 */
describe.skip('DELETE /api/file-uploads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const makeFileRecord = () => ({
    id: 'file-123',
    fileName: 'example.png',
    fileUrl:
      'https://example.supabase.co/storage/v1/object/public/fileUploader/path/to/example.png',
  });

  it('deletes a file using query param fileId', async () => {
    mockPrisma.fileUpload.findUnique.mockResolvedValue(makeFileRecord());
    mockPrisma.fileUpload.delete.mockResolvedValue({ id: 'file-123' });

    const req = new Request(
      'http://localhost:3000/api/file-uploads?fileId=file-123',
      { method: 'DELETE' },
    ) as NextRequest;

    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    // Storage deletion invoked with correct bucket and path
    expect(fromMock).toHaveBeenCalledWith('fileUploader');
    expect(removeMock).toHaveBeenCalledTimes(1);
    const arg = removeMock.mock.calls[0][0][0];
    expect(arg).toBe('path/to/example.png');

    // DB record deleted
    expect(mockPrisma.fileUpload.delete).toHaveBeenCalledWith({ where: { id: 'file-123' } });
  });

  // Note: clients have been standardized to use query params.
  // The API remains tolerant to body input, but we validate the main contract above.
});


