# PRIYANKA LAB — Web App

This is the simple web-app version.

## Artist experience

Open one HTTPS website URL → upload photo → create content.

There is NO:
- server IP screen
- IP/localStorage setup
- Node/npm requirement for the artist
- API key in browser code

## Developer/deployment setup

The server still needs to run somewhere because the OpenAI API key must stay private.

### Local
1. Install Node.js 20.6+
2. Copy `.env.example` to `.env`
3. Add `OPENAI_API_KEY`
4. Run `npm install`
5. Run `npm start`
6. Open `http://localhost:3000`

### Online
The included `render.yaml` is prepared for Render:
- Build: `npm install`
- Start: `npm start`
- Health check: `/api/health`

Set `OPENAI_API_KEY` as a server environment variable. Do not put it into `public/`.

Once deployed, the artist only opens the HTTPS URL.
