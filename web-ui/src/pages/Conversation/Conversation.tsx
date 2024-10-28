import { FC, MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "./hooks/useSocket";
import { SocketContext } from "./SocketContext";
import { ServerAudio } from "./components/ServerAudio/ServerAudio";
import { UserAudio } from "./components/UserAudio/UserAudio";
import { Button } from "../../components/Button/Button";
import { ServerAudioStats } from "./components/ServerAudio/ServerAudioStats";
import { AudioStats } from "./hooks/useServerAudio";
import { TextDisplay } from "./components/TextDisplay/TextDisplay";
import { MediaContext } from "./MediaContext";
import { ServerInfo } from "./components/ServerInfo/ServerInfo";
import { ModelParamsValues, useModelParams } from "./hooks/useModelParams";
import { ModelParams } from "./components/ModelParams/ModelParams";
import fixWebmDuration from "webm-duration-fix";
import canvasLogo from "./canvas-logo.png";
import { getMimeType, getExtension } from "./getMimeType";
import { env } from "../../env";

type ConversationProps = {
  workerAddr: string;
  workerAuthId?: string;
  sessionAuthId?: string;
  sessionId?: number;
  email?: string;
  audioContext: MutableRefObject<AudioContext>;
  worklet: MutableRefObject<AudioWorkletNode>;
  onConversationEnd?: () => void;
  isBypass?: boolean;
} & Partial<ModelParamsValues>;


const buildURL = ({
  params,
  workerAuthId,
  email,
  textSeed,
  audioSeed,
}: {
  workerAddr: string;
  params: ModelParamsValues;
  workerAuthId?: string;
  email?: string;
  textSeed: number;
  audioSeed: number;
}) => {
  // if (workerAddr == "same" || workerAddr == "") {
  //   workerAddr = window.location.hostname + ":" + window.location.port;
  //   console.log("Overriding workerAddr to", workerAddr);
  // }
  const wsProtocol = (window.location.protocol === 'https:') ? 'wss' : 'ws';
  const url = new URL(`${wsProtocol}://${env.VITE_API_URL}/api/chat`);
  if(workerAuthId) {
    url.searchParams.append("worker_auth_id", workerAuthId);
  }
  if(email) {
    url.searchParams.append("email", email);
  }
  url.searchParams.append("text_temperature", params.textTemperature.toString());
  url.searchParams.append("text_topk", params.textTopk.toString());
  url.searchParams.append("audio_temperature", params.audioTemperature.toString());
  url.searchParams.append("audio_topk", params.audioTopk.toString());
  url.searchParams.append("pad_mult", params.padMult.toString());
  url.searchParams.append("text_seed", textSeed.toString());
  url.searchParams.append("audio_seed", audioSeed.toString());
  url.searchParams.append("repetition_penalty_context", params.repetitionPenaltyContext.toString());
  url.searchParams.append("repetition_penalty", params.repetitionPenalty.toString());
  if (params.token && params.token != "")
    url.searchParams.append("token", params.token);
  // console.log(url.toString());
  return url.toString();
};

export const Conversation:FC<ConversationProps> = ({
  workerAddr,
  workerAuthId,
  audioContext,
  worklet,
  sessionAuthId,
  sessionId,
  onConversationEnd,
  isBypass=false,
  email,
  ...params
}) => {
  const getAudioStats = useRef<() => AudioStats>(() => ({
    playedAudioDuration: 0,
    missedAudioDuration: 0,
    totalAudioMessages: 0,
    delay: 0,
    minPlaybackDelay: 0,
    maxPlaybackDelay: 0,
  }));
  const isRecording = useRef<boolean>(false);
  const videoChunks = useRef<Blob[]>([]);
  const audioChunks = useRef<Blob[]>([]);

  const audioStreamDestination = useRef<MediaStreamAudioDestinationNode>(audioContext.current.createMediaStreamDestination());
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioRecorder = useRef<MediaRecorder>(new MediaRecorder(audioStreamDestination.current.stream, { mimeType: getMimeType("audio"), audioBitsPerSecond: 128000  }));
  const [videoURL, setVideoURL] = useState<string>("");
  const [audioURL, setAudioURL] = useState<string>("");
  const [isOver, setIsOver] = useState(false);
  const modelParams = useModelParams(params);
  const micDuration = useRef<number>(0);
  const actualAudioPlayed = useRef<number>(0);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const textSeed = useMemo(() => Math.round(1000000 * Math.random()), []);
  const audioSeed = useMemo(() => Math.round(1000000 * Math.random()), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const [isLogoLoaded, setIsLogoLoaded] = useState(false);

  const WSURL = buildURL({
    workerAddr,
    params: {...modelParams, token: params.token},
    workerAuthId,
    email: email,
    textSeed: textSeed,
    audioSeed: audioSeed,
  });

  const onDisconnect = useCallback(() => {
    setIsOver(true);
    console.log("on disconnect!");
    stopRecording();
  }, [setIsOver]);

  const { isConnected, sendMessage, socket, start, stop } = useSocket({
    // onMessage,
    uri: WSURL,
    onDisconnect,
  });
  useEffect(() => {
    audioRecorder.current.ondataavailable = (e) => {
      audioChunks.current.push(e.data);
    };
    audioRecorder.current.onstop = async () => {
      let blob: Blob;
      const mimeType = getMimeType("audio");
      if(mimeType.includes("webm")) {
        blob = await fixWebmDuration(new Blob(audioChunks.current, { type: mimeType }));
        } else {
          blob = new Blob(audioChunks.current, { type: mimeType });
      }
      setAudioURL(URL.createObjectURL(blob));
      audioChunks.current = [];
      console.log("Audio Recording and encoding finished");
    };
  }, [mediaRecorder, audioRecorder, setVideoURL, setAudioURL, videoChunks, audioChunks]);


  useEffect(() => {
    start();
    return () => {
      stop();
    };
  }, [start, workerAuthId]);

  useEffect(() => {

    if(!canvasRef) {
      console.log("No canvas ref");
      return;
    }
    if(!logoRef) {
      console.log("No logo ref");
      return;
    }
    if(!isLogoLoaded) {
      console.log("Logo not loaded");
      return;
    }
    if(!canvasRef.current) {
      console.log("No canvas");
      return;
    }
    if(!logoRef.current) {
      console.log("No logo");
      return;
    }

    const ctx = canvasRef.current.getContext("2d");
    if(ctx) {
      ctx.drawImage(logoRef.current, 20, 250 , 320, 98);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "white";
      ctx.strokeRect(5, 5, 370, 370);
    }
  }, [canvasRef, logoRef, isLogoLoaded]);

  const startRecording = useCallback(() => {
    if(isRecording.current) {
      return;
    }
    console.log(Date.now() % 1000, "Starting recording");
    console.log("Starting recording");
    if(canvasRef.current) {
      // Note: Attaching a track from this stream to the existing MediaRecorder
      // rather than creating a new MediaRecorder for the canvas stream
      // doesn't work on Safari as it just ends the recording immediately.
      // It works on Chrome though and is much cleaner.
      console.log("Adding canvas to stream");
      const captureStream = canvasRef.current.captureStream(30);
      captureStream.addTrack(audioStreamDestination.current.stream.getAudioTracks()[0]);
      mediaRecorder.current = new MediaRecorder(captureStream, { mimeType: getMimeType("video"), videoBitsPerSecond: 1000000});
      mediaRecorder.current.ondataavailable = (e) => {
        console.log("Video data available");
        videoChunks.current.push(e.data);
      };
      mediaRecorder.current.onstop = async () => {
        let blob: Blob;
        const mimeType = getMimeType("video");
        if(mimeType.includes("webm")) {
          blob = await fixWebmDuration(new Blob(videoChunks.current, { type: mimeType }));
        } else {
          blob = new Blob(videoChunks.current, { type: mimeType });
        }
        setVideoURL(URL.createObjectURL(blob));
        videoChunks.current = [];
        console.log("Video Recording and encoding finished");
      };
    }
    worklet.current?.connect(audioStreamDestination.current);
    // videoStream.current.addTrack(audioStreamDestination.current.stream.getAudioTracks()[0]);

    setVideoURL("");
    setAudioURL("");
    mediaRecorder.current?.start();
    audioRecorder.current.start();
    isRecording.current = true;
  }, [isRecording, setVideoURL, setVideoURL, worklet, audioStreamDestination, mediaRecorder, audioRecorder, canvasRef]);

  const stopRecording = useCallback(() => {
    console.log("Stopping recording");
    console.log("isRecording", isRecording)
    if(!isRecording.current) {
      return;
    }
    worklet.current?.disconnect(audioStreamDestination.current);
    audioRecorder.current.stop();
    mediaRecorder.current?.stop();
    isRecording.current = false;
  }, [isRecording, worklet, audioStreamDestination, mediaRecorder, audioRecorder]);


  return (
    <SocketContext.Provider
      value={{
        isConnected,
        sendMessage,
        socket,
      }}
    >
    <MediaContext.Provider value={
      {
        startRecording,
        stopRecording,
        audioContext,
        worklet,
        audioStreamDestination,
        micDuration,
        actualAudioPlayed,
      }
    }>
    <div>
    <div className="main-grid h-screen max-h-screen w-screen p-4 max-w-96 md:max-w-screen-lg m-auto">
      <div className="controls text-center flex justify-center items-center gap-2">
         {isOver && !isBypass && (
            <Button
              onClick={() => {
                // Reload the page to reset the conversation on iOS
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
                if(onConversationEnd && !isIOS) {
                  onConversationEnd();
                  return;
                }
                document.location.reload();
              }}
            >
              Start Over
            </Button>
          )
        }
        {
          (!isOver || isBypass) && (
            <Button
              onClick={() => {
                audioContext.current.resume();
                isConnected ? stop() : start();
              }}
            >
              {!isConnected ? "Connect" : "Disconnect"}
            </Button>
          )
        }
          <div className={`h-4 w-4 rounded-full ${isConnected ? 'bg-green-700': 'bg-red-700'}`} />
        </div>
          <div className="relative player h-full max-h-full w-full justify-between gap-3 border-2 border-white  md:p-12">
              <ServerAudio
                copyCanvasRef={canvasRef}
                setGetAudioStats={(callback: () => AudioStats) =>
                  (getAudioStats.current = callback)
                }
              />
              <UserAudio copyCanvasRef={canvasRef}/>
              <div className="pt-8 text-sm flex justify-center items-center flex-col download-links">
                {audioURL && <div><a href={audioURL} download={`moshi audio.${getExtension("audio")}`} className="pt-2 text-center block">Download audio</a></div>}
                {videoURL && <div><a href={videoURL} download={`moshi video.${getExtension("video")}`} className="pt-2 text-center">Download video</a></div>}
                {videoURL && getExtension("video") === "webm" && <div><a href="https://restream.io/tools/webm-to-mp4-converter" target="_blank" rel="noreferrer" className="explain-links pt-2 text-center italic block">How to convert to mp4</a></div>}
              </div>
          </div>
          <div className="scrollbar player-text border-2 border-white " ref={textContainerRef}>
            <TextDisplay containerRef={textContainerRef}/>
          </div>
          <div className="player-stats hidden md:block">
            <ServerAudioStats getAudioStats={getAudioStats} />
          </div>
        </div>
        <div className="max-w-96 md:max-w-screen-lg p-4 m-auto text-center">
          <ServerInfo/>
          {!workerAuthId && <ModelParams {...modelParams} isConnected={isConnected} /> }
        </div>
        <canvas height={380} width={380} className="hidden" ref={canvasRef} />
        <img src={canvasLogo} ref={logoRef} className="hidden" onLoad={() => {
          console.log("Logo loaded");
          setIsLogoLoaded(true);
        }} />
      </div>
      </MediaContext.Provider>
    </SocketContext.Provider>
  );
};
