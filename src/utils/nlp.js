export function parseHebrewVoiceCommand(transcript, containers) {
  // Normalize text: lowercase and remove leading conjunction 'ו' from words to simplify matching
  let text = transcript.toLowerCase().trim();
  // Strip 'ו' prefix from words (e.g. "וחצי" -> "חצי", "ומאתיים" -> "מאתיים")
  text = text.split(' ').map(word => {
    if (word.startsWith('ו') && word.length > 2) {
      return word.substring(1);
    }
    return word;
  }).join(' ');

  let weight = null;
  let matchedContainer = null;
  
  // Hebrew numbers mapping
  const singleNumberMap = {
    'חצי': 0.5,
    'אחד': 1,
    'אחת': 1,
    'שני': 2,
    'שניים': 2,
    'שתיים': 2,
    'שלוש': 3,
    'שלושה': 3,
    'ארבע': 4,
    'ארבעה': 4,
    'חמש': 5,
    'חמישה': 5,
    'שש': 6,
    'שישה': 6,
    'שבע': 7,
    'שבעה': 7,
    'שמונה': 8,
    'תשע': 9,
    'תשעה': 9,
    'עשר': 10,
    'עשרה': 10
  };

  const tensMap = {
    'עשרים': 20,
    'שלושים': 30,
    'ארבעים': 40,
    'חמישים': 50,
    'שישים': 60,
    'שבעים': 70,
    'שמונים': 80,
    'תשעים': 90
  };

  const hundredsMap = {
    'מאה': 100,
    'מאתיים': 200,
    'שלוש מאות': 300,
    'ארבע מאות': 400,
    'חמש מאות': 500,
    'שש מאות': 600,
    'שבע מאות': 700,
    'שמונה מאות': 800,
    'תשע מאות': 900
  };

  // Try to find direct digit numbers first e.g., "500", "1.5 קילו", "1256", "קילו 227"
  const numbers = text.match(/(\d+(?:\.\d+)?)/g);
  if (numbers && numbers.length > 0) {
    let parsedWeight = 0;
    
    if (text.includes("קילו") || text.includes("קילוגרם")) {
      // It mentions "kilo"
      if (numbers.length === 1) {
        let num = parseFloat(numbers[0]);
        if (num <= 20) {
          // Case: "1.5 קילו" -> 1500
          if (text.includes("חצי")) {
            num += 0.5;
          }
          parsedWeight = num * 1000;
        } else if (num < 1000) {
          // Case: "קילו 227" -> 1227
          parsedWeight = 1000 + num;
          if (text.includes("חצי")) {
            parsedWeight += 500;
          }
        } else {
          parsedWeight = num;
        }
      } else if (numbers.length >= 2) {
        // Case: "1 קילו 227" or "2 קילו 300"
        let kilos = parseFloat(numbers[0]);
        let grams = parseFloat(numbers[1]);
        if (kilos <= 20) {
          parsedWeight = (kilos * 1000) + grams;
        } else {
          parsedWeight = kilos + grams;
        }
      } else {
        parsedWeight = parseFloat(numbers[0]);
      }
      
      // If it's just "קילו וחצי" without any explicit leading number
      if (text.includes("קילו חצי")) {
        const indexKilo = text.indexOf("קילו");
        const beforeKilo = text.substring(0, indexKilo).trim();
        const hasLeadingDigit = /\d/.test(beforeKilo);
        if (!hasLeadingDigit) {
          parsedWeight = 1500;
        }
      }
    } else {
      // No "kilo" mentioned, e.g. "1227", "227"
      let num = parseFloat(numbers[0]);
      if (num > 0 && num < 10 && numbers[0].includes('.')) {
        parsedWeight = num * 1000;
      } else {
        parsedWeight = num;
      }
    }
    weight = parsedWeight;
  } else {
    // If no digits, parse compound Hebrew words
    if (text.includes("קילו חצי")) {
      weight = 1500;
    } else if (text.includes("חצי קילו")) {
      weight = 500;
    } else if (text.includes("רבע קילו")) {
      weight = 250;
    } else {
      let calculatedWeight = 0;
      let hasNumberWords = false;

      // Check hundreds
      for (const [word, val] of Object.entries(hundredsMap)) {
        if (text.includes(word)) {
          calculatedWeight += val;
          hasNumberWords = true;
          break;
        }
      }

      // Check tens
      for (const [word, val] of Object.entries(tensMap)) {
        if (text.includes(word)) {
          calculatedWeight += val;
          hasNumberWords = true;
          break;
        }
      }

      // Check units
      for (const [word, val] of Object.entries(singleNumberMap)) {
        const index = text.indexOf(word);
        if (index !== -1) {
          const afterWord = text.substring(index + word.length);
          if (!afterWord.startsWith(" מאות")) {
            if (word === 'חצי' && text.includes('קילו')) {
              continue;
            }
            if (text.includes(`${word} קילו`) || text.includes(`${word} קילוגרם`)) {
              calculatedWeight += val * 1000;
            } else {
              calculatedWeight += val;
            }
            hasNumberWords = true;
            break;
          }
        }
      }

      // Add base kilo if user said e.g. "קילו מאתיים" (1200)
      if (text.includes("קילו") && !text.includes("חצי קילו")) {
        if (calculatedWeight < 1000) {
          calculatedWeight += 1000;
        }
        hasNumberWords = true;
      }

      if (hasNumberWords) {
        weight = calculatedWeight;
      }
    }
  }

  // 2. Identify Container (Fuzzy match)
  if (containers && containers.length > 0) {
    const sortedContainers = [...containers].sort((a, b) => b.usageCount - a.usageCount);
    
    for (const container of sortedContainers) {
      const nameParts = container.name.toLowerCase().split(' ').filter(p => p.length > 1);
      let matchCount = 0;
      
      for (const part of nameParts) {
        const cleanPart = part.replace(/^[בלמה]/, '');
        if (text.includes(part) || (cleanPart.length > 2 && text.includes(cleanPart))) {
          matchCount++;
        }
      }
      
      if (matchCount > 0 && matchCount >= Math.ceil(nameParts.length / 2)) {
        matchedContainer = container;
        break;
      }
    }
  }

  return { weight, container: matchedContainer };
}

export function speakText(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'he-IL';
    utterance.rate = 1.05; // Slightly faster for responsiveness
    
    const voices = window.speechSynthesis.getVoices();
    const hebrewVoice = voices.find(v => v.lang.includes('he'));
    if (hebrewVoice) {
      utterance.voice = hebrewVoice;
    }
    window.speechSynthesis.speak(utterance);
  }
}

// Play premium audio feedback using Web Audio API
export function playChimeSuccess() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    // First high note (C5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.25);

    // Second higher note (E5) shortly after
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.warn("AudioContext failed to play chime:", e);
  }
}

export function playChimeError() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn("AudioContext failed to play chime:", e);
  }
}

