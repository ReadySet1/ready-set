/**
 * Unit Tests for NewClientDialog
 *
 * The dialog collects the identity of a brand-new client (name, vendor, key)
 * and hands back a draft configuration built from the generic template.
 * The DB write happens later, from the editor's "Create Client" button.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NewClientDialog } from '../vendor-pricing/NewClientDialog';
import { GENERIC_TEMPLATE } from '@/lib/calculator/client-configurations';

describe('NewClientDialog', () => {
  const onCreate = jest.fn();
  const onOpenChange = jest.fn();

  function renderDialog(existingIds: string[] = ['kasa']) {
    return render(
      <NewClientDialog
        open
        existingIds={existingIds}
        onOpenChange={onOpenChange}
        onCreate={onCreate}
      />
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('derives the key from the client name until the key is edited by hand', () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/client name/i), { target: { value: 'HY Food Co.' } });
    expect(screen.getByLabelText(/configuration key/i)).toHaveValue('hy-food-co');

    fireEvent.change(screen.getByLabelText(/configuration key/i), { target: { value: 'hy-food' } });
    fireEvent.change(screen.getByLabelText(/client name/i), { target: { value: 'HY Food Company' } });
    expect(screen.getByLabelText(/configuration key/i)).toHaveValue('hy-food');
  });

  it('hands back a draft built from the generic template', () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/client name/i), { target: { value: 'Acme Catering' } });
    fireEvent.change(screen.getByLabelText(/vendor name/i), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    const draft = onCreate.mock.calls[0]![0];
    expect(draft).toMatchObject({
      id: 'acme-catering',
      clientName: 'Acme Catering',
      vendorName: 'Acme',
      isActive: true,
      pricingTiers: GENERIC_TEMPLATE.pricingTiers,
    });
    expect(draft.description).toBeUndefined();
  });

  it('defaults the vendor name to the client name', () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/client name/i), { target: { value: 'Solo Client' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(onCreate.mock.calls[0]![0].vendorName).toBe('Solo Client');
  });

  it('requires a client name', () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText(/client name is required/i)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('rejects a key that already exists', () => {
    renderDialog(['kasa']);

    fireEvent.change(screen.getByLabelText(/client name/i), { target: { value: 'Kasa' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('rejects a malformed key', () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/client name/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/configuration key/i), { target: { value: 'Bad Key' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText(/key must be lowercase/i)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('closes on cancel without creating anything', () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onCreate).not.toHaveBeenCalled();
  });
});
