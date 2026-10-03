# DhruvSetu frontend

This folder contains the DhruvSetu web interface. It uses Next.js, React,
TypeScript, and Tailwind CSS.

## Run locally

Copy the safe API setting before starting the frontend:

```bash
cp .env.example .env.local
```

The default value connects the frontend to FastAPI at
`http://127.0.0.1:8000`.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

## Check the frontend

```bash
npm run lint
npm run build
```
