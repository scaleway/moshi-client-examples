import WebSocket from 'ws';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { Readable } from 'stream';
import Speaker from 'speaker';
import mic from 'mic';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { Queue } from './queue';

const SAMPLE_RATE = 24000;
const CHANNELS = 1;
const FRAME_SIZE = 1920;

interface Args {
    deploymentID: string;
    iamApiKey: string;
}

const argv = yargs(hideBin(process.argv))
    .option('deploymentID', { alias: 'd', type: 'string', demandOption: true, describe: 'The deployment UUID.' })
    .option('iamApiKey', { alias: 'k', type: 'string', demandOption: true, describe: 'The IAM API key.' })
    .parseSync();

const { deploymentID, iamApiKey } = argv as Args;

const WS_URI = `wss://${deploymentID}.ifr.fr-srr.scaleway.com/api/chat`;

const audioQueue = new Queue<Buffer>();

// Create FFmpeg encoding and decoding processes
const createFFmpegProcess = (args: string[]): ChildProcessWithoutNullStreams => {
    const process = spawn('ffmpeg', args);
    process.stderr.on('data', data => console.error('FFmpeg error:', data.toString()));
    return process;
};

const encodeProcess = createFFmpegProcess([
    '-hide_banner', '-loglevel', 'error',
    '-f', 's16le', '-ar', SAMPLE_RATE.toString(),
    '-ac', CHANNELS.toString(), '-i', '-',
    '-c:a', 'libopus', '-b:a', '64k', '-f', 'ogg', 'pipe:1',
]);

const decodeProcess = createFFmpegProcess([
    '-hide_banner', '-loglevel', 'error', '-re',
    '-f', 'ogg', '-c:a', 'opus', '-i', '-',
    '-filter_complex', 'asetpts=N/SR/TB',
    '-f', 's16le', '-ar', SAMPLE_RATE.toString(),
    '-ac', CHANNELS.toString(), 'pipe:1',
]);

// Initialize microphone and speaker
const micInstance = mic({
    rate: SAMPLE_RATE.toString(),
    channels: CHANNELS.toString(),
    debug: false,
    exitOnSilence: 6,
});
const micInputStream = micInstance.getAudioStream();

const speakerInstance = new Speaker({
    channels: CHANNELS,
    sampleRate: SAMPLE_RATE,
    bitDepth: 16,
});

// Configure WebSocket connection
const ws = new WebSocket(WS_URI, {
    headers: { 'Authorization': `Bearer ${iamApiKey}` },
    rejectUnauthorized: false,
});

ws.on('open', () => {
    console.log('WebSocket connection established.');
    micInstance.start();
    console.log('Recording started...');
});

ws.on('message', (data: WebSocket.Data) => {
    if (data instanceof Buffer) {
        const type = data[0];
        if (type === 1) { // Audio data
            decodeProcess.stdin.write(data.subarray(1));
        } else if (type === 2) { // Text data
            process.stdout.write(data.toString());
        }
    }
});

ws.on('close', () => {
    console.log('WebSocket connection closed.');
    cleanup();
});

ws.on('error', error => console.error('WebSocket error:', error));

// Audio encoding and sending via WebSocket
micInputStream.pipe(encodeProcess.stdin as unknown as Readable);
encodeProcess.stdout.on('data', (data: Buffer) => {
    ws.send(Buffer.concat([Buffer.from([1]), data]));
});

decodeProcess.stdout.on('data', (data: Buffer) => {
    audioQueue.enqueue(data);
});

// Process audio queue and play through speaker
const processAudioQueue = () => {
    while (!audioQueue.isEmpty()) {
        const pcmData = audioQueue.dequeue();
        if (pcmData) speakerInstance.write(pcmData);
    }
};

audioQueue.on('enqueue', processAudioQueue);

// Cleanup function for shutdown
const cleanup = () => {
    micInstance.stop();
    encodeProcess.stdin.end();
    decodeProcess.stdin.end();
    ws.close();
    process.exit();
};

process.on('SIGINT', () => {
    console.log("User interrupted. Closing...");
    cleanup();
});
