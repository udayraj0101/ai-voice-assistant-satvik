import { useState } from "react";
import { CloudLightning, CloudOff, MessageSquare } from "react-feather";
import Button from "./Button";

function SessionStopped({ startSession }) {
  const [isActivating, setIsActivating] = useState(false);

  function handleStartSession() {
    if (isActivating) return;

    setIsActivating(true);
    startSession();
  }

  return (
    <div className="flex items-center justify-center w-full h-full">
      <Button
        onClick={handleStartSession}
        className={isActivating ? "bg-gray-600" : "bg-blue-600"}
        icon={<CloudLightning height={16} />}
      >
        {isActivating ? "starting session..." : "start session"}
      </Button>
    </div>
  );
}

function SessionActive({ stopSession, sessionId }) {
  return (
    <div className="flex items-center justify-center w-full h-full gap-4">
      <div className="text-center">
        <div className="mb-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-100 flex items-center justify-center animate-pulse">
            <div className="w-6 h-6 rounded-full bg-red-400"></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">Voice conversation active</p>
          {sessionId && (
            <p className="text-xs text-gray-400">Session: {sessionId.slice(0, 8)}...</p>
          )}
        </div>
        <Button onClick={stopSession} icon={<CloudOff height={16} />} className="bg-red-600">
          End Call
        </Button>
      </div>
    </div>
  );
}

export default function SessionControls({
  startSession,
  stopSession,
  sendClientEvent,
  sendTextMessage,
  events,
  isSessionActive,
  sessionId,
}) {
  return (
    <div className="flex gap-4 border-t-2 border-gray-200 h-full rounded-md">
      {isSessionActive ? (
        <SessionActive
          stopSession={stopSession}
          sessionId={sessionId}
        />
      ) : (
        <SessionStopped startSession={startSession} />
      )}
    </div>
  );
}