const dns = require('dns').promises;
const { emailRegex } = require('../utils/regexValidator');
const disposableDomains = require('../utils/disposableDomains');
const { checkEmailExistence } = require('./smtpChecker');
const { getDomainFromEmail } = require('../utils/emailUtils');

const isDisposableDomain = (domain) => disposableDomains.includes(domain);

const validateSyntax = (email) => {
  const valid = emailRegex.test(email);
  return {
    valid,
    message: valid ? '' : 'Invalid email format',
  };
};

const checkMXRecords = async (domain) => {
  try {
    const records = await dns.resolveMx(domain);
    const valid = records.length > 0;
    return {
      valid,
      message: valid ? '' : 'No MX records found',
    };
  } catch (error) {
    return { valid: false, message: 'DNS resolution failed' };
  }
};

const isCommonTypo = (domain) => {
  const knownTypos = {
    'gamil.com': 'gmail.com',
    'yhaoo.com': 'yahoo.com',
    'hotmall.com': 'hotmail.com',
  };
  return knownTypos[domain] || null;
};

const validateEmail = async (email, { checkSmtp = false } = {}) => {
  const domain = getDomainFromEmail(email);
  const syntax = validateSyntax(email);
  const disposable = isDisposableDomain(domain);
  let mx = { valid: true };
  let typoSuggestion = null;
  let smtp = { valid: true };

  if (domain) {
    mx = await checkMXRecords(domain);
    typoSuggestion = isCommonTypo(domain);

    if (checkSmtp) {
      try {
        smtp = await checkEmailExistence(email);
      } catch (error) {
        smtp = {
          valid: false,
          message: `SMTP error: ${error.message}`,
        };
      }
    }
  }

  return {
    valid: syntax.valid && mx.valid && !disposable && smtp.valid,
    details: {
      syntax,
      mx,
      disposable: disposable ? { valid: false, message: 'Disposable domain' } : { valid: true },
      typo: typoSuggestion
        ? {
            suggestedDomain: typoSuggestion,
            message: `Did you mean ${email.split('@')[0]}@${typoSuggestion}?`,
          }
        : null,
      smtp,
    },
  };
};

module.exports = { validateEmail };
