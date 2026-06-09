# ==========================================
# Stage 1: Build the React Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend dependency files and install
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

# Copy the rest of the frontend source code and build
COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Build the FastAPI Backend
# ==========================================
FROM python:3.10-slim
WORKDIR /app

# Install system dependencies if required
# (Removed build-essential to save disk space on Back4App free tier)
RUN apt-get update && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire backend source code
COPY backend/ ./

# Create static directory in backend if it doesn't exist
RUN mkdir -p static

# Copy the compiled frontend files from Stage 1 into the backend's static folder
COPY --from=frontend-builder /app/frontend/dist ./static

# Expose port 8000 for FastAPI
EXPOSE 8000
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

# Run the backend using uvicorn (reads dynamic PORT assigned by the cloud provider, replaces shell with exec to keep PID 1)
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
