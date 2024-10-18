# Rust snippet to run Moshi

- Deploy your model on Scaleway
- Generate a new API Key, it will create a new UUID secret key
- Store it as MOSHI_SECRET_KEY
- Copy your endpoint
- Then do :

```bash
cargo run --bin moshi-cli -r -- tui --host 2433c7b7-c0c5-40dc-9193-186f039df7df.ifr.fr-srr.scaleway.com --secret-key ${MOSHI_SECRET_KEY}
```