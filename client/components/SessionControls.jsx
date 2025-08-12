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

function SessionActive({ stopSession, sessionId, timeRemaining, showHandoffMessage }) {
  const [showQueryTypes, setShowQueryTypes] = useState(false);
  
  const queryTypes = [
    { id: 'pricing', label: 'Pricing Info' },
    { id: 'technical', label: 'Technical Details' },
    { id: 'appointment', label: 'Book Appointment' },
    { id: 'complaint', label: 'Complaint/Issue' },
    { id: 'general', label: 'General Inquiry' }
  ];
  
  function handleEndCall(queryType = 'unknown') {
    stopSession(queryType);
    setShowQueryTypes(false);
  }
  
  if (showHandoffMessage) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 flex items-center justify-center animate-pulse mb-4">
            <div className="w-6 h-6 rounded-full bg-blue-400"></div>
          </div>
          <p className="text-sm text-blue-600 font-medium">Connecting to human agent...</p>
          <p className="text-xs text-gray-500 mt-1">Please hold on</p>
        </div>
      </div>
    );
  }

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
        
        {showQueryTypes ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-600 mb-2">What was your query about?</p>
            {queryTypes.map(type => (
              <button
                key={type.id}
                onClick={() => handleEndCall(type.id)}
                className="block w-full px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                {type.label}
              </button>
            ))}
            <button
              onClick={() => setShowQueryTypes(false)}
              className="text-xs text-gray-500 underline mt-2"
            >
              Cancel
            </button>
          </div>
        ) : (
          <Button 
            onClick={() => setShowQueryTypes(true)} 
            icon={<CloudOff height={16} />} 
            className="bg-red-600"
          >
            End Call
          </Button>
        )}
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
  timeRemaining,
  showHandoffMessage,
}) {
  return (
    <div className="flex gap-4 border-t-2 border-gray-200 h-full rounded-md">
      {isSessionActive ? (
        <SessionActive
          stopSession={stopSession}
          sessionId={sessionId}
          timeRemaining={timeRemaining}
          showHandoffMessage={showHandoffMessage}
        />
      ) : (
        <SessionStopped startSession={startSession} />
      )}
    </div>
  );
}