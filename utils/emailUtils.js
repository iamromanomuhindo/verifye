const getDomainFromEmail = (email) => {
  const atIndex = email.lastIndexOf('@');
  return atIndex === -1 ? '' : email.slice(atIndex + 1).toLowerCase();
};

const getLocalPartFromEmail = (email) => {
  const atIndex = email.lastIndexOf('@');
  return atIndex === -1 ? email : email.slice(0, atIndex);
};

const normalizeEmail = (email) => {
  if (!email) return '';
  email = email.trim().toLowerCase();
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  
  // Remove dots from Gmail addresses
  if (domain === 'gmail.com') {
    return `${localPart.replace(/\./g, '')}@${domain}`;
  }
  
  return email;
};

const sanitizeEmail = (email) => {
  if (!email) return '';
  return email
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '') // Remove all whitespace
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/^['"]+|['"]+$/g, ''); // Remove quotes
};

module.exports = {
  getDomainFromEmail,
  getLocalPartFromEmail,
  normalizeEmail,
  sanitizeEmail
};
