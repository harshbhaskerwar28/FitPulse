"use client";

import { LoadingSVG } from "@/components/button/LoadingSVG";
import { ChatMessageType } from "@/components/chat/ChatTile";
import { PlaygroundHeader } from "./PlaygroundHeader";
import {
  PlaygroundTab,
  PlaygroundTabbedTile,
  PlaygroundTile,
} from "./PlaygroundTile";
import { useConfig } from "@/hooks/useConfig";
import { TranscriptionTile } from "@/transcriptions/TranscriptionTile";
import {
  BarVisualizer,
  VideoTrack,
  useConnectionState,
  useDataChannel,
  useLocalParticipant,
  useRoomInfo,
  useTracks,
  useVoiceAssistant,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState, LocalParticipant, Track } from "livekit-client";
import { ReactNode, useCallback, useEffect, useMemo, useState, useRef } from "react";
import tailwindTheme from "../../lib/tailwindTheme.preval";

export interface PlaygroundMeta {
  name: string;
  value: string;
}

export interface PlaygroundProps {
  logo?: ReactNode;
  themeColors: string[];
  onConnect: (connect: boolean, opts?: { token: string; url: string }) => void;
}

const headerHeight = 56;

export default function Playground({
  logo,
  themeColors,
  onConnect,
}: PlaygroundProps) {
  const { config, setUserSettings } = useConfig();
  const { name } = useRoomInfo();
  const [transcripts, setTranscripts] = useState<ChatMessageType[]>([]);
  const { localParticipant } = useLocalParticipant();
  const [chatEnabled, setChatEnabled] = useState<boolean>(config.settings.chat);

  const voiceAssistant = useVoiceAssistant();

  const roomState = useConnectionState();
  const tracks = useTracks();
  const room = useRoomContext();

  const [rpcMethod, setRpcMethod] = useState("");
  const [rpcPayload, setRpcPayload] = useState("");

  // Add a ref to track if we've connected before to prevent auto-reconnection
  const hasConnectedBefore = useRef(false);

  useEffect(() => {
    if (roomState === ConnectionState.Connected) {
      hasConnectedBefore.current = true;
      localParticipant.setCameraEnabled(config.settings.inputs.camera);
      localParticipant.setMicrophoneEnabled(config.settings.inputs.mic);
    }
  }, [config, localParticipant, roomState]);

  // Keep chatEnabled state in sync with config
  useEffect(() => {
    setChatEnabled(config.settings.chat);
  }, [config.settings.chat]);

  const agentVideoTrack = tracks.find(
    (trackRef) =>
      trackRef.publication.kind === Track.Kind.Video &&
      trackRef.participant.isAgent
  );

  const localTracks = tracks.filter(
    ({ participant }) => participant instanceof LocalParticipant
  );
  const localVideoTrack = localTracks.find(
    ({ source }) => source === Track.Source.Camera
  );
  const localMicTrack = localTracks.find(
    ({ source }) => source === Track.Source.Microphone
  );
  const localScreenTrack = localTracks.find(
    ({ source }) => source === Track.Source.ScreenShare
  );

  const onDataReceived = useCallback(
    (msg: any) => {
      if (msg.topic === "transcription") {
        const decoded = JSON.parse(
          new TextDecoder("utf-8").decode(msg.payload)
        );
        let timestamp = new Date().getTime();
        if ("timestamp" in decoded && decoded.timestamp > 0) {
          timestamp = decoded.timestamp;
        }
        setTranscripts([
          ...transcripts,
          {
            name: "You",
            message: decoded.text,
            timestamp: timestamp,
            isSelf: true,
          },
        ]);
      }
    },
    [transcripts]
  );

  useDataChannel(onDataReceived);

  const videoTileContent = useMemo(() => {
    const videoFitClassName = `object-${config.video_fit || "cover"}`;

    const disconnectedContent = (
      <div className="flex items-center justify-center text-gray-700 text-center w-full h-full">
        No video track. Connect to get started.
      </div>
    );

    const videoContent = (
      <VideoTrack
        trackRef={agentVideoTrack}
        className={`absolute top-1/2 -translate-y-1/2 ${videoFitClassName} object-position-center w-full h-full`}
      />
    );

    let content = null;
    if (roomState === ConnectionState.Disconnected) {
      content = disconnectedContent;
    } else if (agentVideoTrack) {
      content = videoContent;
    } else {
      content = disconnectedContent;
    }

    return (
      <div className="flex flex-col w-full grow text-gray-950 bg-black rounded-sm border border-gray-800 relative">
        {content}
      </div>
    );
  }, [agentVideoTrack, config, roomState]);

  useEffect(() => {
    document.body.style.setProperty(
      "--lk-theme-color",
      // @ts-ignore
      tailwindTheme.colors[config.settings.theme_color]["500"]
    );
    document.body.style.setProperty(
      "--lk-drop-shadow",
      `var(--lk-theme-color) 0px 0px 18px`
    );
  }, [config.settings.theme_color]);

  const audioTileContent = useMemo(() => {
    const disconnectedContent = (
      <div className="flex flex-col items-center justify-center gap-2 text-gray-700 text-center w-full">
        No audio track. Connect to get started.
      </div>
    );

    const waitingContent = (
      <div className="flex flex-col items-center justify-center gap-2 text-gray-700 text-center w-full">
        <LoadingSVG />
        Waiting for interviewer
      </div>
    );

    const visualizerContent = (
      <div
        className={`flex items-center justify-center w-full h-48 [--lk-va-bar-width:30px] [--lk-va-bar-gap:20px] [--lk-fg:var(--lk-theme-color)]`}
      >
        <BarVisualizer
          state={voiceAssistant.state}
          trackRef={voiceAssistant.audioTrack}
          barCount={5}
          options={{ minHeight: 20 }}
        />
      </div>
    );

    if (roomState === ConnectionState.Disconnected) {
      return disconnectedContent;
    }

    if (!voiceAssistant.audioTrack) {
      return waitingContent;
    }

    return visualizerContent;
  }, [
    voiceAssistant.audioTrack,
    config.settings.theme_color,
    roomState,
    voiceAssistant.state,
  ]);

  const userAudioTileContent = useMemo(() => {
    const disconnectedContent = (
      <div className="flex flex-col items-center justify-center gap-2 text-gray-700 text-center w-full">
        No audio track. Connect to get started.
      </div>
    );

    const waitingContent = (
      <div className="flex flex-col items-center justify-center gap-2 text-gray-700 text-center w-full h-full">
        <LoadingSVG />
        Waiting for microphone
      </div>
    );

    if (roomState === ConnectionState.Disconnected) {
      return disconnectedContent;
    }

    const hasCamera = localParticipant?.isCameraEnabled && localVideoTrack;
    const hasMic = localParticipant?.isMicrophoneEnabled && localMicTrack;
    const hasScreenShare = localParticipant?.isScreenShareEnabled && localScreenTrack;

    return (
      <div className="flex w-full h-full gap-4">
        {hasScreenShare && (
          <div className="w-full relative overflow-hidden rounded-sm border border-gray-800">
            <VideoTrack
              trackRef={localScreenTrack}
              className="w-full h-full object-contain"
            />
          </div>
        )}
        
        {!hasScreenShare && (
          <>
            {hasCamera && (
              <div className="w-3/5 relative overflow-hidden rounded-sm border border-gray-800">
                <VideoTrack
                  trackRef={localVideoTrack}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            {hasMic && (
              <div className={`flex items-center justify-center ${hasCamera ? 'w-2/5' : 'w-full'} h-full [--lk-va-bar-width:30px] [--lk-va-bar-gap:20px] [--lk-fg:var(--lk-theme-color)]`}>
                <BarVisualizer
                  trackRef={localMicTrack}
                  barCount={5}
                  options={{ minHeight: 20 }}
                />
              </div>
            )}
          </>
        )}
        
        {!hasCamera && !hasMic && !hasScreenShare && waitingContent}
      </div>
    );
  }, [
    localMicTrack,
    localVideoTrack,
    localScreenTrack,
    config.settings.theme_color,
    roomState,
    localParticipant?.isCameraEnabled,
    localParticipant?.isMicrophoneEnabled,
    localParticipant?.isScreenShareEnabled
  ]);

  const chatTileContent = useMemo(() => {
    if (voiceAssistant.agent) {
      return (
        <TranscriptionTile
          agentAudioTrack={voiceAssistant.audioTrack}
          accentColor={config.settings.theme_color}
        />
      );
    }
    return <></>;
  }, [config.settings.theme_color, voiceAssistant.audioTrack, voiceAssistant.agent]);

  const handleRpcCall = useCallback(async () => {
    if (!voiceAssistant.agent || !room) return;
    
    try {
      const response = await room.localParticipant.performRpc({
        destinationIdentity: voiceAssistant.agent.identity,
        method: rpcMethod,
        payload: rpcPayload,
      });
      console.log('RPC response:', response);
    } catch (e) {
      console.error('RPC call failed:', e);
    }
  }, [room, rpcMethod, rpcPayload, voiceAssistant.agent]);

  let mobileTabs: PlaygroundTab[] = [];
  
  mobileTabs.push({
    title: "Interviewer",
    content: (
      <PlaygroundTile
        className="w-full h-full grow"
        childrenClassName="justify-center"
      >
        {audioTileContent}
      </PlaygroundTile>
    ),
  });

  mobileTabs.push({
    title: "You",
    content: (
      <PlaygroundTile
        className="w-full h-full grow"
        childrenClassName="justify-center"
      >
        {userAudioTileContent}
      </PlaygroundTile>
    ),
  });

  if (config.settings.chat && chatEnabled) {
    mobileTabs.push({
      title: "Chat",
      content: chatTileContent,
    });
  }

  return (
    <>
      <PlaygroundHeader
        title={config.title}
        logo={logo}
        githubLink={config.github_link}
        height={headerHeight}
        accentColor={config.settings.theme_color}
        connectionState={roomState}
        onConnectClicked={() =>
          onConnect(roomState === ConnectionState.Disconnected)
        }
        onChatToggle={() => setChatEnabled(!chatEnabled)}
      />
      <div
        className={`flex gap-4 py-4 grow w-full selection:bg-${config.settings.theme_color}-900 overflow-hidden`}
        style={{ height: `calc(100% - ${headerHeight}px)` }}
      >
        {/* Mobile View */}
        <div className="flex flex-col w-full h-full lg:hidden">
          <PlaygroundTabbedTile
            className="h-[calc(100%-2rem)]"
            tabs={mobileTabs}
            initialTab={0}
          />
        </div>

        {/* Desktop View */}
        <div className="hidden lg:flex w-full h-full gap-4 flex-1">
          <div className={`flex ${!chatEnabled ? 'flex-row w-full' : 'flex-col w-[70%]'} gap-4 min-w-[320px] h-full`}>
            <PlaygroundTile
              title="Interviewer"
              className={!chatEnabled ? 'w-[30%]' : 'h-1/2'}
              childrenClassName="justify-center h-full"
            >
              {audioTileContent}
            </PlaygroundTile>
            <PlaygroundTile
              title="You"
              className={!chatEnabled ? 'w-[70%]' : 'h-1/2'}
              childrenClassName="justify-center h-full"
            >
              {userAudioTileContent}
            </PlaygroundTile>
          </div>

          {config.settings.chat && chatEnabled && (
            <PlaygroundTile
              title="Chat"
              className="w-[30%] min-w-[240px] h-full"
            >
              {chatTileContent}
            </PlaygroundTile>
          )}
        </div>
      </div>
    </>
  );
}
