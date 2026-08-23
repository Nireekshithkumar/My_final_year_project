"""
Django settings for NeuralCanva project.
"""

import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv


# ============================================================
# BASE
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

# Explicitly load .env from the project root
ENV_FILE = BASE_DIR / ".env"
load_dotenv(ENV_FILE)


# ============================================================
# REDIS / VALKEY
# ============================================================

REDIS_URL = os.getenv("REDIS_URL")

load_dotenv(BASE_DIR / ".env", override=True)


# ============================================================
# SECURITY
# ============================================================

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-dev-only-key-change-this"
)

DEBUG = os.environ.get("DEBUG", "True").lower() == "true"


# ============================================================
# ALLOWED HOSTS
# ============================================================

RENDER_HOSTNAME = os.environ.get("RENDER_EXTERNAL_HOSTNAME")

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "testserver",
    "neuralcanvas-backend.onrender.com",
]

if RENDER_HOSTNAME and RENDER_HOSTNAME not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(RENDER_HOSTNAME)


# ============================================================
# APPLICATIONS
# ============================================================

INSTALLED_APPS = [
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "channels",
    "rest_framework",
    "corsheaders",

    # NeuralCanva apps
    "accounts",
    "common",
    "datasets",
    "nodes",
    "pipelines",
    "ai",
]


# ============================================================
# MIDDLEWARE
# ============================================================

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",

    # Static files
    "whitenoise.middleware.WhiteNoiseMiddleware",

    "django.contrib.sessions.middleware.SessionMiddleware",

    "corsheaders.middleware.CorsMiddleware",

    "django.middleware.common.CommonMiddleware",

    "django.middleware.csrf.CsrfViewMiddleware",

    "django.contrib.auth.middleware.AuthenticationMiddleware",

    "django.contrib.messages.middleware.MessageMiddleware",

    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# ============================================================
# URL CONFIGURATION
# ============================================================

ROOT_URLCONF = "NeuralCanva.urls"


# ============================================================
# TEMPLATES
# ============================================================

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# ============================================================
# WSGI / ASGI
# ============================================================

WSGI_APPLICATION = "NeuralCanva.wsgi.application"

ASGI_APPLICATION = "NeuralCanva.asgi.application"


# ============================================================
# DATABASE
# ============================================================

DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


# ============================================================
# PASSWORD VALIDATION
# ============================================================

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME":
            "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME":
            "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME":
            "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME":
            "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# ============================================================
# INTERNATIONALIZATION
# ============================================================

LANGUAGE_CODE = "en-us"

TIME_ZONE = "Asia/Kolkata"

USE_I18N = True

USE_TZ = True


# ============================================================
# STATIC FILES
# ============================================================

STATIC_URL = "/static/"

STATIC_ROOT = BASE_DIR / "staticfiles"

STATICFILES_STORAGE = (
    "whitenoise.storage.CompressedManifestStaticFilesStorage"
)


# ============================================================
# MEDIA FILES
# ============================================================

MEDIA_URL = "/media/"

MEDIA_ROOT = BASE_DIR / "media"


# ============================================================
# USER MODEL
# ============================================================

AUTH_USER_MODEL = "accounts.User"


# ============================================================
# REDIS / VALKEY
# ============================================================

REDIS_URL = os.getenv("REDIS_URL")

if not REDIS_URL:
    if not DEBUG:
        raise RuntimeError(
            "REDIS_URL is not configured for production."
        )
    REDIS_URL = "redis://127.0.0.1:6379/0"


# ============================================================
# FASTAPI ML SERVICE
# ============================================================

FASTAPI_URL = os.getenv(
    "FASTAPI_URL",
    "http://localhost:8001"
)


# ============================================================
# DJANGO CACHE
# ============================================================

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "neuralcanva-local-cache",
    }
}

GRAPH_CACHE_TTL = 60 * 60 * 24


# ============================================================
# DJANGO REST FRAMEWORK
# ============================================================

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "accounts.authentication.CsrfExemptSessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}


# ============================================================
# CORS
# ============================================================

CORS_ALLOWED_ORIGINS = [
    # Local development
    "http://localhost:5173",
    "http://127.0.0.1:5173",

    # Production frontend
    "https://neuralcanvasteam.vercel.app",
]

CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https:\/\/.*\.vercel\.app$",
]

CORS_ALLOW_CREDENTIALS = True


# ============================================================
# CSRF
# ============================================================

# IMPORTANT: CSRF_TRUSTED_ORIGINS must be defined BEFORE the dynamic
# VERCEL_FRONTEND_URL block below, which appends to it.
# Previously this list appeared after the dynamic block, causing:
#   NameError: name 'CSRF_TRUSTED_ORIGINS' is not defined
# on Render (where VERCEL_FRONTEND_URL env var is set).

CSRF_COOKIE_HTTPONLY = False

CSRF_TRUSTED_ORIGINS = [
    # Local development
    "http://localhost:5173",
    "http://127.0.0.1:5173",

    # Production frontend
    "https://neuralcanvasteam.vercel.app",
    "https://*.vercel.app",
]


# Dynamic: append the runtime Vercel URL (from env) to both lists if set.
# Trailing slashes are stripped so origins are always scheme://host with no path.
VERCEL_FRONTEND_URL = os.environ.get("VERCEL_FRONTEND_URL")
if VERCEL_FRONTEND_URL:
    clean_vercel_url = VERCEL_FRONTEND_URL.strip().rstrip("/")
    if clean_vercel_url not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(clean_vercel_url)
    if clean_vercel_url not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(clean_vercel_url)


# ============================================================
# AUTHENTICATION BACKENDS
# ============================================================

AUTHENTICATION_BACKENDS = [
    "accounts.backends.EmailBackend",
    "django.contrib.auth.backends.ModelBackend",
]


# ============================================================
# SESSION / COOKIE CONFIGURATION
# ============================================================

if not DEBUG:
    # Required because frontend and backend are on different domains in production.
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

    SESSION_COOKIE_SAMESITE = "None"
    CSRF_COOKIE_SAMESITE = "None"
else:
    # Local development over HTTP
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False

    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SAMESITE = "Lax"


# ============================================================
# CHANNELS / WEBSOCKETS
# ============================================================

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [REDIS_URL],
            # Prevent idle WebSocket connections from triggering TimeoutError.
            # socket_connect_timeout: max seconds to wait establishing connection.
            # socket_timeout: None = block indefinitely (no read timeout), which is
            #   correct for long-lived WebSocket channel subscriptions.
            # expiry: message TTL in seconds — keeps Redis clean.
            # capacity: max messages queued per channel.
            "expiry": 60,
            "capacity": 1500,
            "channel_capacity": {
                "http.request": 200,
                "http.response*": 10,
            },
        },
    },
}


# ============================================================
# PRODUCTION SECURITY
# ============================================================

if not DEBUG:

    SECURE_PROXY_SSL_HEADER = (
        "HTTP_X_FORWARDED_PROTO",
        "https",
    )

    SECURE_CONTENT_TYPE_NOSNIFF = True

    SECURE_BROWSER_XSS_FILTER = True