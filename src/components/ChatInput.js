"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "./ChatInput.module.css";
import { Send, Sparkles, Camera, Mic, MicOff } from "lucide-react";
import PhotoUpload from "./PhotoUpload";

export default function ChatInput({ 
  onSubmit, 
  isPlanning, 
  placeholder = "Tell me what you need to do... (e.g., 'I have a physics exam Friday')", 
  inputRef,
  value,
  onChange,
  onAddPhotoTasks
}) {
  const [internalInput, setInternalInput] = useState("");
  const [imageSrc, setImageSrc] = useState(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isInterim, setIsInterim] = useState(false);
  
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const silenceTimeoutRef = useRef(null);

  const isControlled = value !== undefined && onChange !== undefined;
  const input = isControlled ? value : internalInput;
  const setInput = isControlled ? (val) => onChange(val) : setInternalInput;

  // Ref to always hold fresh input state for speech closure triggers
  const inputValRef = useRef("");
  useEffect(() => {
    inputValRef.current = input;
  }, [input]);

  const suggestions = [
    "Help me study for my math exam",
    "Help me plan my project",
    "Prepare my pitch deck roadmap"
  ];

  // Feature detection for Web Speech API
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsSpeechSupported(true);
      }
    }

    // Clean up recognition on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isPlanning) return;
    onSubmit(input.trim());
    setInput("");
  };

  const handleCameraClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageSrc(event.target.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Web Speech API actions
  const startVoiceInput = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    // Reset any previous recognition instances
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        console.warn("Failed to abort previous speech session:", e);
      }
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    const resetSilenceTimeout = () => {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = setTimeout(() => {
        console.log("Voice channel idle limit (10s) reached. Saving transmission...");
        stopVoiceInput();
      }, 10000);
    };

    recognition.onstart = () => {
      setIsListening(true);
      resetSilenceTimeout();
    };

    recognition.onresult = (event) => {
      resetSilenceTimeout();
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const freshText = finalTranscript || interimTranscript;
      if (freshText.trim()) {
        setInput(freshText);
        inputValRef.current = freshText;
      }
      setIsInterim(!event.results[event.results.length - 1].isFinal);
    };

    recognition.onend = () => {
      setIsListening(false);
      setIsInterim(false);
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

      // Auto-submit finalized command on end of speech sequence if valid
      const textToSlay = inputValRef.current;
      if (textToSlay && textToSlay.trim() && !isPlanning) {
        onSubmit(textToSlay.trim());
        setInput("");
        inputValRef.current = "";
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

      if (event.error === "not-allowed") {
        alert("Microphone permission denied. Please allow mic access to dictate instructions.");
      } else if (event.error !== "no-speech") {
        console.error("Speech Recognition Error Event:", event.error);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start Speech recognition execution:", e);
    }
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("Error calling stop on speech service:", e);
      }
    }
    setIsListening(false);
    setIsInterim(false);
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
  };

  const handleMicToggle = () => {
    if (isListening) {
      stopVoiceInput();
    } else {
      startVoiceInput();
    }
  };

  return (
    <div className={styles.container}>
      {/* Photo Upload Results & Analysis Box */}
      {imageSrc && (
        <PhotoUpload 
          imageSrc={imageSrc} 
          onDismiss={() => setImageSrc(null)}
          onAddAllTasks={(goals) => {
            if (onAddPhotoTasks) {
              onAddPhotoTasks(goals);
            }
            setImageSrc(null);
          }}
        />
      )}

      {/* Dynamic Animated Waveform under the layout when Active */}
      {isListening && (
        <div className={styles.waveform}>
          <div className={styles.waveBar}></div>
          <div className={styles.waveBar}></div>
          <div className={styles.waveBar}></div>
          <div className={styles.waveBar}></div>
          <div className={styles.waveBar}></div>
          <span className={styles.waveformText}>Capturing operational command...</span>
        </div>
      )}

      {/* Suggestion Chips */}
      <div className={styles.suggestions}>
        {suggestions.map((s, idx) => (
          <button 
            key={idx}
            type="button" 
            className={styles.chip}
            onClick={() => setInput(s)}
            disabled={isPlanning}
          >
            <Sparkles size={10} />
            {s}
          </button>
        ))}
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className={styles.form} id="chat-input-form">
        <input 
          ref={inputRef}
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? "🎤 Listening..." : placeholder}
          disabled={isPlanning}
          className={`${styles.input} ${isListening ? styles.listeningInput : ""} ${isInterim ? styles.interimInput : ""}`}
        />

        {/* Hidden File input for Image selection or Mobile Camera capture */}
        <input 
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        {/* Dynamic Voice Dictation Mic Button (conditionally rendered only if supported by browser) */}
        {isSpeechSupported && (
          <button
            type="button"
            className={`${styles.micButton} ${isListening ? styles.micButtonListening : ""}`}
            onClick={handleMicToggle}
            disabled={isPlanning}
            title={isListening ? "Stop voice command transmission" : "Dictate operational command via microphone"}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}

        {/* Camera/Capture Button */}
        <button 
          type="button" 
          className={styles.cameraButton}
          onClick={handleCameraClick}
          disabled={isPlanning || isListening}
          title="Extract tasks from photo using Gemini Vision"
        >
          <Camera size={16} />
        </button>

        {/* Send Button */}
        <button 
          type="submit" 
          className={styles.sendButton}
          disabled={!input.trim() || isPlanning || isListening}
        >
          {isPlanning ? (
            <div className={styles.spinner}></div>
          ) : (
            <Send size={16} />
          )}
        </button>
      </form>
    </div>
  );
}
