import { validateEmail } from "../validateEmail";

describe("Email Validation", () => {
  describe("valid emails", () => {
    it("validates simple email addresses", () => {
      expect(validateEmail("test@example.com")).toBeTruthy();
      expect(validateEmail("user@domain.org")).toBeTruthy();
      expect(validateEmail("admin@company.net")).toBeTruthy();
    });

    it("validates emails with subdomains", () => {
      expect(validateEmail("user@sub.domain.com")).toBeTruthy();
      expect(validateEmail("test@mail.company.co.uk")).toBeTruthy();
      expect(validateEmail("admin@dev.example.org")).toBeTruthy();
    });

    it("validates emails with special characters in local part", () => {
      expect(validateEmail("user.name@example.com")).toBeTruthy();
      expect(validateEmail("user+tag@example.com")).toBeTruthy();
      expect(validateEmail("user_name@example.com")).toBeTruthy();
      expect(validateEmail("user-name@example.com")).toBeTruthy();
    });

    it("validates emails with numbers", () => {
      expect(validateEmail("user123@example.com")).toBeTruthy();
      expect(validateEmail("123user@example.com")).toBeTruthy();
      expect(validateEmail("user@123example.com")).toBeTruthy();
    });



    it("validates emails with long TLDs", () => {
      expect(validateEmail("user@example.info")).toBeTruthy();
      expect(validateEmail("admin@company.business")).toBeTruthy();
    });
  });

  describe("invalid emails", () => {
    it("rejects emails without @ symbol", () => {
      expect(validateEmail("testexample.com")).toBeFalsy();
      expect(validateEmail("user.domain.com")).toBeFalsy();
      expect(validateEmail("admincompany.net")).toBeFalsy();
    });

    it("rejects emails without domain", () => {
      expect(validateEmail("test@")).toBeFalsy();
      expect(validateEmail("user@.com")).toBeFalsy();
      expect(validateEmail("admin@.")).toBeFalsy();
    });

    it("rejects emails without local part", () => {
      expect(validateEmail("@example.com")).toBeFalsy();
      expect(validateEmail("@domain.org")).toBeFalsy();
    });

    it("rejects emails with invalid characters", () => {
      expect(validateEmail("test space@example.com")).toBeFalsy();
      expect(validateEmail("user<tag>@example.com")).toBeFalsy();
      expect(validateEmail("admin[test]@example.com")).toBeFalsy();
    });

    it("rejects emails with consecutive dots", () => {
      expect(validateEmail("test..user@example.com")).toBeFalsy();
      expect(validateEmail("user@example..com")).toBeFalsy();
    });

    it("rejects emails starting or ending with dots", () => {
      expect(validateEmail(".test@example.com")).toBeFalsy();
      expect(validateEmail("test.@example.com")).toBeFalsy();
      expect(validateEmail("user@.example.com")).toBeFalsy();
      expect(validateEmail("user@example.com.")).toBeFalsy();
    });

    it("rejects emails with invalid TLDs", () => {
      expect(validateEmail("user@example.c")).toBeFalsy();
      expect(validateEmail("admin@company.123")).toBeFalsy();
    });

    it("rejects empty or whitespace emails", () => {
      expect(validateEmail("")).toBeFalsy();
      expect(validateEmail("   ")).toBeFalsy();
      expect(validateEmail("\t\n")).toBeFalsy();
    });

    it("rejects non-string inputs", () => {
      expect(validateEmail(null as any)).toBeFalsy();
      expect(validateEmail(undefined as any)).toBeFalsy();
      expect(validateEmail(123 as any)).toBeFalsy();
      expect(validateEmail({} as any)).toBeFalsy();
    });
  });

  describe("case sensitivity", () => {
    it("handles mixed case emails", () => {
      expect(validateEmail("User@Example.com")).toBeTruthy();
      expect(validateEmail("USER@DOMAIN.COM")).toBeTruthy();
      expect(validateEmail("user@EXAMPLE.COM")).toBeTruthy();
    });
  });

  describe("edge cases", () => {
    it("handles very long local parts", () => {
      const longLocal = "a".repeat(64) + "@example.com";
      expect(validateEmail(longLocal)).toBeTruthy();
    });

    it("handles very long domains", () => {
      const longDomain = "user@" + "a".repeat(63) + ".com";
      expect(validateEmail(longDomain)).toBeTruthy();
    });


  });
}); 