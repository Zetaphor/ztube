import { formatTime } from './utils.js';

// Store reference to ytPlayer when available
let ytPlayerInstance = null;

// Global state for segments
let sponsorSegments = [];

// Define colors for different segment types
const segmentColors = {
  sponsor: 'rgba(239, 68, 68, 0.6)', // Red
  selfpromo: 'rgba(34, 197, 94, 0.6)', // Green
  interaction: 'rgba(59, 130, 246, 0.6)', // Blue
  intro: 'rgba(168, 85, 247, 0.6)', // Purple
  outro: 'rgba(168, 85, 247, 0.6)', // Purple (same as intro)
  preview: 'rgba(245, 158, 11, 0.6)', // Amber
  music_offtopic: 'rgba(234, 179, 8, 0.6)', // Yellow
  poi_highlight: 'rgba(234, 179, 8, 0.6)', // Yellow (Same as music_offtopic now)
  filler: 'rgba(107, 114, 128, 0.5)', // Gray
};

// Function to update the player instance reference
export function setPlayerInstance(player) {
  ytPlayerInstance = player;
  // When player is ready, try displaying segments again if they exist
  if (sponsorSegments.length > 0) {
    displaySponsorSegments();
  }
}

// --- SponsorBlock Fetch Function ---
export async function fetchSponsorBlockSegments(videoId) {
  try {
    // Request more categories
    const categories = ["sponsor", "selfpromo", "interaction", "intro", "outro", "preview", "music_offtopic", "poi_highlight", "filler"];
    const apiUrl = `https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=${JSON.stringify(categories)}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.log(`SponsorBlock: No segments found or API error for ${videoId} (${response.status})`);
      sponsorSegments = [];
      clearSponsorMarkers();
      return;
    }
    sponsorSegments = await response.json();
    console.log(`SponsorBlock: ${sponsorSegments.length} segments found for ${videoId}`);
    // Attempt to display immediately if player is already available
    if (ytPlayerInstance) {
      displaySponsorSegments();
    }
  } catch (error) {
    console.error('Failed to fetch SponsorBlock segments:', error);
    sponsorSegments = [];
    clearSponsorMarkers();
  }
}

// --- Display Sponsor Segments on Progress Bar ---
export function displaySponsorSegments() {
  const markersContainer = document.getElementById('segmentMarkers');
  if (!markersContainer || !ytPlayerInstance || typeof ytPlayerInstance.getDuration !== 'function') {
    console.log("SponsorBlock Display: Cannot display markers, container or player not ready.");
    return;
  }

  const duration = ytPlayerInstance.getDuration();
  if (!duration || duration <= 0) {
    console.log("SponsorBlock Display: Cannot display markers, invalid duration:", duration);
    return;
  }

  clearSponsorMarkers(); // Clear existing markers first

  if (sponsorSegments && sponsorSegments.length > 0) {
    sponsorSegments.forEach(segment => {
      const startTime = segment.segment[0];
      const endTime = segment.segment[1];
      const category = segment.category;

      const startPercent = (startTime / duration) * 100;
      const widthPercent = ((endTime - startTime) / duration) * 100;

      const marker = document.createElement('div');
      marker.className = 'segment-marker';
      marker.style.left = `${startPercent}%`;
      marker.style.width = `${widthPercent}%`;
      marker.style.backgroundColor = segmentColors[category] || segmentColors['filler']; // Use filler as default
      marker.title = `${category}: ${formatTime(startTime)} - ${formatTime(endTime)}`;

      markersContainer.appendChild(marker);
    });
    console.log(`SponsorBlock Display: Added ${sponsorSegments.length} segment markers.`);
  } else {
    console.log("SponsorBlock Display: No segments to display.");
  }
}

// --- Clear Sponsor Markers ---
export function clearSponsorMarkers() {
  const markersContainer = document.getElementById('segmentMarkers');
  if (markersContainer) {
    markersContainer.innerHTML = ''; // Remove all child elements
  }
}

// --- SponsorBlock Skip Logic ---
// Returns true if a skip occurred, false otherwise
export function checkAndSkipSponsorSegment(currentTime, duration) {
  if (!ytPlayerInstance || !sponsorSegments || sponsorSegments.length === 0 || !duration || duration <= 0) {
    return false;
  }

  const sponsorCategory = 'sponsor'; // Category to skip
  for (const segment of sponsorSegments) {
    if (segment.category === sponsorCategory) {
      const startTime = segment.segment[0];
      const endTime = segment.segment[1];
      // Check if current time is within a sponsor segment (add a small buffer to prevent loops)
      if (currentTime >= startTime && currentTime < endTime - 0.1) {
        console.log(`SponsorBlock: Skipping segment from ${formatTime(startTime)} to ${formatTime(endTime)}`);
        ytPlayerInstance.seekTo(endTime, true);
        return true; // Indicate that a skip happened
      }
    }
  }
  return false; // No skip happened
}

// --- Clear Segments State ---
export function clearSponsorSegmentsState() {
  sponsorSegments = [];
  ytPlayerInstance = null; // Clear player reference on close
  clearSponsorMarkers();
}
