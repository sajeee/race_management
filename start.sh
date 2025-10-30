#!/usr/bin/env sh
PORT=${PORT:-8000}
echo "Starting Daphne on port $PORT"
exec daphne -b 0.0.0.0 -p "$PORT" race_management.asgi:application


echo "🚀 Running Django setup on Railway..."

# Stop on first error
set -e

echo "📦 Applying database migrations..."
python manage.py migrate --noinput

echo "👤 Creating superuser (if not exists)..."
# Auto-create a superuser using env vars (safe for Railway one-off commands)
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

echo "🧱 Collecting static files..."
python manage.py collectstatic --noinput

echo "✅ Django setup complete!"

