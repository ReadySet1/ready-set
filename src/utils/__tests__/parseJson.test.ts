import { parseJsonFile } from "../parseJson";

// Mock fs/promises and path modules
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn(),
}));

describe("Parse JSON Utility", () => {
  const mockReadFile = require('fs/promises').readFile;
  const mockJoin = require('path').join;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJoin.mockReturnValue('/mock/path/to/legacy-data.json');
  });

  describe("parseJsonFile", () => {
    it("successfully parses valid JSON file", async () => {
      const mockData = {
        users: [
          { id: 1, name: "John Doe", email: "john@example.com" },
          { id: 2, name: "Jane Smith", email: "jane@example.com" }
        ],
        orders: [
          { id: 1, userId: 1, total: 100.50 },
          { id: 2, userId: 2, total: 75.25 }
        ]
      };

      mockReadFile.mockResolvedValue(JSON.stringify(mockData));

      const result = await parseJsonFile();

      expect(mockJoin).toHaveBeenCalledWith(process.cwd(), 'src', 'data', 'legacy-data.json');
      expect(mockReadFile).toHaveBeenCalledWith('/mock/path/to/legacy-data.json', 'utf8');
      expect(result).toEqual(mockData);
    });

    it("throws error for invalid JSON", async () => {
      mockReadFile.mockResolvedValue('invalid json content');

      await expect(parseJsonFile()).rejects.toThrow();
    });

    it("throws error when file read fails", async () => {
      const error = new Error('File not found');
      mockReadFile.mockRejectedValue(error);

      await expect(parseJsonFile()).rejects.toThrow('File not found');
    });
  });
}); 