// RFC 5322 Official Standard Email Regex
// This regex is highly accurate and follows the email specification
const emailRegex = /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/i;

// Additional validation patterns
const patterns = {
  // Local part patterns
  localPartMaxLength: 64,
  domainMaxLength: 255,
  
  // Common typo patterns
  typoPatterns: {
    repeatedDots: /\.{2,}/,
    leadingDot: /^\./,
    trailingDot: /\.$/,
    consecutiveDashes: /-{2,}/,
    misplacedAt: /@.*@/,
    commonTypos: {
      'gmial': 'gmail',
      'gmal': 'gmail',
      'gamil': 'gmail',
      'gnail': 'gmail',
      'gmaik': 'gmail',
      'yahooo': 'yahoo',
      'yaho': 'yahoo',
      'yahhoo': 'yahoo',
      'hotmial': 'hotmail',
      'hotmal': 'hotmail',
      'hotmai': 'hotmail',
      'outllok': 'outlook',
      'outlok': 'outlook',
      'oultook': 'outlook'
    }
  },

  // TLD patterns
  validTLDs: [
    'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'eu', 'info', 'biz',
    'co.uk', 'com.au', 'co.jp', 'ca', 'de', 'fr', 'it', 'es', 'ch', 'nl',
    'be', 'at', 'dk', 'se', 'no', 'fi', 'ie', 'nz', 'kr', 'cn', 'in', 'br'
  ],

  // Unicode email support (if needed)
  unicodeEmailRegex: /^(?:[\p{L}0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[\p{L}0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[\p{L}0-9](?:[\p{L}0-9-]*[\p{L}0-9])?\.)+[\p{L}0-9](?:[\p{L}0-9-]*[\p{L}0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[\p{L}0-9-]*[\p{L}0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/u
};

// Helper functions for validation
const validateLength = (email) => {
  const [localPart, domain] = email.split('@');
  return {
    isValid: localPart.length <= patterns.localPartMaxLength && 
             domain.length <= patterns.domainMaxLength,
    errors: []
      .concat(localPart.length > patterns.localPartMaxLength ? ['Local part too long'] : [])
      .concat(domain.length > patterns.domainMaxLength ? ['Domain too long'] : [])
  };
};

const checkTypos = (email) => {
  const [localPart, domain] = email.split('@');
  const domainWithoutTLD = domain.split('.')[0];
  
  const typos = [];
  
  // Check for repeated characters
  if (patterns.typoPatterns.repeatedDots.test(email)) {
    typos.push('Repeated dots found');
  }
  
  // Check for misplaced @ symbols
  if (patterns.typoPatterns.misplacedAt.test(email)) {
    typos.push('Multiple @ symbols found');
  }
  
  // Check for common domain typos
  const suggestedDomain = patterns.typoPatterns.commonTypos[domainWithoutTLD];
  if (suggestedDomain) {
    typos.push(`Possible typo: Did you mean ${suggestedDomain}?`);
  }
  
  return {
    hasTypos: typos.length > 0,
    typos,
    suggestions: suggestedDomain ? [`${localPart}@${suggestedDomain}.${domain.split('.').slice(1).join('.')}`] : []
  };
};

module.exports = {
  emailRegex,
  patterns,
  validateLength,
  checkTypos
};
