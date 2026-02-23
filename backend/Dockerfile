FROM node:22-slim

# Create non-root user
RUN adduser --disabled-password --gecos '' agent

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm ci --production

# Copy compiled source
COPY dist/ ./dist/

# Create directories for runtime data
RUN mkdir -p uploads reports && chown -R agent:agent uploads reports

# Run as non-root
USER agent

EXPOSE 4000

CMD ["node", "dist/server.js"]
