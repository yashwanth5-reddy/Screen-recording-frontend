import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function App() {
  const [recording, setRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  const recordedChunks = useRef([]);
  const [recordings, setRecordings] = useState([]);

  useEffect(() => {
    let interval;
    if (recording) {
      if (timer >= 180) { // max 3 minutes = 180 seconds
        stopRecording();
        return;
      }
      interval = setInterval(() => {
        setTimer((time) => time + 1);
      }, 1000);
    } else clearInterval(interval);
    return () => clearInterval(interval);
  }, [recording, timer]);

  const startRecording = async () => {
    recordedChunks.current = [];
    setTimer(0);
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      if (screenStream.getAudioTracks().length > 0) {
        const systemSource = audioContext.createMediaStreamSource(screenStream);
        systemSource.connect(destination);
      }
      if (audioStream.getAudioTracks().length > 0) {
        const micSource = audioContext.createMediaStreamSource(audioStream);
        micSource.connect(destination);
      }
      const combinedStream = new MediaStream();
      screenStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));
      destination.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
      const mr = new MediaRecorder(combinedStream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(recordedChunks.current, { type: "video/webm" });
        setVideoURL(URL.createObjectURL(blob));
      };
      mr.start();
      setMediaRecorder(mr);
      setRecording(true);
    } catch (err) {
      alert("Could not start recording: " + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) mediaRecorder.stop();
    setRecording(false);
  };

  const downloadRecording = () => {
    const blob = new Blob(recordedChunks.current, { type: "video/webm" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recording_${Date.now()}.webm`;
    a.click();
  };

  const uploadRecording = async () => {
    const blob = new Blob(recordedChunks.current, { type: "video/webm" });
    const formData = new FormData();
    formData.append("video", blob, `recording_${Date.now()}.webm`);
    try {
      const res = await axios.post(`${API_URL}/api/recordings`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      console.log("Upload response:", res.data);
      alert(res.data.message);
      fetchRecordings();
    } catch (err) {
      console.error("Upload error:", err.response || err.message);
      alert("Upload failed");
    }
  };

  const fetchRecordings = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/recordings`);
      setRecordings(res.data);
    } catch (err) {
      alert("Failed to fetch recordings");
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, []);

  return (
    <div style={{ maxWidth: "600px", margin: "auto", padding: 20 }}>
      <h1>Screen Recorder</h1>
      <button onClick={startRecording} disabled={recording}>Start Recording</button>
      <button onClick={stopRecording} disabled={!recording}>Stop Recording</button>
      <span> Timer: {timer} seconds </span>
      {videoURL && (
        <>
          <video src={videoURL} controls style={{ width: "100%", marginTop: 20 }} />
          <div>
            <button onClick={downloadRecording}>Download</button>
            <button onClick={uploadRecording}>Upload</button>
          </div>
        </>
      )}
      <h2>Uploaded Recordings</h2>
      <ul>
        {recordings.map((rec) => (
          <li key={rec.id} style={{ marginBottom: 20 }}>
            <p>
              <strong>{rec.filename}</strong> - {rec.filesize} bytes -{" "}
              {new Date(rec.createdAt).toLocaleString()}
            </p>
            <video src={`${API_URL}${rec.filepath}`} controls width="300" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
