import { buildOrderUpdatePayload, editOrderSchema, toOrderFormValues } from '../edit-order-form';
import { Order } from '@/types/order';

const cateringOrder = (overrides: Record<string, unknown> = {}): Order =>
  ({
    id: 'order-123',
    orderNumber: 'CAT001',
    order_type: 'catering',
    status: 'ACTIVE',
    pickupDateTime: '2025-02-15T10:00:00Z',
    arrivalDateTime: '2025-02-15T11:00:00Z',
    headcount: 50,
    brokerage: 'Test Brokerage',
    needHost: 'YES',
    hoursNeeded: 4,
    numberOfHosts: 2,
    orderTotal: '250.00',
    tip: '25.00',
    appliedDiscount: '10.00',
    deliveryCost: '50.00',
    clientAttention: 'John Smith',
    pickupNotes: 'Back entrance',
    specialNotes: 'Handle with care',
    ...overrides,
  }) as unknown as Order;

/** Submit the form exactly as it was opened, after an optional edit. */
const submit = (order: Order, edit: Record<string, unknown> = {}) =>
  buildOrderUpdatePayload({ ...toOrderFormValues(order), ...edit }, order);

describe('buildOrderUpdatePayload', () => {
  it('sends nothing when the form is saved unchanged', () => {
    expect(submit(cateringOrder())).toEqual({});
  });

  it('sends only the edited field', () => {
    expect(submit(cateringOrder(), { specialNotes: 'Gate code 4411' })).toEqual({
      specialNotes: 'Gate code 4411',
    });
  });

  it.each([
    ['a Decimal string', '0'],
    ['a number', 0],
  ])('does not send orderTotal for a $0.00 order whose total arrives as %s', (_, total) => {
    // A notes-only save must not turn the $0.00 default into an explicit null,
    // which the server rejects when the order has no headcount either.
    const order = cateringOrder({ headcount: null, orderTotal: total });

    expect(submit(order, { specialNotes: 'Gate code 4411' })).toEqual({
      specialNotes: 'Gate code 4411',
    });
  });

  it('does not resend unchanged pickup and arrival times', () => {
    expect(submit(cateringOrder())).not.toHaveProperty('pickupDateTime');
    expect(submit(cateringOrder())).not.toHaveProperty('arrivalDateTime');
  });

  it('sends a changed arrival time', () => {
    const arrival = new Date('2025-02-15T12:30:00Z');

    expect(submit(cateringOrder(), { arrivalDateTime: arrival })).toEqual({
      arrivalDateTime: arrival.toISOString(),
    });
  });

  it('does not clear zero-valued tip, discount or delivery cost on an unrelated save', () => {
    const order = cateringOrder({ tip: '0.00', appliedDiscount: '0.00', deliveryCost: 0 });

    expect(submit(order)).toEqual({});
  });

  it('does not send headcount: null when the order has no headcount field at all', () => {
    const order = cateringOrder();
    delete (order as any).headcount;

    expect(submit(order)).not.toHaveProperty('headcount');
  });

  it('still sends a deliberate change to orderTotal', () => {
    expect(submit(cateringOrder(), { orderTotal: 300 })).toEqual({ orderTotal: 300 });
  });

  it('still sends a deliberate clear of headcount', () => {
    expect(submit(cateringOrder(), { headcount: null })).toEqual({ headcount: null });
  });
});

// `<input type="number" {...register(...)}>` hands react-hook-form the typed
// text, so the schema receives strings ("60", "") rather than numbers.
describe('editOrderSchema with raw input strings', () => {
  it('turns typed numbers into numbers', () => {
    const result = editOrderSchema.parse({
      headcount: '60',
      hoursNeeded: '2.5',
      orderTotal: '300.50',
      tip: '0',
    });

    expect(result).toMatchObject({ headcount: 60, hoursNeeded: 2.5, orderTotal: 300.5, tip: 0 });
  });

  it('turns a cleared number field into null', () => {
    const result = editOrderSchema.parse({ headcount: '', orderTotal: '', weight: '' });

    expect(result).toMatchObject({ headcount: null, orderTotal: null, weight: null });
  });

  it('still rejects text that is not a number', () => {
    expect(editOrderSchema.safeParse({ orderTotal: 'abc' }).success).toBe(false);
  });

  it('still applies each field rule', () => {
    expect(editOrderSchema.safeParse({ headcount: '1.5' }).success).toBe(false);
    expect(editOrderSchema.safeParse({ tip: '-5' }).success).toBe(false);
  });

  it('sends a headcount typed in the dialog as a number', () => {
    const order = cateringOrder();
    const data = editOrderSchema.parse({ ...toOrderFormValues(order), headcount: '60' });

    expect(buildOrderUpdatePayload(data, order)).toEqual({ headcount: 60 });
  });

  it('sends a cleared order total as null', () => {
    const order = cateringOrder();
    const data = editOrderSchema.parse({ ...toOrderFormValues(order), orderTotal: '' });

    expect(buildOrderUpdatePayload(data, order)).toEqual({ orderTotal: null });
  });
});
