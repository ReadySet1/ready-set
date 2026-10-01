import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  editOrderSchema,
  EditOrderFormData,
  EditOrderFormInput,
} from '../edit-order-form';

// Same wiring as EditOrderDialog: a number input registered without
// valueAsNumber, validated by editOrderSchema through zodResolver.
const HeadcountForm = ({
  onValid,
  onInvalid,
}: {
  onValid: (data: EditOrderFormData) => void;
  onInvalid: () => void;
}) => {
  const { register, handleSubmit } = useForm<EditOrderFormInput, unknown, EditOrderFormData>({
    resolver: zodResolver(editOrderSchema),
    defaultValues: { headcount: 50, orderTotal: 250 },
  });

  return (
    <form onSubmit={handleSubmit(onValid, onInvalid)}>
      <label htmlFor="headcount">Headcount</label>
      <input id="headcount" type="number" {...register('headcount')} />
      <label htmlFor="orderTotal">Order Total</label>
      <input id="orderTotal" type="number" step="0.01" {...register('orderTotal')} />
      <button type="submit">Save</button>
    </form>
  );
};

describe('edit order form number inputs', () => {
  it('submits a typed headcount as a number', async () => {
    const onValid = jest.fn();
    const onInvalid = jest.fn();
    render(<HeadcountForm onValid={onValid} onInvalid={onInvalid} />);

    await userEvent.clear(screen.getByLabelText('Headcount'));
    await userEvent.type(screen.getByLabelText('Headcount'), '60');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onValid).toHaveBeenCalled());
    expect(onInvalid).not.toHaveBeenCalled();
    expect(onValid.mock.calls[0][0]).toMatchObject({ headcount: 60, orderTotal: 250 });
  });

  it('submits a cleared order total as null', async () => {
    const onValid = jest.fn();
    const onInvalid = jest.fn();
    render(<HeadcountForm onValid={onValid} onInvalid={onInvalid} />);

    await userEvent.clear(screen.getByLabelText('Order Total'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onValid).toHaveBeenCalled());
    expect(onValid.mock.calls[0][0]).toMatchObject({ headcount: 50, orderTotal: null });
  });
});
