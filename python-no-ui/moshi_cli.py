import asyncio
import opuslib
import pyaudio
import ssl
import websockets
from enum import Enum

DEPLOYMENT_UUID: str = "CHANGE_ME"
IAM_API_KEY: str = "CHANGE_ME"

SAMPLE_RATE: int = 24000
CHANNELS: int = 1 # Mono only
FRAME_SIZE: int = 1920 # 20ms of audio

class PacketType(Enum):
    HANDSHAKE = 0
    AUDIO = 1
    TEXT = 2
    CONTROL = 3
    METADATA = 4
    ERROR = 5
    PING = 6

async def send_data(websocket: websockets.WebSocketClientProtocol, opus_encoder: opuslib.Encoder, input_stream: pyaudio.Stream):
    while True:
        pcm16_data = input_stream.read(FRAME_SIZE)
        opus_data = opus_encoder.encode(pcm16_data, FRAME_SIZE)
        await websocket.send(bytes([PacketType.AUDIO.value]) + opus_data)

async def receive_data(websocket: websockets.WebSocketClientProtocol, opus_decoder: opuslib.Decoder, output_stream: pyaudio.Stream):
    while True:
        data = await websocket.recv()
        match PacketType(data[0]):
            case PacketType.AUDIO:
                pcm16_data = opus_decoder.decode(data[1:])
                output_stream.write(pcm16_data)
            case PacketType.TEXT:
                print(data[1:].decode())
            case _:
                pass

async def main():
    # Endpoint
    uri = f"wss://{DEPLOYMENT_UUID}.ifr.fr-srr.scaleway.com/api/chat"
    headers = {
        "Authorization": f"Bearer {IAM_API_KEY}",
        "Host": f"{DEPLOYMENT_UUID}.ifr.fr-srr.scw.cloud"
    }

    # To be removed
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    # Initialize opus encoder and decoder
    encoder = opuslib.Encoder(SAMPLE_RATE, CHANNELS, "audio")
    decoder = opuslib.Decoder(SAMPLE_RATE, CHANNELS)

    # Initialize audio streams
    p = pyaudio.PyAudio()
    input_stream = p.open(format=pyaudio.paInt16,
                          channels=CHANNELS,
                          rate=SAMPLE_RATE,
                          input=True,
                          frames_per_buffer=FRAME_SIZE)
    output_stream = p.open(format=pyaudio.paInt16,
                          channels=CHANNELS,
                          rate=SAMPLE_RATE,
                          output=True)

    # Main business logic
    try:
        async with websockets.connect(uri, extra_headers=headers, ssl=ssl_context) as websocket:
            await asyncio.gather(
                send_data(websocket, encoder, input_stream),
                receive_data(websocket, decoder, output_stream)
            )
    except (websockets.exceptions.ConnectionClosedError, websockets.exceptions.InvalidStatusCode) as e:
        print(f"Connection error: {e}")
    except Exception as e:
        print(f"Error: {e}")

    # Close audio streams
    input_stream.stop_stream()
    input_stream.close()
    output_stream.stop_stream()
    output_stream.close()
    p.terminate()

if __name__ == "__main__":
    asyncio.run(main())