# ============================================
# Backend — FastAPI / Uvicorn
# ============================================
FROM python:3.11-slim

# System deps needed by psycopg2-binary, Pillow, PyMuPDF, python-magic
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Run with uvicorn; 0.0.0.0 so Docker can forward the port
CMD ["uvicorn", "app.main:socket_app", "--host", "0.0.0.0", "--port", "8000"]
