/**
 * Duplicate Code Block A
 * This file and duplicate-code-b.ts contain intentionally duplicated code
 * to trigger jscpd detection
 */

export function processUserData(userData: {
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
  if (!userData.firstName || userData.firstName.length < 2) {
    throw new Error('First name must be at least 2 characters');
  }

  // Validate last name
  if (!userData.lastName || userData.lastName.length < 2) {
    throw new Error('Last name must be at least 2 characters');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userData.email)) {
    throw new Error('Invalid email format');
  }

  // Validate age
  if (userData.age < 0 || userData.age > 150) {
    throw new Error('Age must be between 0 and 150');
  }

  // Validate address
  if (!userData.address.street || userData.address.street.length < 5) {
    throw new Error('Street address must be at least 5 characters');
  }

  if (!userData.address.city || userData.address.city.length < 2) {
    throw new Error('City must be at least 2 characters');
  }

  if (!userData.address.state || userData.address.state.length !== 2) {
    throw new Error('State must be 2 characters');
  }

  if (!userData.address.zip || !/^\d{5}(-\d{4})?$/.test(userData.address.zip)) {
    throw new Error('Invalid ZIP code format');
  }

  // Process the validated data
  return {
    fullName: `${userData.firstName} ${userData.lastName}`,
    email: userData.email.toLowerCase(),
    age: userData.age,
    formattedAddress: `${userData.address.street}, ${userData.address.city}, ${userData.address.state} ${userData.address.zip}`,
  };
}
