# Renderize API

🚀 **HTML to Image Conversion API** using Node.js, Express, and Playwright

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start server
npm start
```

## Environment Variables

```env
PORT=3000
HCTI_USER_ID=your_user_id
HCTI_API_KEY=your_api_key
```

## Authentication

The API uses HTTP Basic Authentication. Generate credentials:

```bash
# Generate sample credentials
curl -X POST http://localhost:3000/auth/generate
```

## Usage

### Convert HTML Element to Image

```bash
curl -X POST http://localhost:3000/v1/image \
  -H "Authorization: Basic <your_credentials>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "selector": "h1"
  }'
```

**Response:**
```json
{
  "url": "http://localhost:3000/images/screenshot-abc123.png",
  "filename": "screenshot-abc123.png",
  "size": 15420,
  "duration": "2340ms"
}
```

## Main Endpoints

- `GET /health` - Health check
- `POST /auth/generate` - Generate credentials
- `POST /v1/image` - Convert HTML element to image

---

**License:** MIT | **Author:** Kaio Ribeiro