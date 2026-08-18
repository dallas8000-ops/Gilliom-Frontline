# Gilliom FrontLine

Django incident and chain-of-custody log with authenticated REST endpoints, live WebSocket updates, and optional AI-assisted report intake.

## Local setup

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py createsuperuser
daphne -b 127.0.0.1 -p 8000 frontline.asgi:application
```

Open http://localhost:8000. The in-memory Channels layer works for one local process; set `REDIS_URL` for production or multi-process deployments.

## React frontend

The authenticated dashboard is React and TypeScript, built by Vite into Django's static assets. Django continues to own authentication, REST APIs, WebSockets, and the `http://localhost:8000` origin.

```powershell
Set-Location frontend
npm install
npm run build
Set-Location ..
python manage.py collectstatic --noinput
```