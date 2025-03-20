const getDomainFromEmail = (email) => {
  const atIndex = email.lastIndexOf('@');
  return atIndex === -1 ? '' : email.slice(atIndex + 1).toLowerCase();
};

module.exports = { getDomainFromEmail };
