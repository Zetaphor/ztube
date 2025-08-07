# ZTube

A full-featured YouTube client built with privacy in mind.

## LibRedirect Integration

ZTube supports integration with the LibRedirect browser extension, allowing you to automatically open YouTube links in ZTube instead of your browser. See [LIBREDIRECT_SETUP.md](LIBREDIRECT_SETUP.md) for detailed setup instructions.

## FreeTube Data Import

### Import subscriptions (FreeTube CSV export)

```bash
curl -X POST -F "subscriptionsCsv=@/path/to/youtube-subscriptions.csv" http://localhost:4420/api/subscriptions/import
```

### Import watch history (FreeTube NDJSON export)

```bash
curl -X POST -F "historyFile=@/path/to/freetube-history.db" http://localhost:4420/api/watch-history/import
```

### Import playlists (FreeTube NDJSON export)

```bash
curl -X POST -F "playlistsFile=@/path/to/freetube-playlists.db" http://localhost:4420/api/playlists/import
```

## Watch History

Access your complete watch history with sorting and filtering options at `/history`:

- **Resume watching** from where you left off
- **Sort by**: Most recent, oldest, title, or channel
- **Remove individual videos** from history
- **Clear all history** at once
- **Progress indicators** showing how much you've watched
- **Thumbnail previews** and video metadata
