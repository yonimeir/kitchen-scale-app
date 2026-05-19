import { useState, useEffect, useCallback, useRef } from 'react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function useVoiceCommand({ onCommand, wakeWords = ['משקל', 'היי משקל', 'תשקול לי'] }) {
  const [isListening, setIsListening] = useState(false);
  const [isActiveProcessing, setIsActiveProcessing] = useState(false);
  const recognitionRef = useRef(null);
  const isContinuousRef = useRef(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      isContinuousRef.current = true;
    };

    recognition.onresult = (event) => {
      const results = event.results;
      const latestResultIndex = results.length - 1;
      const transcript = results[latestResultIndex][0].transcript.trim();
      
      console.log("🗣️ השמעתי:", transcript);

      // Check if it contains a wake word
      const containsWakeWord = wakeWords.some(w => transcript.includes(w));
      
      if (containsWakeWord || isActiveProcessing) {
        if (containsWakeWord) {
           setIsActiveProcessing(true);
           // Clear any existing timeout
           if (timeoutRef.current) clearTimeout(timeoutRef.current);
           
           // Stay active for 8 seconds after wake word
           timeoutRef.current = setTimeout(() => {
             setIsActiveProcessing(false);
           }, 8000);
        }
        
        onCommand(transcript);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      if (event.error === 'not-allowed') {
        setIsListening(false);
        isContinuousRef.current = false;
      }
    };

    recognition.onend = () => {
      if (isContinuousRef.current) {
        try {
          // Add a small delay before restarting to avoid rapid loops
          setTimeout(() => {
            if (isContinuousRef.current && recognitionRef.current) {
              recognitionRef.current.start();
            }
          }, 100);
        } catch (e) {
          console.error("Restart error", e);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isContinuousRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onCommand, wakeWords, isActiveProcessing]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      alert("הדפדפן שלך לא תומך בזיהוי קולי. נסה בכרום.");
      return;
    }

    if (isListening) {
      isContinuousRef.current = false;
      setIsActiveProcessing(false);
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error(e);
      }
    }
  }, [isListening]);

  return { isListening, isActiveProcessing, toggleListening, isSupported: !!SpeechRecognition };
}
