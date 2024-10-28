import moshiProcessorUrl from "../../audio-processor.ts?worker&url";
import { FC, useEffect, useState, useCallback, useRef, MutableRefObject } from "react";
import eruda from "eruda";
import { useSearchParams } from "react-router-dom";
import { Conversation } from "../Conversation/Conversation";
import { Button } from "../../components/Button/Button";
import { useModelParams } from "../Conversation/hooks/useModelParams";
import { ModelParams } from "../Conversation/components/ModelParams/ModelParams";
import { env } from "../../env";
import { Input } from "../../components/Input/Input";

export const Queue:FC = () => {
  const [searchParams] = useSearchParams();
  const overrideWorkerAddr = searchParams.get("worker_addr");
  const [hasMicrophoneAccess, setHasMicrophoneAccess] = useState<boolean>(false);
  const [showMicrophoneAccessMessage, setShowMicrophoneAccessMessage] = useState<boolean>(false);
  const [shouldConnect, setShouldConnect] = useState<boolean>(false);
  const modelParams = useModelParams();
  const modalRef = useRef<HTMLDialogElement>(null);
  const [token, setToken] = useState<string>("")
  const [error, setError] = useState<string>("");

  const [updatedModelParams, setUpdatedModelParams] = useState({
    ...modelParams,
    token: token
  });
  useEffect(() => {
    if (updatedModelParams.token !== token) {
      setUpdatedModelParams({
        ...modelParams,
        token: token
      });
    }
  }, [token, modelParams, updatedModelParams.token]); 

  const validateToken = (token: string) => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(token);
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setToken(value);
  };

  const audioContext = useRef<AudioContext | null>(null);
  const worklet = useRef<AudioWorkletNode | null>(null);
  // enable eruda in development
  useEffect(() => {
    if(env.VITE_ENV === "development") {
      eruda.init();
    }
    () => {
      if(env.VITE_ENV === "development") {
        eruda.destroy();
      }
    };
  }, []);

  const getMicrophoneAccess = useCallback(async () => {
    try {
      await window.navigator.mediaDevices.getUserMedia({ audio: true });
      setHasMicrophoneAccess(true);
      return true;
    } catch(e) {
      console.error(e);
      setShowMicrophoneAccessMessage(true);
      setHasMicrophoneAccess(false);
    }
    return false;
}, [setHasMicrophoneAccess, setShowMicrophoneAccessMessage]);

  const startProcessor = useCallback(async () => {
    if(!audioContext.current) {
      audioContext.current = new AudioContext();
    }
    if(worklet.current) {
      return;
    }
    let ctx = audioContext.current;
    ctx.resume();
    try {
      worklet.current = new AudioWorkletNode(ctx, 'moshi-processor');
    } catch (err) {
      await ctx.audioWorklet.addModule(moshiProcessorUrl);
      worklet.current = new AudioWorkletNode(ctx, 'moshi-processor');
    }
    worklet.current.connect(ctx.destination);
  }, [audioContext, worklet]);

  const onConnect = useCallback(async() => {
      if (env.VITE_SECURE !== "") {
        if (!validateToken(token)) {
          setError("The secret key is invalid. Please enter a correct secret key before logging in.");
          return;
        }
      }

      await startProcessor();
      const hasAccess = await getMicrophoneAccess();
      if(hasAccess) {
        setShouldConnect(true);
      }
  }, [setShouldConnect, startProcessor, getMicrophoneAccess, token]);

  if(hasMicrophoneAccess && audioContext.current && worklet.current) {
    return (
      <Conversation
        workerAddr={overrideWorkerAddr ?? ""}
        audioContext={audioContext as MutableRefObject<AudioContext>}
        worklet={worklet as MutableRefObject<AudioWorkletNode>}
        {...updatedModelParams}
      />
    );
  }

  return (
    <div className="text-white text-center h-screen w-screen p-4 flex flex-col items-center ">
      <div>
        <h1 className="text-4xl">Moshi provided by Scaleway</h1>
        {/*
          To add more space to the top add padding to the top of the following div
          by changing the pt-4 class to pt-8 or pt-12. (see: https://tailwindcss.com/docs/padding)
          If you'd like to move this part to the bottom of the screen, change the class to pb-4 or pb-8 and move the following so it is contained by the last one in the page.
          Font size can be changed by changing the text-sm class to text-lg or text-xl. (see : https://tailwindcss.com/docs/font-size)
          As for the links you can use the one below as an example and add more by copying it and changing the href and text.
        */}
        <div className="pt-8 text-sm flex justify-center items-center flex-col ">
          <div className="presentation text-left">
          <p><span className='cute-words'>Moshi</span> is an experimental conversational AI. </p>
          <p>Take everything it says with a grain of <span className='cute-words'>salt</span>.</p>
          <p>Conversations are limited to <span className='cute-words'>5 min</span>.</p>
          <p>Moshi <span className='cute-words'>thinks</span> and <span className='cute-words'>speaks</span> at the same time.</p>
          <p>Moshi can <span className='cute-words'>listen</span> and <span className='cute-words'>talk</span> at all time: <br/>maximum flow between you and <span className='cute-words'>Moshi</span>.</p>
          <p>Ask it to do some <span className='cute-words'>Pirate</span> role play, how to make <span className='cute-words'>Lasagna</span>,
            or what <span className='cute-words'>movie</span> it watched last.</p>
          <p>We strive to support all browsers, Chrome works best.</p>
          <p>Baked with &lt;3 @<a href="https://kyutai.org/" className='cute-words underline'>Kyutai</a>.</p>
          </div>
        </div>
      </div>
      <div className="flex flex-grow justify-center items-center flex-col">
        <>
          {showMicrophoneAccessMessage &&
            <p className="text-center">Please enable your microphone before proceeding</p>
          }
          {env.VITE_SECURE !== "" && (
            <>
              <Input value={token} onChange={handleTokenChange} placeholder="Enter your secretKey" />
              {error && <p className="text-red-500">{error}</p>}
            </>
          )}
          <Button onClick={async () => await onConnect()}>Connect</Button>
          <Button className="absolute top-4 right-4" onClick={()=> modalRef.current?.showModal()}>Settings</Button>
            <dialog ref={modalRef} className="modal">
              <div className="modal-box border-2 border-white rounded-none flex justify-center bg-black">
                <ModelParams {...modelParams} isConnected={shouldConnect} modal={modalRef}/>
              </div>
              <form method="dialog" className="modal-backdrop">
                <button>Close</button>
              </form>
            </dialog>
        </>
      </div>
      <div className="text-center flex justify-end items-center flex-col">
        <a target="_blank" href="https://kyutai.org/moshi-terms.pdf" className="text-center">Terms of Use</a>
        <a target="_blank" href="https://kyutai.org/moshi-privacy.pdf" className="text-center">Privacy Policy</a>
      </div>
    </div>
  )
};
