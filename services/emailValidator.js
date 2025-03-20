const dns = require('dns').promises;
const net = require('net');
const { emailRegex } = require('../utils/regexValidator');
const disposableDomains = require('../utils/disposableDomains');
const { checkEmailExistence } = require('./smtpChecker');
const { getDomainFromEmail } = require('../utils/emailUtils');
const { logger } = require('../utils/logger');

// RFC 5322 compliant email validation
const validateSyntax = (email) => {
  if (!email) return { valid: false, message: 'Email is required' };
  
  // Check email length
  if (email.length > 254) return { valid: false, message: 'Email too long' };
  
  // Local part length
  const [localPart] = email.split('@');
  if (localPart.length > 64) return { valid: false, message: 'Local part too long' };

  // RFC 5322 regex validation
  const valid = emailRegex.test(email);
  if (!valid) return { valid: false, message: 'Invalid email format' };

  return { valid: true, message: '' };
};

// Comprehensive DNS validation
const validateDNS = async (domain) => {
  try {
    const results = await Promise.all([
      dns.resolveMx(domain),
      dns.resolve(domain, 'A'),
      dns.resolve(domain, 'TXT')
    ]).catch(err => {
      logger.error('DNS resolution error:', err);
      return [null, null, null];
    });

    const [mxRecords, aRecords, txtRecords] = results;
    
    // Check MX records
    const hasMX = mxRecords && mxRecords.length > 0;
    
    // Check A records as fallback
    const hasA = aRecords && aRecords.length > 0;
    
    // Check SPF record
    const hasSPF = txtRecords && txtRecords.some(record => 
      record.toLowerCase().includes('v=spf1')
    );

    // Check DMARC record
    const dmarcResult = await dns.resolveTxt(`_dmarc.${domain}`).catch(() => null);
    const hasDMARC = dmarcResult && dmarcResult.some(record => 
      record[0].toLowerCase().includes('v=dmarc1')
    );

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

// Enhanced disposable email detection
const validateDomain = async (domain) => {
  // Common free email providers
  const freeProviders = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'protonmail.com', 'mail.com', 'zoho.com'
  ];

  // Role-based email patterns
  const roleBased = [
    'admin', 'administrator', 'webmaster', 'hostmaster', 'postmaster',
    'support', 'info', 'contact', 'sales', 'marketing', 'help', 'noreply'
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
    // Step 1: Syntax validation
    const syntaxResult = validateSyntax(email);
    if (!syntaxResult.valid) {
      return {
        valid: false,
        score: 0,
        details: {
          syntax: syntaxResult,
          dns: null,
          domain: null,
          smtp: null
        }
      };
    }

    const domain = getDomainFromEmail(email);
    const [localPart] = email.split('@');

    // Step 2: Domain validation
    const domainResult = await validateDomain(domain);

    // Step 3: DNS validation
    const dnsResult = doDNSValidation ? await validateDNS(domain) : null;

    // Step 4: Role detection
    const roleResult = detectRoles ? {
      isRole: roleBased.some(role => localPart.toLowerCase().includes(role)),
      role: roleBased.find(role => localPart.toLowerCase().includes(role))
    } : null;

    // Step 5: SMTP validation
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
    if (syntaxResult.valid) score += 25;
    if (dnsResult?.valid) score += 25;
    if (domainResult.valid) score += 25;
    if (smtpResult?.valid) score += 25;
    if (domainResult.quality === 'low') score = Math.min(score, 40);

    // Determine overall validity
    const valid = score >= 70;

    return {
      valid,
      score,
      details: {
        syntax: syntaxResult,
        dns: dnsResult,
        domain: domainResult,
        role: roleResult,
        smtp: smtpResult
      },
      suggestions: domainResult.quality === 'low' ? 
        ['Consider using a corporate email address'] : 
        (roleResult?.isRole ? ['Consider using a personal email address'] : [])
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
