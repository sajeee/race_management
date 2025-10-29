import os
from pathlib import Path
import dj_database_url  # <-- add this package to requirements
#GDAL_LIBRARY_PATH = r"C:\Users\DotNet\miniconda3\envs\env_race\Library\bin\gdal.dll"

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('DJANGO_SECRET', 'dev-secret')
DEBUG = os.environ.get('DEBUG', 'False') == 'True'
ALLOWED_HOSTS = ["*"]
# Add Railway domain automatically


INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # GeoDjango
    'django.contrib.gis',

    # Third-party
    'rest_framework',
    'channels',
    'django_celery_beat',

    # local apps
    'core',
    'registration',
    'timing',
    'tracking',
    'results',
    'notifications',
]
ROOT_URLCONF = 'race_management.urls'

ASGI_APPLICATION = 'race_management.asgi.application'
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]




# Database — PostGIS (docker-compose uses host 'db')
# DATABASES = {
#     'default': {
#         'ENGINE': 'django.contrib.gis.db.backends.postgis',
#         'NAME': os.environ.get('POSTGRES_DB', 'race_db'),
#         'USER': os.environ.get('POSTGRES_USER', 'postgres'),
#         'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'postgres'),
#         'HOST': os.environ.get('DB_HOST', 'localhost' if not os.environ.get('DOCKER') else 'db'),
#         'PORT': os.environ.get('DB_PORT', '5432'),
#     }
# }
DATABASES = {
    'default': dj_database_url.config(
        default=os.environ.get('DATABASE_URL'),
        conn_max_age=600,
        engine='django.contrib.gis.db.backends.postgis'
    )
}
SPATIALITE_LIBRARY_PATH = 'mod_spatialite'

# Channels & Redis config
REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost' if not os.environ.get('DOCKER') else 'redis')
# CHANNEL_LAYERS = {
#     "default": {
#         "BACKEND": "channels_redis.core.RedisChannelLayer",
#         "CONFIG": {
#             "hosts": [(f"{REDIS_HOST}", 6379)],
#         },
#     },
# }
# Use in-memory channel layer for local dev (no Redis needed)
# Celery
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379')
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [REDIS_URL],
        },
    },
}
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],  # optional custom templates folder
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]
# settings.py

STATIC_URL = '/static/'

STATICFILES_DIRS = [
    os.path.join(BASE_DIR, "static"),
]

STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")
STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.ManifestStaticFilesStorage'
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Security
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
CSRF_TRUSTED_ORIGINS = [f"https://{os.environ.get('RAILWAY_STATIC_URL', '')}"]
