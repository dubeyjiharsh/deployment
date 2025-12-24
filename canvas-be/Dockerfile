# Use an official lightweight Python image
# ---------- Builder ----------
FROM python:3.11-slim-bullseye AS builder

# Set a working directory
WORKDIR /app
 
# Install deps separately for caching
COPY requirements.txt .
RUN python -m pip install --upgrade pip \
 && pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# ---------- Runtime ----------
FROM python:3.11-slim-bullseye AS runtime

# Good defaults for containers
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
    
# Set a working directory
WORKDIR /app

# Install wheels from builder
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

# Copy application code
COPY . /app

# Optional: document port (K8s doesn't require EXPOSE)
EXPOSE 8010 

# For FastAPI (main.py with app=FastAPI()):
CMD ["python", "main.py", "8010"]