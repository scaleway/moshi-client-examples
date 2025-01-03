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
    deploymentUuid: string;
    defaultRegion: string;
    iamApiKey: string;
    insecure: boolean;
}

const argv = yargs(hideBin(process.argv))
    .option('deployment-uuid', {
        alias: 'd',
        type: 'string',
        demandOption: true,
        describe: 'The deployment UUID to which the endpoint is associated.',
    })
    .option('default-region', {
        alias: 'r',
        type: 'string',
        default: 'fr-par',
        describe: 'The default region of the deployment.',
    })
    .option('iam-api-key', {
        alias: 'k',
        type: 'string',
        describe: 'The IAM API key that secures your endpoint.',
    })
    .option('insecure', {
        type: 'boolean',
        default: false,
        describe: 'Skip SSL certificate validation.',
    })
    .parseSync();

const { deploymentUuid, defaultRegion, iamApiKey, insecure } = argv as Args;

const WS_URI = `wss://${deploymentUuid}.ifr.${defaultRegion}.scaleway.com/api/chat`;

const audioQueue = new Queue<Buffer>();
let decodeBuffer = Buffer.alloc(0);

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
    rejectUnauthorized: !insecure,
});

ws.on('open', () => {
    micInstance.start();
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
    cleanup();
});

ws.on('error', error => {
    if (error.message.includes('Unexpected server response: 403')) {
        console.error('Error: Invalid IAM API key');
    } else if (error.message.includes('getaddrinfo ENOTFOUND')) {
        console.error(`Error: Invalid deployment '${deploymentUuid}' or region '${defaultRegion}'`);
    } else {
        console.error('Error:', error);
    }
    cleanup();
});

// Audio encoding and sending via WebSocket
micInputStream.pipe(encodeProcess.stdin as unknown as Readable);
encodeProcess.stdout.on('data', (data: Buffer) => {
    ws.send(Buffer.concat([Buffer.from([1]), data]));
});

decodeProcess.stdout.on('data', (data: Buffer) => {
    decodeBuffer = Buffer.concat([decodeBuffer, data]);

    while (decodeBuffer.length >= FRAME_SIZE) {
        const frame = decodeBuffer.subarray(0, FRAME_SIZE);
        decodeBuffer = decodeBuffer.subarray(FRAME_SIZE);
        audioQueue.enqueue(frame);
    }
});

// Process audio queue and play through speaker
audioQueue.on('enqueue', () => {
    while (!audioQueue.isEmpty()) {
        const pcmData = audioQueue.dequeue();
        if (pcmData) speakerInstance.write(pcmData);
    }
});

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
