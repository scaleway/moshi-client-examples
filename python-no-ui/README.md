# Python client to run Moshi

This is a Python client to interact with Moshi. Here is how you can use it.

## Requirements
This client can be run using poetry or pip to handle the dependencies. You will need:
- Python
- Pip or Poetry

Please refer to the documentation of each of these tools to install them.

## Quick start

`<Scaleway Deployment UUID>` is the UUID of the deployment to which the endpoint is associated, and `<IAM API key>` is the IAM API key that secures your endpoint.

To run the client, you can use the following commands:

### With poetry
```sh
poetry env use 3.12
poetry install
poetry run python moshi_cli.py -d <Scaleway Deployment UUID> -k <IAM API key>
```

### Without poetry
```sh
python3 -m pip install -r requirements.txt
python3 moshi_cli.py -d <Scaleway Deployment UUID> -k <IAM API key>
```