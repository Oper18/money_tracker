FROM node:latest as build-step

RUN mkdir /app
WORKDIR /app
COPY package.json /app
RUN npm install
COPY . /app
RUN npm run build

FROM nginx:latest
COPY --from=build-step /app/build /usr/share/nginx/html
RUN apt-get update -y \
 && apt-get install -y gnupg2 \
 && apt-get update -y \
 && apt-get install -y software-properties-common \
 && add-apt-repository -y ppa:certbot/certbot &> /dev/null \
 && apt-get update -y \
 && apt-get install -y python-certbot-nginx
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]