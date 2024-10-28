# TypeScript Client to Run Moshi

## Requirements

- [Node.js](https://nodejs.org/) (>= 14.x)
  - Install via [nvm](https://github.com/nvm-sh/nvm)
- [ffmpeg](https://ffmpeg.org/download.html) (must be installed and available in PATH)
- [yarn](https://yarnpkg.com/) (recommended for managing dependencies)

## Get Started

### Steps to Run the Client

1. **Deploy your model on Scaleway**
2. **Generate a new IAM API Key**. This will create a new UUID-based secret key.
3. **Store your API Key** as `MOSHI_SECRET_KEY`
4. **Copy your WebSocket endpoint**

Then, follow the steps below to set up and run the client:

### Using Yarn

```sh
# Install dependencies
yarn install

# Run the client
yarn run start -d ${MOSHI_DEPLOYMENT_ID} -k ${MOSHI_SECRET_KEY}
