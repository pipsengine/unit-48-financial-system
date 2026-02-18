import React, { useEffect, useCallback, useRef } from 'react';

interface SessionManagerProps {
  onLogout: (reason?: string) => void;
  token: string;
}

const EVENTS = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
const TIMEOUT_MS = 300000; // 5 minutes
const HEARTBEAT_INTERVAL = 60000; // 1 minute

const SessionManager: React.FC<SessionManagerProps> = ({ onLogout, token }) => {
  const lastActivityRef = useRef(Date.now());
  const lastHeartbeatRef = useRef(Date.now());
  
  const handleActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    
    // Throttle server heartbeat to avoid spamming
    if (now - lastHeartbeatRef.current > HEARTBEAT_INTERVAL) {
      lastHeartbeatRef.current = now;
      
      fetch('http://localhost:3006/api/auth/heartbeat', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => {
        if (res.status === 401) {
          onLogout("Session expired on server.");
        }
      })
      .catch(console.error);
    }
  }, [token, onLogout]);

  useEffect(() => {
    // Attach event listeners for user activity
    EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Check idle status every second
    const intervalId = setInterval(() => {
      const now = Date.now();
      if (now - lastActivityRef.current > TIMEOUT_MS) {
        onLogout("Session expired due to inactivity. Please log in again.");
      }
    }, 1000);

    return () => {
      EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(intervalId);
    };
  }, [handleActivity, onLogout]);

  return null;
};

export default SessionManager;
