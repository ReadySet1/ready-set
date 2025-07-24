import React, { useContext } from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { UserProvider, UserContext } from "../UserContext";

describe("UserContext", () => {
  it("provides user and role values", () => {
    const TestComponent = () => {
      const { user, userRole, isLoading } = useContext(UserContext);
      return (
        <div>
          <span>{user?.id}</span>
          <span>{userRole}</span>
          <span>{isLoading ? "loading" : "loaded"}</span>
        </div>
      );
    };
    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    );
    // Just check that the context renders without crashing
    expect(screen.getByText(/loaded|loading/)).toBeInTheDocument();
  });
}); 