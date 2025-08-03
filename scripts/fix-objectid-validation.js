const { ObjectId } = require('mongodb');

/**
 * Safely create an ObjectId from a value
 * Returns null if the value cannot be converted to ObjectId
 */
function safeObjectId(value) {
  if (!value) return null;
  
  // If already an ObjectId, return it
  if (value instanceof ObjectId) {
    return value;
  }
  
  // Convert to string and check validity
  const str = value.toString();
  
  // Check if it's a valid 24-character hex string
  if (typeof str === 'string' && /^[0-9a-fA-F]{24}$/.test(str)) {
    try {
      return new ObjectId(str);
    } catch (error) {
      console.warn(`Failed to create ObjectId from: ${str}`, error.message);
      return null;
    }
  }
  
  return null;
}

/**
 * Check if a value is a valid ObjectId or can be converted to one
 */
function isValidObjectId(value) {
  if (!value) return false;
  
  // If already an ObjectId, it's valid
  if (value instanceof ObjectId) {
    return true;
  }
  
  // Check if string is valid ObjectId format
  const str = value.toString();
  return typeof str === 'string' && /^[0-9a-fA-F]{24}$/.test(str);
}

/**
 * Convert a value to ObjectId string
 * Returns the original value if it cannot be converted
 */
function toObjectIdString(value) {
  const objectId = safeObjectId(value);
  return objectId ? objectId.toString() : value;
}

module.exports = {
  safeObjectId,
  isValidObjectId,
  toObjectIdString
};