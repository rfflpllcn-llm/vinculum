# Multi-stage Dockerfile for Vinculum
# Includes both Node.js (Next.js) and Python (pdfalign-aligner)

# Stage 1: Python dependencies
FROM python:3.11-slim AS python-builder
WORKDIR /app/python

# Install system dependencies for Python packages
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements and install
COPY python/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Node.js build
FROM node:20-slim AS node-builder
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Build Next.js app
RUN npm run build

# Stage 3: Production runtime
FROM node:20-slim
WORKDIR /app

# Install Python 3.11
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies from builder
COPY --from=python-builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy Python code
COPY python/ ./python/

# Copy Node.js dependencies and build
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/.next ./.next
COPY --from=node-builder /app/public ./public
COPY --from=node-builder /app/package*.json ./

# Copy Next.js config and other necessary files
COPY next.config.ts ./
COPY tsconfig.json ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY src/ ./src/

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start the application
CMD ["npm", "start"]