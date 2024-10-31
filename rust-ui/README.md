# Rust tui client to run Moshi

This is a Rust client to interact with Moshi via a textual user interface. Here is how you can use it.

## Requirements
This client can be run using Cargo to handle the dependencies. You will need:
- Rust
- Cargo

Please refer to the documentation of each of these tools to install them.

## Quick start

`<Scaleway Deployment UUID>` is the UUID of the deployment to which the endpoint is associated, and `<IAM API key>` is the IAM API key that secures your endpoint.

To run the client, you can use the following commands:

```sh
cargo run -- -d <Scaleway Deployment UUID> -k <IAM API key>
```