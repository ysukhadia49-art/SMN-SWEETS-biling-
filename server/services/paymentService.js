/**
 * Standard Payment Helpers & Currency Converters
 * Operates standard non-hardware payment modes: Cash, UPI, Card, Bank Transfer, Split
 * Dynamic QR generation and external payment hardware have been completely removed.
 */

function toPaise(rupees) {
  return Math.round((Number(rupees) + Number.EPSILON) * 100);
}

function fromPaise(paise) {
  return Math.round((Number(paise) / 100 + Number.EPSILON) * 100) / 100;
}

module.exports = {
  toPaise,
  fromPaise
};
