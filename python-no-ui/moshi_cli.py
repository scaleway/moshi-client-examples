import aiohttp
import argparse
import asyncio
import aiohttp.client_exceptions
import numpy as np
import queue
import sphn
import sounddevice
import ssl


SAMPLE_RATE: int = 24000  # Valid options are 8000, 12000, 16000, 24000, or 48000 Hz
CHANNELS: int = 1  # Mono only
FRAME_SIZE: int = (
    1920  # Valid options are 2.5 (60), 5 (120), 10 (240), 20 (480), 40 (960), 60 (1440) ms, etc.
)


async def send_data(
    ws: aiohttp.ClientWebSocketResponse, encoder: sphn.OpusStreamWriter
):
    """
    Sends audio data to the server.
    """
    while True:
        await asyncio.sleep(0.001)
        opus_data = encoder.read_bytes()
        if len(opus_data) == 0:
            continue
        await ws.send_bytes(b"\x01" + opus_data)


async def decode_data(decoder: sphn.OpusStreamReader, queue: queue.Queue):
    """
    Decode the Opus data in PCM and put it in the queue in chunks of FRAME_SIZE.

    Args:
        decoder: The opus decoder.
        queue: The queue to put the PCM data.
    """
    pcm_data = None
    while True:
        await asyncio.sleep(0.001)  # Wait for the decoder to have some data
        pcm_chunk = decoder.read_pcm()
        pcm_data = (
            np.concatenate((pcm_data, pcm_chunk)) if pcm_data is not None else pcm_chunk
        )
        while pcm_data.shape[-1] >= FRAME_SIZE:
            queue.put(pcm_data[:FRAME_SIZE])
            pcm_data = pcm_data[FRAME_SIZE:]


async def receive_data(
    ws: aiohttp.ClientWebSocketResponse, decoder: sphn.OpusStreamReader
):
    """
    Receives data from the server.
    """
    async for msg in ws:
        match msg.type:
            case aiohttp.WSMsgType.BINARY:
                match msg.data[0:1]:
                    case b"\x01":  # Audio data (opus)
                        decoder.append_bytes(msg.data[1:])
                    case b"\x02":  # Text data
                        print(msg.data[1:].decode("utf-8"), end="", flush=True)
                    case _:
                        continue
            case aiohttp.WSMsgType.CLOSED:
                print("Connection closed.")
                break
            case aiohttp.WSMsgType.ERROR:
                print("Connection error.")
                break
            case _:
                print("Unexpected message type.")
                break


def read_audio_callback(encoder: sphn.OpusStreamWriter):
    """
    Callback to read audio data from the microphone.
    """

    def read_audio(
        indata: np.ndarray, frames: int, time: float, status: sounddevice.CallbackFlags
    ):
        """
        Appends the PCM audio data to the encoder.
        """
        encoder.append_pcm(indata[:, 0])

    return read_audio


def play_audio_callback(queue: queue.Queue):
    """
    Callback to play audio data to the speaker.
    """

    def play_audio(
        outdata: np.ndarray, frames: int, time: float, status: sounddevice.CallbackFlags
    ):
        """
        Gets the PCM audio data from the audio queue and plays it.
        """
        if not queue.empty():
            outdata[:, 0] = queue.get()
        else:
            outdata.fill(0)

    return play_audio


async def main(deployment_id: str, secret_key: str):
    # Endpoint
    uri = f"wss://{deployment_id}.ifr.fr-srr.scaleway.com/api/chat"
    headers = {"Authorization": f"Bearer {secret_key}"}

    # To be removed
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    # Initialize the audio queue, which is used as a jitter buffer to smooth out variations in packet arrival times
    audio_queue = queue.Queue()

    # Initialize opus encoder and decoder
    opus_encoder = sphn.OpusStreamWriter(SAMPLE_RATE)
    opus_decoder = sphn.OpusStreamReader(SAMPLE_RATE)

    # Initialize audio streams
    input_stream = sounddevice.InputStream(
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        blocksize=FRAME_SIZE,
        callback=read_audio_callback(opus_encoder),
    )
    output_stream = sounddevice.OutputStream(
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        blocksize=FRAME_SIZE,
        callback=play_audio_callback(audio_queue),
    )

    # Main business logic
    try:
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(uri, headers=headers, ssl=False) as websocket:
                with input_stream, output_stream:
                    await asyncio.gather(
                        receive_data(websocket, opus_decoder),
                        decode_data(opus_decoder, audio_queue),
                        send_data(websocket, opus_encoder),
                    )
    except aiohttp.client_exceptions.WSServerHandshakeError as e:
        if e.status == 403:
            print("Error: Invalid IAM API key.")
        else:
            print(f"Error: {e}")
    except aiohttp.client_exceptions.ClientConnectorDNSError:
        print("Error: Invalid deployment UUID.")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    aparser = argparse.ArgumentParser()
    aparser.add_argument(
        "-d", "--deployment-id", type=str, help="The model deployment UUID.", required=True
    )
    aparser.add_argument(
        "-k", "--secret-key", type=str, help="The IAM API key.", required=True
    )
    args = aparser.parse_args()

    try:
        asyncio.run(main(args.deployment_id, args.secret_key))
    except KeyboardInterrupt:
        print("Exiting.")
