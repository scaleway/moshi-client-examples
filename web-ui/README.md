# Web UI to run Moshi

This is a web UI to interact with Moshi. Here is how you can use it.

## Requirements
This client can be run inside a docker container or directly on your machine. Here are the requirements for each case:
- Docker:
  - Docker
- Without Docker:
  - Node.js
  - npm

Please refer to the documentation of each of these tools to install them.

## Quick start

### With docker
- Create a file named `.env.production` with the following content:
```sh
VITE_SCW_DEPLOYMENT_UUID=<Scaleway Deployment UUID> # The deployment uuid to which the endpoint is associated
VITE_SCW_DEFAULT_REGION=fr-par
VITE_SECURE="" # Put anything in it if you have created an IAM API key to secure your endpoint
```
- Then run the following commands:
```sh
docker build -t moshi-web-ui .
docker run -p 5173:5173 moshi-web-ui
```
- You can access the Web UI at [http://localhost:5173/](http://localhost:5173/)

### Without docker
- Create a file named `.env.local` with the following content:
```sh
VITE_SCW_DEPLOYMENT_UUID=<Scaleway Deployment UUID> # The deployment uuid to which the endpoint is associated
VITE_SCW_DEFAULT_REGION=fr-par
VITE_SECURE="" # Put anything in it if you have created an IAM API key to secure your endpoint
```
- Then run the following commands:
```sh
npm i
npm run dev
```
- You can access the Web UI at [http://localhost:5173/](http://localhost:5173/)
