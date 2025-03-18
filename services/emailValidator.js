const dns = require('dns').promises;
const { emailRegex } = require('../utils/regexValidator');
const disposableDomains = require('../utils/disposableDomains');

const isDisposableDomain = (domain) => disposableDomains.includes(domain);

const getDomainFromEmail = (email) => {
  const atIndex = email.lastIndexOf('@');
  return atIndex === -1 ? '' : email.slice(atIndex + 1).toLowerCase();
};

const validateSyntax = (email) => ({
  valid: emailRegex.test(email),
  message: 'Invalid email format'
});

const checkMXRecords = async (domain) => {
  try {
    const records = await dns.resolveMx(domain);
    return { valid: records.length > 0, message: 'No MX records found' };
  } catch (error) {
    return { valid: false, message: 'DNS resolution failed' };
  }
};

const isCommonTypo = (domain) => {
  const knownTypos = {
    'gamil.com': 'gmail.com',
    'yhaoo.com': 'yahoo.com',
    'hotmall.com': 'hotmail.com'
  };
  return knownTypos[domain] || null;
};

const validateEmail = async (email, { checkSmtp = false } = {}) => {
  const domain = getDomainFromEmail(email);
  const syntax = validateSyntax(email);
  const disposable = isDisposableDomain(domain);
  let mx = { valid: true };
  let typoSuggestion = null;

  if (domain) {
    mx = await checkMXRecords(domain);
    typoSuggestion = isCommonTypo(domain);
  }

  return {
    valid: syntax.valid && mx.valid && !disposable,
    details: {
      syntax,
      mx,
      disposable: disposable ? { valid: false, message: 'Disposable domain' } : { valid: true },
      typo: typoSuggestion ? {
        suggestedDomain: typoSuggestion,
        message: `Did you mean ${email.split('@')[0]}@${typoSuggestion}?`
      } : null
    }
  };
};

module.exports = { validateEmail };
