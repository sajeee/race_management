#!/usr/bin/env sh
set -e  # Exit immediately if a command fails

PORT=${PORT:-8000}
echo "🚀 Starting Django + Daphne on port $PORT"

# Create a flag file so setup runs only once
SETUP_FLAG="/app/.setup_done"

if [ ! -f "$SETUP_FLAG" ]; then
  echo "🧱 Running initial Django setup..."

  # 1️⃣ Run migrations
  echo "📦 Applying migrations..."
  python manage.py migrate --noinput

  # 2️⃣ Create superuser if not exists
  echo "👤 Checking for superuser..."
  DJANGO_SUPERUSER_USERNAME=${DJANGO_SUPERUSER_USERNAME:-admin}
  DJANGO_SUPERUSER_EMAIL=${DJANGO_SUPERUSER_EMAIL:-admin@example.com}
  DJANGO_SUPERUSER_PASSWORD=${DJANGO_SUPERUSER_PASSWORD:-admin123}

  python manage.py shell <<EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username="$DJANGO_SUPERUSER_USERNAME").exists():
    User.objects.create_superuser(
        username="$DJANGO_SUPERUSER_USERNAME",
        email="$DJANGO_SUPERUSER_EMAIL",
        password="$DJANGO_SUPERUSER_PASSWORD"
    )
    print("✅ Superuser created.")
else:
    print("ℹ️ Superuser already exists.")
EOF

  # 3️⃣ Collect static files
  echo "🗂️ Collecting static files..."
  python manage.py collectstatic --noinput || true

  echo "✅ Django setup complete."
  touch "$SETUP_FLAG"
else
  echo "⚡ Django setup already done, skipping migrations and collectstatic."
fi

# 4️⃣ Start Daphne
echo "🚀 Launching Daphne on port $PORT..."
exec daphne -b 0.0.0.0 -p "$PORT" race_management.asgi:application


