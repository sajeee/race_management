# Use official Python image
FROM python:3.11-slim

# System deps (GDAL, Geo libs, PostgreSQL client, Redis support)
RUN apt-get update && apt-get install -y \
    gdal-bin libgdal-dev binutils libproj-dev g++ gcc \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy project
COPY . /app/

# Install Python deps
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Collect static files at build time
RUN python manage.py collectstatic --noinput

# Run Daphne (ASGI)
CMD daphne -b 0.0.0.0 -p $PORT race_management.asgi:application
