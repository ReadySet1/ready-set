import { mockRouter } from './test-utils';

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

describe("Imported mock test", () => {
  it("should use imported mock", () => {
    const { useRouter } = require("next/navigation");
    expect(useRouter()).toBe(mockRouter);
  });
});

