# Use an official lightweight Python image
# ---------- Builder ----------
FROM python:3.11.14-slim-bookworm AS builder

# Set a working directory
WORKDIR /app

RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \ 
 && sed -i 's|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list.d/debian.sources || true

# Patch OS packages (addresses util-linux/ncurses/sqlite3 low findings when fixes are available in repo)
RUN apt-get update \
 && apt-get upgrade -y \
 && rm -rf /var/lib/apt/lists/*

# Create venv
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip to a known-good version (CVE-2025-8869 fixed in 25.3 per your scan report)
ARG PIP_VERSION=25.3
 
# Install deps separately for caching
COPY requirements.txt .
RUN python -m pip install --no-cache-dir --upgrade "pip==${PIP_VERSION}" \
 && pip wheel --no-cache-dir --wheel-dir /wheels --only-binary :all: -r requirements.txt

# Install dependencies into venv from wheelhouse only (reduces dependency confusion risk)
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt

# ---------- Runtime ----------
FROM python:3.11.14-slim-bookworm AS runtime

RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \ 
 && sed -i 's|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list.d/debian.sources || true

# Patch OS packages in runtime image too
RUN apt-get update \
 && apt-get upgrade -y \
 && rm -rf /var/lib/apt/lists/*

# Good defaults for containers
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# Create a non-root user to run the app
RUN groupadd --system appuser \
 && useradd --system --gid appuser --create-home --home-dir /home/appuser appuser

# Set a working directory
WORKDIR /app

# Copy venv from builder
COPY --from=builder /opt/venv /opt/venv

# Copy application code
COPY . /app

# Ensure non-root can read the app directory
RUN chown -R appuser:appuser /app

# Drop privileges for runtime
USER appuser

# Optional: document port (K8s doesn't require EXPOSE)
EXPOSE 8010 

# For FastAPI (main.py with app=FastAPI()):
CMD ["python", "main.py", "8010"]