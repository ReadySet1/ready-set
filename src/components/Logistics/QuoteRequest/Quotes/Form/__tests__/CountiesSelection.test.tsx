/**
 * Board card pr-followup-fulton-counties-typing: the quote-request county
 * picker listed California and Texas only, while every other county list in
 * the app (sign-up, profile, address manager, /api/user-counties) already
 * offers Fulton (Georgia).
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { CountiesSelection } from "../CountiesSelection";

function Harness({ onSubmit }: { onSubmit: (values: { counties: string[] }) => void }) {
  const { register, handleSubmit } = useForm<{ counties: string[] }>({
    defaultValues: { counties: [] },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CountiesSelection register={register} />
      <button type="submit">submit</button>
    </form>
  );
}

describe("CountiesSelection", () => {
  it("offers Fulton under a Georgia group", () => {
    render(<Harness onSubmit={jest.fn()} />);

    expect(screen.getByRole("heading", { name: "Georgia" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Fulton" })).toBeInTheDocument();
  });

  it("keeps the existing California and Texas groups", () => {
    render(<Harness onSubmit={jest.fn()} />);

    expect(screen.getByRole("heading", { name: "California" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Texas" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Alameda" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Dallas" })).toBeInTheDocument();
  });

  it("submits Fulton in the counties array when checked", async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Fulton" }));
    await userEvent.click(screen.getByRole("button", { name: "submit" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ counties: ["Fulton"] }),
      expect.anything(),
    );
  });
});
