# ZTube

A full-featured YouTube client built with Node.js, using Youtubei.js for API interactions and yt-dlp for video streaming.

## Features

- Search YouTube videos
- Watch videos with adaptive streaming
- Multiple quality options (1080p, 720p, audio-only)
- View video details and comments
- Browse channels and playlists
- Download videos (optional)
- Responsive modern UI

## Prerequisites

- Node.js 18 or higher
- yt-dlp installed on your system
- npm or yarn package manager

## Installation

1. Install yt-dlp:
```bash
# For Ubuntu/Debian
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# For Fedora
sudo dnf install yt-dlp
```

2. Clone the repository:
```bash
git clone https://github.com/yourusername/ztube.git
cd ztube
```

3. Install dependencies:
```bash
npm install
```

4. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Video Quality Options

When streaming or downloading videos, you can specify the following quality options:
- `best` - Highest available quality (default)
- `1080p` - Full HD (1920x1080)
- `720p` - HD (1280x720)
- `audio` - Audio-only stream

## Running as an Electron App

This application can also be run as a desktop application using Electron.

### Development

To run the app in development mode with Electron:

```bash
npm run electron:dev
```

This will start the app with developer tools enabled.

### Production

To run the app in production mode with Electron:

```bash
npm run electron
```

### Building the Electron App

To package the app for distribution:

```bash
# For all platforms
npm run build

# For specific platforms
npm run build:linux
npm run build:mac
npm run build:win
```

The packaged app will be available in the `dist` directory.

## License

MIT