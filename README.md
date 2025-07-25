# ZTube

### Import subscriptions (FreeTube CSV export)

```bash
curl -X POST -F "subscriptionsCsv=@/home/zetaphor/Downloads/youtube-subscriptions-2025-04-30.csv" http://localhost:4420/api/subscriptions/import
```
