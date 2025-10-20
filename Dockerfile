FROM python:3.11-slim

# Install system libraries (GDAL, Proj, compiler tools)
RUN apt-get update && apt-get install -y \
    gdal-bin libgdal-dev libproj-dev binutils g++ gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . /app/

RUN pip install --upgrade pip
RUN pip install -r requirements.txt

RUN python manage.py collectstatic --noinput
CMD daphne -b 0.0.0.0 -p $PORT race_management.asgi:application

