# Use official Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies first for better caching
COPY package.json ./
RUN npm ci --only=production

# Copy the rest of the application files
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

RUN mkdir -p public/session_data

# Create volume for session persistence
VOLUME /app/public/session_data

# Expose the application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:3000/api/session-status || exit 1

# Run the application
CMD ["node", "server.js"]
