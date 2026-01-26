FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Set default port for Hugging Face
ENV PORT=7860

# Expose port
EXPOSE 7860

# Start command
CMD [ "node", "server.js" ]
