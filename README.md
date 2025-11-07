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

- `GET /` - API information
- `GET /health` - Health check

## Development Status

✅ Project structure created  
⏳ Authentication middleware  
⏳ Image conversion endpoint  
⏳ Playwright integration  

---

**License:** MIT | **Author:** Kaio Ribeiro