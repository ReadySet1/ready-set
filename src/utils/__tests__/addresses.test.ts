import { getAddressInfo } from "../addresses";

describe("Address Utilities", () => {
  describe("getAddressInfo", () => {
    it("returns formatted address for valid input", async () => {
      const address = "123 Main St, San Francisco, CA 94103";
      const result = await getAddressInfo(address);
      
      expect(result).toEqual({
        formatted: address,
        components: {},
      });
    });

    it("handles empty address string", async () => {
      const address = "";
      const result = await getAddressInfo(address);
      
      expect(result).toEqual({
        formatted: "",
        components: {},
      });
    });

    it("handles address with special characters", async () => {
      const address = "123 Test St. #4B, San José, CA 94103";
      const result = await getAddressInfo(address);
      
      expect(result).toEqual({
        formatted: address,
        components: {},
      });
    });

    it("handles very long address", async () => {
      const longAddress = "A".repeat(500);
      const result = await getAddressInfo(longAddress);
      
      expect(result).toEqual({
        formatted: longAddress,
        components: {},
      });
    });
  });
}); 