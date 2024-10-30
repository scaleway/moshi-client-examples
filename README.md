# Moshi client examples

This repository contains multiple implementations of the Moshi client across different languages and configurations. Each folder includes either a non-UI (`-no-ui`) or a UI (`-ui`) version of the client.

## Project Contents

- **[node-no-ui](node-no-ui/README.md)**: Moshi client without a UI in Node.js (written in Typescript).
- **[python-no-ui](python-no-ui/README.md)**: Moshi client without a UI in Python.
- **[rust-no-ui](rust-no-ui/README.md)**: Moshi client without a UI in Rust.
- **[rust-ui](rust-ui/README.md)**: Moshi client with a UI in Rust.

## Quickstart

- Create a deployment of Moshi using Scaleway's Managed Inference service (see the [documentation](https://www.scaleway.com/en/docs/ai-data/managed-inference/) for further information);
- Create a model endpoint and get the deployment UUID to which the endpoint will be associated;
- (Optionnal) Create an IAM API key to secure your endpoint;
- Follow the instructions in the README of the client you want to use.
