# LibRedirect Integration Setup

ZTube now supports integration with the LibRedirect browser extension, allowing you to automatically open YouTube links in ZTube instead of your browser.

## What is LibRedirect?

LibRedirect is a browser extension that redirects popular websites (like YouTube, Twitter, Reddit) to privacy-friendly alternative frontends. It can redirect YouTube links to applications like FreeTube or ZTube.

## Setup Instructions

### 1. Build ZTube as AppImage

First, build ZTube as an AppImage:

```bash
npm run build:linux
```

This will create an AppImage file in the `dist` directory.

### 2. Install the AppImage

Move the AppImage to a location where you want to keep it (e.g., `~/Applications` or `/opt`):

```bash
mkdir -p ~/Applications
mv dist/ZTube-*.AppImage ~/Applications/ZTube.AppImage
chmod +x ~/Applications/ZTube.AppImage
```

### 3. Register the MIME Handler

The AppImage should automatically register the MIME handler when first run, but you can also manually register it:

```bash
# Run the AppImage once to register it
~/Applications/ZTube.AppImage

# Alternatively, manually register the desktop file
mkdir -p ~/.local/share/applications
cat > ~/.local/share/applications/ztube.desktop << 'EOF'
[Desktop Entry]
Name=ZTube
GenericName=YouTube Player
Comment=A full-featured YouTube client built with privacy in mind
Exec=/home/$(whoami)/Applications/ZTube.AppImage %U
Terminal=false
Type=Application
Icon=ztube
MimeType=x-scheme-handler/freetube;x-scheme-handler/ztube;
Categories=Network;AudioVideo;
StartupWMClass=ZTube
EOF

# Update the desktop database
update-desktop-database ~/.local/share/applications
```

### 4. Install LibRedirect Extension

Install the LibRedirect extension in your browser:

- **Firefox**: [Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/libredirect/)
- **Chrome/Chromium**: [Developer's website](https://libredirect.github.io)

### 5. Configure LibRedirect

1. Open LibRedirect settings in your browser
2. Go to "Services" → "YouTube"
3. Select "FreeTube" as the frontend (ZTube uses the same MIME handler as FreeTube)
4. Enable YouTube redirection

## How It Works

1. When you click a YouTube link in your browser (while LibRedirect is active), the extension intercepts the link
2. LibRedirect converts the link to use the `freetube://` protocol (ZTube also supports `ztube://`)
3. Your system opens this protocol with ZTube (since both FreeTube and ZTube register for the same MIME type)
4. ZTube extracts the video ID from the URL and loads the video

## Supported URL Formats

ZTube can handle these YouTube URL formats:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://youtube.com/watch?v=VIDEO_ID`
- `https://m.youtube.com/watch?v=VIDEO_ID`
- And other YouTube URL variants

## Troubleshooting

### LibRedirect doesn't redirect to ZTube

1. Make sure the AppImage is properly registered:
   ```bash
   xdg-mime query default x-scheme-handler/freetube
   xdg-mime query default x-scheme-handler/ztube
   ```
   This should show `ztube.desktop` or similar.

2. Check if the desktop file exists:
   ```bash
   ls ~/.local/share/applications/ztube.desktop
   ```

3. Re-register the MIME handler:
   ```bash
   xdg-mime default ztube.desktop x-scheme-handler/freetube
   xdg-mime default ztube.desktop x-scheme-handler/ztube
   ```

### ZTube doesn't open when clicking links

1. Make sure ZTube is executable:
   ```bash
   chmod +x ~/Applications/ZTube.AppImage
   ```

2. Test URL handling manually:
   ```bash
   ~/Applications/ZTube.AppImage "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
   ```

3. Check the desktop file Exec path is correct in `~/.local/share/applications/ztube.desktop`

### Multiple applications handle the MIME type

If both FreeTube and ZTube are installed, you can choose which one handles YouTube links:

```bash
# Set ZTube as default
xdg-mime default ztube.desktop x-scheme-handler/freetube

# Set FreeTube as default
xdg-mime default freetube.desktop x-scheme-handler/freetube
```

## Technical Details

- ZTube registers for the MIME types `x-scheme-handler/freetube` and `x-scheme-handler/ztube`
- This is the same MIME type used by FreeTube for LibRedirect compatibility
- URL arguments are passed via Electron's command line arguments
- The application uses single-instance mode to focus existing windows when new URLs are opened