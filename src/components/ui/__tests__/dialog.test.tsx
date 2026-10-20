import React from 'react';
import { render, screen } from '@testing-library/react';

import { Dialog, DialogContent, DialogTitle } from '../dialog';

function renderOpenDialog(className?: string) {
  render(
    <Dialog open>
      <DialogContent className={className} data-testid="dialog-content">
        <DialogTitle>Order Confirmed!</DialogTitle>
        <p>Body</p>
      </DialogContent>
    </Dialog>,
  );
  return screen.getByTestId('dialog-content');
}

describe('DialogContent', () => {
  it('caps its height to the visible viewport and scrolls vertically', () => {
    const content = renderOpenDialog();

    expect(content).toHaveClass('max-h-[calc(100dvh-2rem)]');
    expect(content).toHaveClass('overflow-y-auto');
  });

  it('still merges a consumer className', () => {
    const content = renderOpenDialog('sm:max-w-md');

    expect(content).toHaveClass('sm:max-w-md');
    expect(content).toHaveClass('max-h-[calc(100dvh-2rem)]');
    expect(content).toHaveClass('overflow-y-auto');
  });

  it('lets a consumer override the height cap and overflow', () => {
    const content = renderOpenDialog('max-h-[90vh] overflow-hidden');

    expect(content).toHaveClass('max-h-[90vh]');
    expect(content).toHaveClass('overflow-hidden');
    expect(content).not.toHaveClass('max-h-[calc(100dvh-2rem)]');
    expect(content).not.toHaveClass('overflow-y-auto');
  });
});
