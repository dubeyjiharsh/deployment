# Use an official lightweight Python image
# ---------- Builder ----------
FROM python:3.11.14-slim AS builder

# Set a working directory
WORKDIR /app

# Create venv
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
 
# Install deps separately for caching
COPY requirements.txt .
RUN python -m pip install --upgrade pip \
 && pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# ---------- Runtime ----------
FROM python:3.11.14-slim AS runtime

# Good defaults for containers
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"
    
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
