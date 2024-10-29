import { useState, useEffect, useCallback, useRef } from "react";
import { WSMessage } from "../../../protocol/types";
import { decodeMessage, encodeMessage } from "../../../protocol/encoder";

export const useSocket = ({
  onMessage,
  uri,
  onDisconnect: onDisconnectProp,
}: {
  onMessage?: (message: WSMessage) => void;
  uri: string;
  onDisconnect?: () => void;
}) => {
  const lastMessageTime = useRef<null|number>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  const sendMessage = useCallback(
    (message: WSMessage) => {
      if (!socket || !isConnected) {
        return;
      }
      socket.send(encodeMessage(message));
    },
    [isConnected],
  );

  const onConnect = useCallback(() => {
    // setIsConnected(true);
  }, [setIsConnected]);

  const onDisconnect = useCallback(() => {
    if (onDisconnectProp) {
      onDisconnectProp();
    }
    setIsConnected(false);
  }, [onDisconnectProp]);

  const onMessageEvent = useCallback(
    (eventData: MessageEvent) => {
      lastMessageTime.current = Date.now();
      const dataArray = new Uint8Array(eventData.data);
      const message = decodeMessage(dataArray);
      if (message.type == "handshake") {
        setIsConnected(true);
      }
      if (!onMessage) {
        return;
      }
      onMessage(message);
    },
    [onMessage, setIsConnected],
  );

  const onErrorEvent = useCallback((errorEvent: Event) => {
    console.error("WebSocket error observed:", errorEvent);
  }, []);


  const start = useCallback(() => {
    const ws = new WebSocket(uri);
    // const ws = new WebSocket("wss://bf7c753a-6da3-4425-a6cd-42f668b52aee.ifr.fr-srr.scaleway.com/api/chat?text_temperature=0.7&text_topk=25&audio_temperature=0.8&audio_topk=250&pad_mult=0&repetition_penalty_context=64&repetition_penalty=1&text_seed=776919&audio_seed=278161&token=66dbeb96-6357-4788-96ad-0c5733607c6a");
    

    ws.binaryType = "arraybuffer";
    ws.addEventListener("open", onConnect);
    ws.addEventListener("close", onDisconnect);
    ws.addEventListener("message", onMessageEvent);
    ws.addEventListener("error", onErrorEvent); // Ajout du gestionnaire d'erreur

    setSocket(ws);
    lastMessageTime.current = Date.now();
  }, [uri, onMessage, onDisconnectProp]);

  const stop = useCallback(() => {
      setIsConnected(false);
      if (onDisconnectProp) {
        onDisconnectProp();
      }
      socket?.close();
      setSocket(null);
  }, [socket]);

  useEffect(() => {
    if(!isConnected){
      return;
    }
    let intervalId = setInterval(() => {
      if (lastMessageTime.current && Date.now() - lastMessageTime.current > 10000) {
        socket?.close();
        onDisconnect();
        clearInterval(intervalId);
      }
    }, 500);

    return () => {
      lastMessageTime.current = null;
      clearInterval(intervalId);
    };
  }, [isConnected, socket]);

  return {
    isConnected,
    socket,
    sendMessage,
    start,
    stop,
  };
};
