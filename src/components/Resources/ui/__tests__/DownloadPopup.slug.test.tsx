import React from "react";
import { render } from "@testing-library/react";

const leadCaptureProps = jest.fn();
jest.mock("../LeadCaptureForm", () => ({
  __esModule: true,
  default: (props: any) => {
    leadCaptureProps(props);
    return null;
  },
}));

import { DownloadPopup } from "../DownloadPopup";

describe("DownloadPopup resource slug", () => {
  it("uses the explicit slug (the Sanity guide slug) when given", () => {
    render(
      <DownloadPopup isOpen onClose={jest.fn()} title="Catering Delivery Checklist!" resourceSlug="catering-checklist" />,
    );

    expect(leadCaptureProps).toHaveBeenCalledWith(
      expect.objectContaining({ resourceSlug: "catering-checklist" }),
    );
  });
});
