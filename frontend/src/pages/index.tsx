import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
} from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";
import { Inter } from "next/font/google";
import Head from "next/head";
import { useCallback, useState, useEffect, useMemo, useRef } from "react";

import { PlaygroundConnect } from "@/components/PlaygroundConnect";
import Playground from "@/components/playground/Playground";
import { PlaygroundToast, ToastType } from "@/components/toast/PlaygroundToast";
import { ConfigProvider, useConfig } from "@/hooks/useConfig";
import { ConnectionMode, ConnectionProvider, useConnection } from "@/hooks/useConnection";
import { ToastProvider, useToast } from "@/components/toast/ToasterProvider";

const themeColors = [
  "cyan",
  "green",
  "amber",
  "blue",
  "violet",
  "rose",
  "pink",
  "teal",
];

const inter = Inter({ subsets: ["latin"] });

export default function Home() {
  return (
    <ToastProvider>
      <ConfigProvider>
        <ConnectionProvider>
          <HomeInner />
        </ConnectionProvider>
      </ConfigProvider>
    </ToastProvider>
  );
}

export function HomeInner() {
  const { shouldConnect, wsUrl, token, mode, connect, disconnect } = useConnection();
  const {config} = useConfig();
  const { toastMessage, setToastMessage } = useToast();
  const userDisconnectedRef = useRef(false);

  const handleConnect = useCallback(
    (c: boolean, mode: ConnectionMode = "manual") => {
      if (c) {
        userDisconnectedRef.current = false;
        connect(mode);
      } else {
        userDisconnectedRef.current = true;
        disconnect();
      }
    },
    [connect, disconnect]
  );

  // Auto-connect when component mounts if env variables are present
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_LIVEKIT_URL && !userDisconnectedRef.current) {
      handleConnect(true, "env");
    }
  }, [handleConnect]);

  // Simplified showPG check - always show if env variable exists
  const showPG = Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL);

  return (
    <>
      <Head>
        <title>{config.title}</title>
        <meta name="description" content={config.description} />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={`flex flex-col h-full w-full ${inter.className} bg-black`}>
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              className="left-0 right-0 top-0 absolute z-10"
              initial={{ opacity: 0, translateY: -50 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: -50 }}
            >
              <PlaygroundToast />
            </motion.div>
          )}
        </AnimatePresence>
        <LiveKitRoom
          className="flex flex-col h-full w-full px-4"
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          token={token}
          connect={shouldConnect}
          onError={(e) => {
            setToastMessage({ message: e.message, type: "error" });
            console.error(e);
          }}
        >
          <Playground
            themeColors={themeColors}
            onConnect={(c) => handleConnect(c, "env")}
          />
          <RoomAudioRenderer />
          <StartAudio label="Click to enable audio playback" />
        </LiveKitRoom>
      </main>
    </>
  );
}