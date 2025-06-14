# Use official Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies first for better caching
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy application files
COPY server.js ./
COPY public ./public

# Create directory for session persistence
RUN mkdir -p /app/session_data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV SESSION_FILE_PATH=/app/session_data/session.json

# Create volume for session persistence
VOLUME /app/session_data

# Expose the application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:3000/api/session-status || exit 1

# Run as non-root user
RUN chown -R node:node /app
USER node

# Run the application
CMD ["node", "server.js"]
