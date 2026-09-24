import { useEffect, useRef, useId } from 'react';
import { registerBackHandler, unregisterBackHandler } from '../utils/nativeBackManager';

/**
 * useNativeBack Hook
 * 
 * Declaratively traps the Android hardware Back button / gesture navigation
 * on mobile views and APK wrappers.
 * 
 * @param {Function} handler - Callback to execute when back button is pressed.
 * @param {boolean} isEnabled - Whether this handler is active (e.g. modal is open).
 * @param {Object} options
 * @param {string} [options.id] - Unique identifier (defaults to random string).
 * @param {number} [options.priority=10] - Priority level:
 *   - 30: Confirmation Dialogs / Critical Alerts
 *   - 25: Full-screen readers / Drawers
 *   - 20: Modals (Book overview, Edit, Share)
 *   - 5:  Sub-tab navigation (Projects, Settings -> Home)
 * @param {string} [options.label] - Debug label
 */
export const useNativeBack = (handler, isEnabled = true, options = {}) => {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  const generatedId = useId();
  const currentId = options.id || generatedId;
  const priority = options.priority !== undefined ? options.priority : 10;
  const label = options.label || '';

  useEffect(() => {
    if (!isEnabled) {
      unregisterBackHandler(currentId);
      return;
    }

    registerBackHandler({
      id: currentId,
      handler: () => {
        if (handlerRef.current) {
          return handlerRef.current();
        }
      },
      priority,
      label
    });

    return () => {
      unregisterBackHandler(currentId);
    };
  }, [isEnabled, priority, label, currentId]);
};

export default useNativeBack;
