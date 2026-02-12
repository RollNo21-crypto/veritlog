# Email Ingestion Setup Guide

## Overview
This webhook receives forwarded emails and creates Notice records automatically.

## Supported Providers

### Option 1: SendGrid Inbound Parse
1. Go to SendGrid Dashboard > Settings > Inbound Parse
2. Add hostname: `veritlog.in` (or your domain)
3. Set URL: `https://your-app.pages.dev/api/webhooks/email`
4. Enable "POST the raw, full MIME message"

### Option 2: Mailgun Routes
1. Go to Mailgun Dashboard > Receiving > Routes
2. Create route:
   - Priority: 0
   - Filter: `match_recipient("notices@veritlog.in")`
   - Action: `forward("https://your-app.pages.dev/api/webhooks/email")`
   - Description: "VERITLOG Notice Ingestion"

## Email Address Format

### Per-Tenant Addressing (Recommended)
- Format: `notices+{tenantId}@veritlog.in`
- Example: `notices+org_2a1b3c4d@veritlog.in`
- The `tenantId` is extracted from the `+` suffix

### Domain-Based (Future)
- Custom domains per client
- Example: `notices@clientfirm.com` → mapped to tenant

## Testing Locally

Use ngrok or similar to expose your local server:
```bash
ngrok http 3000
```

Then configure your email provider to use the ngrok URL:
```
https://abc123.ngrok.io/api/webhooks/email
```

## Security

TODO: Implement webhook signature verification
- SendGrid: Verify `X-Twilio-Email-Event-Webhook-Signature`
- Mailgun: Verify `signature` field in payload
