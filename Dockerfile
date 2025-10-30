# =========================
#  RACE MANAGEMENT PROJECT
#  Railway + Django + Channels + GIS (GDAL)
# =========================

# Base image
FROM python:3.11-slim

# Install system packages for GeoDjango & PostGIS support
RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    libproj-dev \
    binutils \
    g++ \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy all project files
COPY . /app/

# Upgrade pip and install dependencies
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Collect static files for Django
RUN python manage.py collectstatic --noinput || true

# Expose a default port (for local dev)
EXPOSE 8000

# ✅ Ensure Railway (or any host) provides PORT env var
ENV PORT=${PORT:-8000}

# Print debug info (optional)
RUN echo "✅ Django + Daphne will run on port $PORT"

# ✅ Start Daphne with dynamic port binding
CMD ["sh", "-c", "daphne -b 0.0.0.0 -p ${PORT} race_management.asgi:application"]
