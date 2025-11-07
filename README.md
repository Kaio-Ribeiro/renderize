# Renderize API

🚀 **HTML to Image Conversion API** using Node.js, Express, and Playwright

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

## Project Structure

```
renderize/
├── src/
│   ├── middleware/     # Custom middleware
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── utils/          # Helper functions
│   ├── config.js       # App configuration
│   └── server.js       # Main server file
├── temp/               # Temporary images
├── public/             # Static files
├── tests/              # Test files
└── package.json
```

## Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run lint` - Run ESLint

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
PORT=3000
HCTI_USER_ID=your_user_id
HCTI_API_KEY=your_api_key
```

## API Endpoints

### Public Endpoints
- `GET /` - API information
- `GET /health` - Health check
- `POST /auth/generate` - Generate sample credentials
- `GET /auth/config` - Check authentication configuration
- `GET /auth/status` - Check current auth status

### Protected Endpoints (require Basic Auth)
- `GET /auth/test` - Test authentication

## Authentication

The API uses HTTP Basic Authentication. Configure credentials in your `.env` file:

```env
HCTI_USER_ID=your_username
HCTI_API_KEY=your_password
```

### Test Authentication

```bash
# Generate sample credentials
curl -X POST http://localhost:3000/auth/generate

# Test with credentials
curl -H "Authorization: Basic <base64_credentials>" http://localhost:3000/auth/test
```

## API Endpoints

### Public Routes
- `GET /` - API information  
- `GET /health` - Health check
- `GET /v1` - API v1 information
- `GET /v1/status` - API status
- `GET /v1/auth/*` - Authentication endpoints

### Protected Routes (require Basic Auth)
- `POST /v1/image` - Convert HTML to image (not implemented yet)
- `GET /v1/image/info` - Image conversion endpoint information

## Screenshots & Browser

The service uses **Playwright** with Chromium for reliable screenshot capture:

- Element-specific screenshots using CSS selectors
- Full page screenshots
- Configurable viewport and quality
- Automatic retry and error handling
- Browser resource management

### Browser Setup

```bash
# Install browser dependencies (after npm install)
npx playwright install chromium
```

## Development Status

✅ Project structure created  
✅ Authentication middleware  
✅ API routes and error handling  
✅ Playwright screenshot service  
⏳ Image conversion endpoint  
⏳ File management system  

---

**License:** MIT | **Author:** Kaio Ribeiro