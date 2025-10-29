# =========================
#  RACE MANAGEMENT PROJECT
#  Railway + Django + Channels + GIS
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

# Expose the internal port (hardcoded)
EXPOSE 8000

# Print debug info (optional)
RUN echo "✅ Django build complete. Ready to launch Daphne on port 8000."

CMD ["sh", "-c", "daphne -b 0.0.0.0 -p ${PORT:-8000} race_management.asgi:application"]

