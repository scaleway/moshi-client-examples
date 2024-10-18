# Rust client to run Moshi

- Deploy your model on Scaleway
- Generate a new API Key, it will create a new UUID secret key
- Store it as MOSHI_SECRET_KEY
- Copy your endpoint
- Then do :

```bash
cargo run --bin moshi-cli -r -- run --host ${MOSHI_DEPLOYMENT_ID}.ifr.fr-srr.scaleway.com --secret-key ${MOSHI_SECRET_KEY}
```