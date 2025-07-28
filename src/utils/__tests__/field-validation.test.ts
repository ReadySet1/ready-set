import { validateRequiredFields } from "../field-validation";

describe("Field Validation Utility", () => {
  describe("validateRequiredFields", () => {
    it("returns valid when all required fields are present", () => {
      const data = {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
        isActive: true,
      };
      const requiredFields = ["name", "email", "age"];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it("returns invalid when required fields are missing", () => {
      const data = {
        name: "John Doe",
        email: "john@example.com",
        // age is missing
      };
      const requiredFields = ["name", "email", "age"];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(["age"]);
    });

    it("returns invalid when required fields are undefined", () => {
      const data = {
        name: "John Doe",
        email: undefined,
        age: 30,
      };
      const requiredFields = ["name", "email", "age"];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(["email"]);
    });

    it("returns invalid when required fields are null", () => {
      const data = {
        name: "John Doe",
        email: null,
        age: 30,
      };
      const requiredFields = ["name", "email", "age"];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(["email"]);
    });

    it("returns invalid when required fields are empty strings", () => {
      const data = {
        name: "John Doe",
        email: "",
        age: 30,
      };
      const requiredFields = ["name", "email", "age"];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(["email"]);
    });

    it("returns invalid when multiple required fields are missing", () => {
      const data = {
        name: "John Doe",
        // email and age are missing
      };
      const requiredFields = ["name", "email", "age"];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(["email", "age"]);
    });

    it("handles empty data object", () => {
      const data = {};
      const requiredFields = ["name", "email", "age"];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(["name", "email", "age"]);
    });

    it("handles empty required fields array", () => {
      const data = {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      };
      const requiredFields: string[] = [];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it("handles data with extra fields not in required list", () => {
      const data = {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
        extraField: "should be ignored",
        anotherField: 123,
      };
      const requiredFields = ["name", "email", "age"];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it("handles zero values as valid", () => {
      const data = {
        name: "John Doe",
        email: "john@example.com",
        age: 0,
        count: 0,
      };
      const requiredFields = ["name", "email", "age", "count"];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it("handles false boolean values as valid", () => {
      const data = {
        name: "John Doe",
        email: "john@example.com",
        isActive: false,
        isVerified: false,
      };
      const requiredFields = ["name", "email", "isActive", "isVerified"];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it("handles whitespace-only strings as invalid", () => {
      const data = {
        name: "John Doe",
        email: "   ",
        age: 30,
      };
      const requiredFields = ["name", "email", "age"];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(["email"]);
    });

    it("handles complex nested objects", () => {
      const data = {
        user: {
          name: "John Doe",
          email: "john@example.com",
        },
        settings: {
          theme: "dark",
          notifications: true,
        },
        metadata: null,
      };
      const requiredFields = ["user", "settings", "metadata"];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(["metadata"]);
    });

    it("handles arrays as valid values", () => {
      const data = {
        name: "John Doe",
        email: "john@example.com",
        tags: [],
        permissions: ["read", "write"],
      };
      const requiredFields = ["name", "email", "tags", "permissions"];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it("handles functions as valid values", () => {
      const data = {
        name: "John Doe",
        email: "john@example.com",
        handler: () => console.log("test"),
        validator: function() { return true; },
      };
      const requiredFields = ["name", "email", "handler", "validator"];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it("handles date objects as valid values", () => {
      const data = {
        name: "John Doe",
        email: "john@example.com",
        createdAt: new Date(),
        updatedAt: new Date("2025-01-01"),
      };
      const requiredFields = ["name", "email", "createdAt", "updatedAt"];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });
  });
}); 