# Python client to run Moshi

- Deploy your model on Scaleway
- Generate a new API Key, it will create a new UUID secret key
- Store it as MOSHI_SECRET_KEY
- Copy your endpoint
- Then do :

```bash
python3 moshi_cli.py ${MOSHI_DEPLOYMENT_ID}.ifr.fr-srr.scaleway.com ${MOSHI_SECRET_KEY}
```