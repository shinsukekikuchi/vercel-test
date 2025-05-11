import { RawOrderHistoryEntry } from '../types/orderHistory';
import { v4 as uuidv4 } from 'uuid';

const ORDER_HISTORY_STORAGE_KEY = 'funOptionOrderHistory';

/**
 * Retrieves the current order history from local storage.
 * Returns an empty array if no history is found or if there's an error parsing.
 */
export const getOrderHistory = (): RawOrderHistoryEntry[] => {
  try {
    const historyJson = localStorage.getItem(ORDER_HISTORY_STORAGE_KEY);
    if (historyJson) {
      const history = JSON.parse(historyJson) as RawOrderHistoryEntry[];
      // Sort by timestamp descending (newest first)
      return history.sort((a, b) => b.timestamp - a.timestamp);
    }
  } catch (error) {
    console.error('Error retrieving order history from local storage:', error);
  }
  return [];
};

/**
 * Saves a new order entry to the local storage history.
 * It generates an internalId for the entry.
 * @param orderDetails - The details of the order to save, excluding internalId.
 */
export const saveOrderToHistory = (
  orderDetails: Omit<RawOrderHistoryEntry, 'internalId'>
): RawOrderHistoryEntry => {
  const currentHistory = getOrderHistory();
  const newEntry: RawOrderHistoryEntry = {
    ...orderDetails,
    internalId: uuidv4(), // Generate a unique internal ID
  };

  const updatedHistory = [newEntry, ...currentHistory]; // Add new entry to the beginning

  try {
    localStorage.setItem(ORDER_HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error('Error saving order to local storage:', error);
    // Optionally, you might want to handle this error more gracefully,
    // e.g., by notifying the user if storage is full or unavailable.
  }
  return newEntry; // Return the newly created entry with its ID
};

/**
 * Clears all order history from local storage.
 * Useful for testing or providing a reset option.
 */
export const clearOrderHistory = (): void => {
  try {
    localStorage.removeItem(ORDER_HISTORY_STORAGE_KEY);
    console.log('Order history cleared from local storage.');
  } catch (error) {
    console.error('Error clearing order history from local storage:', error);
  }
};
