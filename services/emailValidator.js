const dns = require('dns').promises;
const net = require('net');
const { emailRegex, validateLength, checkTypos } = require('../utils/regexValidator');
const disposableDomains = require('../utils/disposableDomains');
const { checkEmailExistence } = require('./smtpChecker');
const { getDomainFromEmail } = require('../utils/emailUtils');
const { logger } = require('../utils/logger');

// Role-based patterns
const roleBased = [
  'admin', 'administrator', 'webmaster', 'hostmaster', 'postmaster',
  'support', 'info', 'contact', 'sales', 'marketing', 'help', 'noreply'
];

// Comprehensive DNS validation
const validateDNS = async (domain) => {
  try {
    const results = await Promise.all([
      dns.resolveMx(domain).catch(() => null),
      dns.resolve(domain, 'A').catch(() => null),
      dns.resolve(domain, 'TXT').catch(() => null)
    ]);

    const [mxRecords, aRecords, txtRecords] = results;
    
    // Check MX records
    const hasMX = mxRecords && mxRecords.length > 0;
    
    // Check A records as fallback
    const hasA = aRecords && aRecords.length > 0;
    
    // Check SPF record
    const hasSPF = txtRecords && txtRecords.some(record => {
      // Handle arrays returned by some DNS servers
      const recordText = Array.isArray(record) ? record[0] : record;
      return recordText.toLowerCase().includes('v=spf1');
    });

    // Check DMARC record
    let dmarcResult;
    try {
      dmarcResult = await dns.resolveTxt(`_dmarc.${domain}`);
    } catch {
      dmarcResult = null;
    }

    const hasDMARC = dmarcResult && dmarcResult.some(record => {
      const recordText = Array.isArray(record) ? record[0] : record;
      return recordText.toLowerCase().includes('v=dmarc1');
    });

    return {
      valid: hasMX || hasA,
      details: {
        mx: { valid: hasMX, count: mxRecords?.length || 0 },
        a: { valid: hasA, count: aRecords?.length || 0 },
        spf: { valid: hasSPF },
        dmarc: { valid: hasDMARC }
      },
      message: hasMX ? 'Valid mail server found' : (hasA ? 'Fallback mail server found' : 'No mail server found')
    };
  } catch (error) {
    logger.error('DNS validation error:', error);
    return {
      valid: false,
      details: {
        mx: { valid: false },
        a: { valid: false },
        spf: { valid: false },
        dmarc: { valid: false }
      },
      message: 'DNS validation failed'
    };
  }
};

// Enhanced domain validation
const validateDomain = async (domain) => {
  // Common free email providers
  const freeProviders = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'protonmail.com', 'mail.com', 'zoho.com'
  ];

  const isDomainDisposable = disposableDomains.includes(domain.toLowerCase());
  const isFreeProvider = freeProviders.includes(domain.toLowerCase());
  
  return {
    valid: !isDomainDisposable,
    details: {
      disposable: isDomainDisposable,
      freeProvider: isFreeProvider,
      corporate: !isFreeProvider && !isDomainDisposable
    },
    quality: isDomainDisposable ? 'low' : (isFreeProvider ? 'medium' : 'high'),
    message: isDomainDisposable ? 'Disposable email detected' : 
             (isFreeProvider ? 'Free email provider' : 'Corporate email')
  };
};

// Comprehensive email validation
const validateEmail = async (email, options = {}) => {
  const {
    checkSMTP = true,
    timeout = 5000,
    validateDNS: doDNSValidation = true,
    detectRoles = true
  } = options;

  try {
    if (!email) {
      return {
        valid: false,
        score: 0,
        details: {
          syntax: { valid: false, message: 'Email is required' },
          dns: null,
          domain: null,
          smtp: null
        }
      };
    }

    // Step 1: Basic syntax and length validation
    const lengthCheck = validateLength(email);
    if (!lengthCheck.isValid) {
      return {
        valid: false,
        score: 0,
        details: {
          syntax: { valid: false, message: lengthCheck.errors.join(', ') },
          dns: null,
          domain: null,
          smtp: null
        }
      };
    }

    // Step 2: RFC 5322 regex validation
    if (!emailRegex.test(email)) {
      return {
        valid: false,
        score: 0,
        details: {
          syntax: { valid: false, message: 'Invalid email format' },
          dns: null,
          domain: null,
          smtp: null
        }
      };
    }

    const domain = getDomainFromEmail(email);
    const [localPart] = email.split('@');

    // Step 3: Check for typos
    const typoCheck = checkTypos(email);

    // Step 4: Domain validation
    const domainResult = await validateDomain(domain);

    // Step 5: DNS validation if enabled
    const dnsResult = doDNSValidation ? await validateDNS(domain) : null;

    // Step 6: Role detection if enabled
    const roleResult = detectRoles ? {
      isRole: roleBased.some(role => localPart.toLowerCase().includes(role)),
      role: roleBased.find(role => localPart.toLowerCase().includes(role))
    } : null;

    // Step 7: SMTP validation if enabled and DNS is valid
    let smtpResult = null;
    if (checkSMTP && dnsResult?.valid) {
      try {
        smtpResult = await checkEmailExistence(email, timeout);
      } catch (error) {
        logger.error('SMTP validation error:', error);
        smtpResult = {
          valid: domainResult.quality !== 'low',
          message: 'SMTP validation limited',
          error: error.message
        };
      }
    }

    // Calculate final score (0-100)
    let score = 0;
    if (emailRegex.test(email)) score += 25;
    if (dnsResult?.valid) score += 25;
    if (domainResult.valid) score += 25;
    if (smtpResult?.valid) score += 25;
    
    // Penalty factors
    if (domainResult.quality === 'low') score = Math.min(score, 40);
    if (roleResult?.isRole) score = Math.min(score, 60);
    if (typoCheck.hasTypos) score = Math.max(0, score - 10);

    // Determine overall validity (score >= 70 is considered valid)
    const valid = score >= 70;

    return {
      valid,
      score,
      details: {
        syntax: { valid: true, message: '' },
        dns: dnsResult,
        domain: domainResult,
        role: roleResult,
        smtp: smtpResult,
        typos: typoCheck.hasTypos ? typoCheck : null
      },
      suggestions: [
        ...(domainResult.quality === 'low' ? ['Consider using a corporate email address'] : []),
        ...(roleResult?.isRole ? ['Consider using a personal email address'] : []),
        ...(typoCheck.suggestions || [])
      ]
    };

  } catch (error) {
    logger.error('Email validation error:', error);
    return {
      valid: false,
      score: 0,
      error: error.message,
      details: {
        syntax: { valid: false, message: 'Validation failed' },
        dns: null,
        domain: null,
        smtp: null
      }
    };
  }
};

module.exports = { validateEmail };
