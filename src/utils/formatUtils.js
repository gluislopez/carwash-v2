/**
 * Formats a duration in minutes to a human-readable string.
 * Examples:
 * - 90 -> "1h 30m"
 * - 45 -> "45m"
 * - 0 -> "0m"
 * @param {number} minutes - Total minutes
 * @returns {string} Formatted string
 */
export const formatDuration = (minutes) => {
    if (!minutes && minutes !== 0) return '--';
    const cleanMinutes = Math.round(minutes);
    const hrs = Math.floor(cleanMinutes / 60);
    const mins = cleanMinutes % 60;

    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
};
