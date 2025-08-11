import { useEffect, useRef, useState } from "react";
import logo from "/assets/ai_voice_generator.png";
import aiLogo from "/assets/ai_voice_generator.png";
import SessionControls from "./SessionControls";

export default function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);
  const [assistantMessage, setAssistantMessage] = useState("Hello! I'm your AI voice assistant. Click 'start session' to begin.");
  const [sessionId, setSessionId] = useState(null);

  async function startSession() {
    try {
      // Get a session token for OpenAI Realtime API
      const tokenResponse = await fetch("/token");
      const data = await tokenResponse.json();
      
      if (!data.client_secret?.value) {
        throw new Error('Invalid token response');
      }
      
      const EPHEMERAL_KEY = data.client_secret.value;
      setSessionId(data.sessionId);

    // Create a peer connection
    const pc = new RTCPeerConnection();

    // Set up to play remote audio from the model
    audioElement.current = document.createElement("audio");
    audioElement.current.autoplay = true;
    pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0]);

    // Add local audio track for microphone input in the browser
    const ms = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    pc.addTrack(ms.getTracks()[0]);

    // Set up data channel for sending and receiving events
    const dc = pc.createDataChannel("oai-events");
    setDataChannel(dc);

    // Start the session using the Session Description Protocol (SDP)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17";
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    });

    const answer = {
      type: "answer",
      sdp: await sdpResponse.text(),
    };
    await pc.setRemoteDescription(answer);

    peerConnection.current = pc;
    } catch (error) {
      console.error('Failed to start session:', error);
      setAssistantMessage('Sorry, failed to start session. Please try again.');
    }
  }

  // Stop current session, clean up peer connection and data channel
  function stopSession() {
    // Log session end
    if (sessionId) {
      fetch('/end-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })
      .then(res => res.json())
      .then(data => {
        console.log('Session ended:', data);
      })
      .catch(err => console.error('Error ending session:', err));
    }
    
    if (dataChannel) {
      dataChannel.close();
    }

    if (peerConnection.current) {
      peerConnection.current.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.track.stop();
        }
      });
      peerConnection.current.close();
    }

    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
    setSessionId(null);
    setAssistantMessage("Session ended. Click 'start session' to begin a new conversation.");
  }

  // Send a message to the model
  function sendClientEvent(message) {
    if (dataChannel) {
      const timestamp = new Date().toLocaleTimeString();
      message.event_id = message.event_id || crypto.randomUUID();

      // send event before setting timestamp since the backend peer doesn't expect this field
      dataChannel.send(JSON.stringify(message));

      // if guard just in case the timestamp exists by miracle
      if (!message.timestamp) {
        message.timestamp = timestamp;
      }
      setEvents((prev) => [message, ...prev]);
    } else {
      console.error(
        "Failed to send message - no data channel available",
        message,
      );
    }
  }

  // Send a text message to the model
  function sendTextMessage(message) {
    const event = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: message,
          },
        ],
      },
    };

    sendClientEvent(event);
    sendClientEvent({ type: "response.create" });
  }

  // Attach event listeners to the data channel when a new one is created
  useEffect(() => {
    if (dataChannel) {
      // Process server events
      dataChannel.addEventListener("message", (e) => {
        const event = JSON.parse(e.data);
        if (!event.timestamp) {
          event.timestamp = new Date().toLocaleTimeString();
        }

        // Update assistant message if it's a text content
        if (event.type === "conversation.item.delta" &&
          event.delta?.content?.[0]?.type === "text_delta" &&
          event.delta.content[0].text) {
          setAssistantMessage(prev => prev + event.delta.content[0].text);
        }

        // For new responses, reset the assistant message
        if (event.type === "response.create") {
          setAssistantMessage("");
        }

        setEvents((prev) => [event, ...prev]);
      });

      // Set session active when the data channel is opened
      dataChannel.addEventListener("open", () => {
        setIsSessionActive(true);
        setEvents([]);
        setAssistantMessage("Connected! I'm listening...");
        
        // Send an initial message to trigger the assistant's introduction
        setTimeout(() => {
          sendClientEvent({ type: "response.create" });
        }, 1000);
      });
    }
  }, [dataChannel]);

  return (
    <>
      <nav className="absolute top-0 left-0 right-0 h-16 flex items-center">
        <div className="flex items-center justify-between w-full m-4 pb-2 border-0 border-b border-solid border-gray-200">
          <div className="flex items-center gap-4">
            <img style={{ width: "24px" }} src={logo} />
            <h1>AI Voice Assistant</h1>
          </div>
          <a 
            href="/call-summary-page" 
            className="text-sm text-blue-600 hover:text-blue-800"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Call Summary
          </a>
        </div>
      </nav>
      <main className="absolute top-16 left-0 right-0 bottom-0 bg-white">
        <section className="absolute top-0 left-0 right-0 bottom-32 flex flex-col items-center justify-center">
          <div className="flex flex-col items-center justify-center max-w-md text-center p-8">
            <img src={aiLogo} alt="AI Assistant" className="w-32 h-32 mb-6" />
            <h2 className="text-2xl font-bold mb-4">AI Voice Assistant</h2>
            <p className="text-gray-600 mb-6">{assistantMessage}</p>
            {isSessionActive && (
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center animate-pulse">
                <div className="w-8 h-8 rounded-full bg-green-400"></div>
              </div>
            )}
          </div>
        </section>
        <section className="absolute h-32 left-0 right-0 bottom-0 p-4">
          <SessionControls
            startSession={startSession}
            stopSession={stopSession}
            sendClientEvent={sendClientEvent}
            sendTextMessage={sendTextMessage}
            events={events}
            isSessionActive={isSessionActive}
            sessionId={sessionId}
          />
        </section>
      </main>
    </>
  );
}
