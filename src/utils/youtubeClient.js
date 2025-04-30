import { Innertube } from 'youtubei.js';

let youtube;

async function initializeYoutubeClient() {
  if (!youtube) {
    console.info("Initializing YouTube client...");
    youtube = await Innertube.create();
    console.info("YouTube client initialized.");
  }
  return youtube;
}

// Initialize client immediately and export the promise
const youtubePromise = initializeYoutubeClient();

// Export a function that returns the initialized client promise
// This ensures the client is ready before being used elsewhere
export default async function getYoutubeClient() {
  return youtubePromise;
}