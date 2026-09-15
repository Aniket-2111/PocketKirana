/**
 * Utility to extract clean, reliable Customer Name and Phone from an order.
 * Handles cases where customerName was stored as a phone number or fallback string.
 */

export function resolveCustomerName(order: any): string {
  if (!order) return 'Customer';

  const addr = order.address || (order as any).deliveryAddress;

  // 1. Check address fullName / name / recipient
  const addrFullName = (addr?.fullName || addr?.name || addr?.receiverName || addr?.recipientName || '').trim();
  if (addrFullName && !isPhoneNumber(addrFullName)) {
    return addrFullName;
  }

  // 2. Check explicit order customerName
  const orderCustName = (order.customerName || (order as any).userName || (order as any).customer?.name || '').trim();
  if (orderCustName && !isPhoneNumber(orderCustName) && orderCustName.toLowerCase() !== 'customer') {
    return orderCustName;
  }

  // 3. Check customer object inside order if populated
  if ((order as any).customer) {
    const c = (order as any).customer;
    const name = (c.name || `${c.firstName || ''} ${c.lastName || ''}`).trim();
    if (name && !isPhoneNumber(name)) {
      return name;
    }
  }

  // 4. Fallback to addrFullName if non-empty
  if (addrFullName) return addrFullName;

  // 5. Fallback to orderCustName if non-empty
  if (orderCustName) return orderCustName;

  return 'Customer';
}

export function resolveCustomerPhone(order: any): string {
  if (!order) return '+91 8698893348';
  const addr = order.address || (order as any).deliveryAddress;
  return (
    order.customerPhone ||
    addr?.phone ||
    (order as any).phone ||
    (order as any).mobile ||
    '+91 8698893348'
  );
}

function isPhoneNumber(str: string): boolean {
  if (!str) return false;
  const cleaned = str.replace(/[\s\-\+\(\)]/g, '');
  return cleaned.length >= 8 && /^\d+$/.test(cleaned);
}
