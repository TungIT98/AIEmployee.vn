# Zalo Integration Plan - COM-82

## Overview
Integrate Zalo OA (Official Account) for Vietnamese market engagement. Zalo has 100M+ users in Vietnam and is critical for local market reach.

## Zalo OA API Capabilities

### Authentication
- OAuth 2.0 flow via `https://oauth.zaloapp.com/v4/access_token`
- Access tokens must be refreshed periodically
- Webhook verification via `X-Bot-Api-Secret-Token` header

### Key API Endpoints Needed
| Feature | Endpoint | Purpose |
|---------|----------|---------|
| Send Text | `POST /v2.0/oa/message` | Send text messages to users |
| Send Image | `POST /v2.0/oa/message` (with attachment) | Rich media messages |
| Get Profile | `GET /v2.0/oa/getprofile` | Get user profile info |
| Webhook Events | Webhook receiver | Handle incoming messages/events |

## Implementation

### Phase 1: Core Integration
1. Create `api/src/services/zalo.js` service
2. Add Zalo OAuth token management
3. Implement webhook endpoint at `POST /api/zalo/webhook`
4. Implement `POST /api/zalo/send` for sending messages

### Phase 2: Business Integration
1. Connect Zalo notifications to invoice events
2. Zalo login/auth flow (optional, later phase)
3. ZNS (Zalo Notification Service) for transactional messages

## Configuration
```
ZALO_APP_ID=<from Zalo OA dashboard>
ZALO_APP_SECRET=<from Zalo OA dashboard>
ZALO_OA_ID=<Official Account ID>
ZALO_WEBHOOK_SECRET=<for webhook verification>
```

## Files to Create/Modify
- `api/src/services/zalo.js` (new)
- `api/src/routes/api.js` (add /zalo routes)
- `.env.example` (add Zalo env vars)

## Dependencies
- `zalo-sdk` (optional, or use raw HTTP calls)
- No additional npm packages needed (use native fetch/axios)

## Blockers
- Need Zalo OA account credentials (CEO to provide)
- Webhook requires HTTPS endpoint (MVP already has SSL via aiemployee.vn)
