# Web UI to run Moshi

## Requirements
- node
- npm
- docker

## Get started
- Deploy your model on Scaleway
- Generate a new API key
- Create a file named `.env.production` with the following content:
```
VITE_API_URL={DEPLOYEMENT_ID}.ifr.fr-srr.scaleway.com
VITE_SECURE="" # Put something in it if you have 
```
 where `{DEPLOYMENT_ID}` is the ID of your deployment provided by Scaleway.
- Then do:
### With docker
```
docker build -t moshi-prod .
docker run -p 5173:5173 moshi-prod
```
- Go to [](http://localhost:5173/)

### Without docker
- Rename the file `.env.production` to `.env.local`
```
npm i
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /app/key.pem -out /app/cert.pem -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
npm run dev
```
- Go to [](https://localhost:5173/)