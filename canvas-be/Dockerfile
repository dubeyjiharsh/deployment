# Use an official lightweight Python image
# ---------- Builder ----------
FROM python:3.11.14-slim-bookworm@sha256:30f12e0592b7d24ca9a80d6d93701981291fcc452e9f9fb4174ef80deb1217af AS builder

# Set a working directory
WORKDIR /app

RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \ 
&& sed -i 's|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list.d/debian.sources || true

# Patch OS packages in builder image
RUN apt-get update && \ 
    apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create venv
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip to a known-good version (CVE-2025-8869 fixed in 25.3 per scan report)
ARG PIP_VERSION=25.3

# Install deps separately for caching
COPY requirements.lock .
RUN python -m pip install --no-cache-dir --upgrade "pip==${PIP_VERSION}" \ 
&& pip wheel --no-cache-dir --wheel-dir /wheels --only-binary :all: -r requirements.lock

# Install dependencies into venv from wheelhouse only (reduces dependency confusion risk)
RUN pip install --no-cache-dir --no-index --find-links=/wheels --require-hashes -r requirements.lock

# ---------- Runtime ----------
FROM python:3.11.14-slim-bookworm@sha256:30f12e0592b7d24ca9a80d6d93701981291fcc452e9f9fb4174ef80deb1217af AS runtime

RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \ 
&& sed -i 's|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list.d/debian.sources || true

# Patch OS packages in builder image
RUN apt-get update && \ 
    apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

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

# Remove pip from runtime image to close PRISMA-2022-0168 and CVE-2025-8869 (pip dependency confusion advisory)
# We do not install packages at runtime (wheelhouse + hashes already used in builder)
RUN set -eux; \ 
    # remove pip from system python (comes with python base image)
    python -m pip uninstall -y pip setuptools wheel || true; \
    rm -f /usr/local/bin/pip /usr/local/bin/pip3 /usr/local/bin/pip3.* || true; \
    rm -rf /usr/local/lib/python*/site-packages/pip* \
           /usr/local/lib/python*/site-packages/setuptools* \
           /usr/local/lib/python*/site-packages/wheel* || true; \
    # remove pip from venv (copied from builder)
    /opt/venv/bin/python -m pip uninstall -y pip setuptools wheel || true; \
    rm -f /opt/venv/bin/pip /opt/venv/bin/pip3 /opt/venv/bin/pip3.* || true; \
    rm -rf /opt/venv/lib/python*/site-packages/pip* \
           /opt/venv/lib/python*/site-packages/setuptools* \
           /opt/venv/lib/python*/site-packages/wheel* || true

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