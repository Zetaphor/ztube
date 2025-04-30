function padZero(num) {
  return num.toString().padStart(2, '0');
}

export function formatViewCount(count) {
  if (count === null || count === undefined) return '0 views';
  // Handle potential string input if parsing failed earlier
  if (typeof count === 'string') {
    const parsedCount = parseInt(count.replace(/,/g, ''), 10);
    if (isNaN(parsedCount)) return '0 views';
    count = parsedCount;
  }

  if (count >= 1000000000) {
    return `${(count / 1000000000).toFixed(1)}B views`;
  }
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M views`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K views`;
  }
  return `${count} views`;
}

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60); // Use floor to avoid decimal seconds

  if (hours > 0) {
    return `${hours}:${padZero(minutes)}:${padZero(secs)}`;
  }
  return `${minutes}:${padZero(secs)}`;
}

// --- Relative Date Formatting --- Needs implementation or a library
export function formatRelativeDate(dateString) {
  if (!dateString) return 'Unknown date';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    let interval = seconds / 31536000; // years
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000; // months
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400; // days
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600; // hours
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60; // minutes
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
  } catch (error) {
    console.error("Error formatting relative date:", error);
    return 'Unknown date'; // Fallback on error
  }
}