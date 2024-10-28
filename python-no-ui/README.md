# Python client to run Moshi
## Requirements
  - [pyaudio](https://pypi.org/project/PyAudio/)
  - [<= Python3.12.7](https://www.python.org/downloads/release/python-3127/)
  - [poetry](https://python-poetry.org/docs/) (optionnal)

## Get Started

- Deploy your model on Scaleway
- Generate a new API Key, it will create a new UUID secret key
- Store it as MOSHI_SECRET_KEY
- Copy your endpoint
- Then do :

### With poetry
```sh
poetry env use 3.12.7
poetry install
poetry run python moshi_cli.py -d ${MOSHI_DEPLOYMENT_ID} -k ${MOSHI_SECRET_KEY}
```

### Without poetry
```sh
python3 -mpip install -r requirements.txt
python3 moshi_cli.py -d ${MOSHI_DEPLOYMENT_ID} -k ${MOSHI_SECRET_KEY}
```