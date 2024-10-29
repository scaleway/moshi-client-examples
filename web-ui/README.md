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
VITE_SCW_PROJECT_ID=<Scaleway Project ID>
VITE_SCW_DEFAULT_REGION=fr-par
VITE_SECURE="" # Put anything in it if you have created an API key
```
 where `<Scaleway Project ID>` is your Project ID you can find in the [Scaleway console](https://console.scaleway.com/project/settings)
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
npm run dev
```
- Go to [](https://localhost:5173/)