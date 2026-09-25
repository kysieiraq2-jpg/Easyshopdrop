FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY app ./app
COPY public ./public
COPY security ./security
COPY integrations ./integrations
EXPOSE 3000
CMD ["node","app/server.js"]
