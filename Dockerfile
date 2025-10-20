FROM python:3.11-slim

# Install system libraries (GDAL, Proj, compiler tools)
RUN apt-get update && apt-get install -y \
    gdal-bin libgdal-dev libproj-dev binutils g++ gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . /app/

RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Collect static files
RUN python manage.py collectstatic --noinput

# Railway doesn't always inject $PORT for Docker builds, so set a default
ENV PORT=8000

EXPOSE 8000

# Print port for debugging, then run Daphne
CMD sh -c 'echo "🚀 Starting on port ${PORT}"; daphne -b 0.0.0.0 -p ${PORT} race_management.asgi:application'
