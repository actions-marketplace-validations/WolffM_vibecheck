/**
 * Duplicate Code Block B
 * This is intentionally duplicated from duplicate-code-a.ts
 * to trigger jscpd detection
 */

export function processCustomerData(customerData: {
  firstName: string;
  lastName: string;
  email: string;
  age: number;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
}) {
  // Validate first name
  if (!customerData.firstName || customerData.firstName.length < 2) {
    throw new Error('First name must be at least 2 characters');
  }

  // Validate last name
  if (!customerData.lastName || customerData.lastName.length < 2) {
    throw new Error('Last name must be at least 2 characters');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customerData.email)) {
    throw new Error('Invalid email format');
  }

  // Validate age
  if (customerData.age < 0 || customerData.age > 150) {
    throw new Error('Age must be between 0 and 150');
  }

  // Validate address
  if (!customerData.address.street || customerData.address.street.length < 5) {
    throw new Error('Street address must be at least 5 characters');
  }

  if (!customerData.address.city || customerData.address.city.length < 2) {
    throw new Error('City must be at least 2 characters');
  }

  if (!customerData.address.state || customerData.address.state.length !== 2) {
    throw new Error('State must be 2 characters');
  }

  if (!customerData.address.zip || !/^\d{5}(-\d{4})?$/.test(customerData.address.zip)) {
    throw new Error('Invalid ZIP code format');
  }

  // Process the validated data
  return {
    fullName: `${customerData.firstName} ${customerData.lastName}`,
    email: customerData.email.toLowerCase(),
    age: customerData.age,
    formattedAddress: `${customerData.address.street}, ${customerData.address.city}, ${customerData.address.state} ${customerData.address.zip}`,
  };
}
